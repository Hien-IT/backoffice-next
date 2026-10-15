// Ported from directus/app/src/composables/use-versions.ts
// Backoffice: requests go through the SDK client (sdk.ts) and errors to the useNotices dialog (FR-054b); the form utils
// live in components/form/utils; `?version=` is read and written with vue-router (no @vueuse/router), see
// useVersionQuery; the SDK error carries `errors` directly (no axios `response.data`).
import type { ContentVersion, Filter, Item, PrimaryKey } from '@directus/types';
import { computed, ref, type Ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { getDefaultValuesFromFields } from '../components/form/utils/get-default-values-from-fields.ts';
import { mergeItemData } from '../components/form/utils/merge-item-data.ts';
import { pushGroupOptionsDown } from '../components/form/utils/push-group-options-down.ts';
import { validateItem } from '../components/form/utils/validate-item.ts';
import { DRAFT_VERSION_KEY, VALIDATION_TYPES } from '../constants.ts';
import type { ContentVersionMaybeNew, ContentVersionWithType, NewContentVersion } from '../types/versions.ts';
import { showUnexpectedError as unexpectedError } from './use-notices.ts';
import { useNestedValidation } from './use-nested-validation.ts';
import { useCollectionPermissions, usePermissions } from './use-permissions/index.ts';

type APIError = { extensions?: { code?: string } & Record<string, unknown> };

export function useVersions(collection: Ref<string>, isSingleton: Ref<boolean>, primaryKey: Ref<string | null>) {
	const currentVersion = ref<ContentVersionMaybeNew | null>(null);
	const rawVersions = ref<ContentVersion[] | null>(null);
	const loading = ref(false);
	const saveVersionLoading = ref(false);
	const validationErrors = ref<any[]>([]);

	const { createAllowed: createVersionsAllowed, readAllowed: readVersionsAllowed } =
		useCollectionPermissions('directus_versions');

	const queryVersion = useVersionQuery();

	const permissions = usePermissions(collection, primaryKey, false);
	const fieldsWithPermissions = permissions.itemPermissions.fields;
	const { nestedValidationErrors } = useNestedValidation();
	const defaultValues = getDefaultValuesFromFields(fieldsWithPermissions);

	const versions = computed<ContentVersionMaybeNew[]>(() => {
		const draftVersion = getGlobalVersion(DRAFT_VERSION_KEY);
		const localVersions = rawVersions.value?.filter(versionNotInGlobals)?.map(versionAddLocalType) ?? [];

		return [draftVersion, ...localVersions];

		function getGlobalVersion(key: ContentVersion['key'], name: string | null = null) {
			const type = 'global';
			const existingVersion = rawVersions.value?.find((version) => version.key === key);

			if (existingVersion) {
				return { ...existingVersion, name, type } as ContentVersionWithType;
			}

			return { id: '+', key, name, type } as NewContentVersion;
		}

		function versionNotInGlobals(version: ContentVersion) {
			return version.key !== DRAFT_VERSION_KEY;
		}

		function versionAddLocalType(version: ContentVersion): ContentVersionWithType {
			return { ...version, type: 'local' };
		}
	});

	watch(
		[queryVersion, versions],
		([newQueryVersion, newVersions]) => {
			if (!newVersions) return;

			const previouslySelectedKey = currentVersion.value?.key;

			currentVersion.value = newQueryVersion
				? (newVersions.find((version) => version.key === newQueryVersion && isVersionSelectable(version)) ?? null)
				: null;

			if (currentVersion.value?.key !== previouslySelectedKey) {
				validationErrors.value = [];
			}
		},
		{ immediate: true },
	);

	watch(currentVersion, (newCurrentVersion) => {
		queryVersion.value = newCurrentVersion?.key ?? null;
		validationErrors.value = [];
	});

	watch(
		[collection, isSingleton, primaryKey],
		([newCollection], [oldCollection]) => {
			if (oldCollection && newCollection !== oldCollection) currentVersion.value = null;
			getVersions();
		},
		{ immediate: true },
	);

	return {
		readVersionsAllowed,
		currentVersion,
		versions,
		loading,
		getVersions,
		addVersion,
		updateVersion,
		deleteVersion,
		saveVersionLoading,
		saveVersion,
		validationErrors,
	};

	function saveVersionErrorHandler(error: any) {
		if (error?.errors) {
			validationErrors.value = error.errors
				.filter((err: APIError) => VALIDATION_TYPES.includes(err?.extensions?.code ?? ''))
				.map((err: APIError) => {
					return err.extensions;
				});

			const otherErrors = error.errors.filter(
				(err: APIError) => !VALIDATION_TYPES.includes(err?.extensions?.code ?? ''),
			);

			if (otherErrors.length > 0) {
				otherErrors.forEach(unexpectedError);
			}
		} else {
			unexpectedError(error);
		}

		throw error;
	}

	async function getVersions() {
		if (!readVersionsAllowed.value) return;

		if ((!isSingleton.value && !primaryKey.value) || primaryKey.value === '+') return;

		loading.value = true;

		try {
			const filter: Filter = {
				_and: [
					{ collection: { _eq: collection.value } },
					...(primaryKey.value ? [{ item: { _eq: primaryKey.value } }] : []),
				],
			};

			rawVersions.value = await sdk.request<ContentVersion[]>(
				requestEndpoint('/versions', {
					params: {
						filter,
						sort: '-date_created',
						fields: ['*'],
					},
				}),
			);
		} catch (error) {
			unexpectedError(error);
		} finally {
			loading.value = false;
		}
	}

	async function addVersion(version: ContentVersion) {
		rawVersions.value = [...(rawVersions.value ? rawVersions.value : []), version];
		queryVersion.value = version.key;
	}

	async function updateVersion(updates: { key: string; name?: string | null }) {
		if (!currentVersion.value || !rawVersions.value) return;

		const currentVersionId = currentVersion.value.id;
		const versionToUpdate = rawVersions.value.find((version) => version.id === currentVersionId);

		if (versionToUpdate) {
			versionToUpdate.key = updates.key;
			if ('name' in updates) versionToUpdate.name = updates.name ?? null;
			currentVersion.value = versions.value.find((version) => version.id === currentVersionId) ?? null;
		}
	}

	function deleteVersion(deleteOnPromote = true) {
		if (!currentVersion.value || !rawVersions.value) return;

		const isLocalVersion = currentVersion.value?.type === 'local';
		const currentVersionId = currentVersion.value.id;

		const index = rawVersions.value.findIndex((version) => version.id === currentVersionId);

		if (index !== -1) {
			if (isLocalVersion || deleteOnPromote) currentVersion.value = null;
			rawVersions.value.splice(index, 1);
		}
	}

	/** @param actualPrimaryKey Resolved PK of the item — needed because for singletons the route PK is null */
	async function saveVersion(edits: Ref<Record<string, any>>, item: Ref<Item>, actualPrimaryKey: PrimaryKey | null) {
		if (!currentVersion.value || !actualPrimaryKey) return;

		saveVersionLoading.value = true;
		validationErrors.value = [];

		const payloadToValidate = mergeItemData(defaultValues.value, item.value, edits.value);

		const fields = pushGroupOptionsDown(fieldsWithPermissions.value);

		const errors: any[] = validateItem(payloadToValidate, fields, false, false, currentVersion.value);
		if (nestedValidationErrors.value?.length) errors.push(...nestedValidationErrors.value);

		if (errors.length > 0) {
			validationErrors.value = errors;
			saveVersionLoading.value = false;
			throw errors;
		}

		try {
			let versionId: PrimaryKey;

			if (currentVersion.value.id === '+') {
				const version = await sdk.request<ContentVersion>(
					requestEndpoint('/versions', {
						method: 'POST',
						body: {
							key: currentVersion.value.key,
							collection: collection.value,
							item: String(actualPrimaryKey),
						},
					}),
				);

				versionId = version.id;
			} else {
				versionId = currentVersion.value.id;
			}

			const savedData = await sdk.request<Item>(
				requestEndpoint(`/versions/${encodeURIComponent(versionId)}/save`, { method: 'POST', body: edits.value }),
			);

			// Update local item with the saved changes
			Object.assign(item.value, savedData);
			edits.value = {};

			await getVersions();

			return savedData;
		} catch (error) {
			saveVersionErrorHandler(error);
		} finally {
			saveVersionLoading.value = false;
		}

		// Backoffice: saveVersionErrorHandler always throws; this keeps noImplicitReturns satisfied.
		return undefined;
	}

	function isVersionSelectable(version: ContentVersionMaybeNew) {
		return version.id === '+' ? createVersionsAllowed.value : readVersionsAllowed.value;
	}
}

/**
 * Backoffice: `useRouteQuery('version', null, { mode: 'push' })` of @vueuse/router. The local value changes at once
 * (like vueuse) so the watchers above do not see the old query while the navigation is pending.
 */
function useVersionQuery() {
	const route = useRoute();
	const router = useRouter();

	const read = () => {
		const value = route.query['version'];
		return (Array.isArray(value) ? value[0] : value) ?? null;
	};

	const local = ref<string | null>(read());

	watch(
		() => route.query['version'],
		() => (local.value = read()),
	);

	return computed<string | null>({
		get: () => local.value,
		set(value) {
			if (value === local.value) return;
			local.value = value;
			const { version: _version, ...query } = route.query;
			router.push({ query: value === null ? query : { ...query, version: value } });
		},
	});
}
