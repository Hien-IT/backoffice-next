<!-- Ported from directus/app/src/interfaces/_system/system-permissions/system-permissions.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US4-6, US4-7, recipe Q-23): the table, chips and dialogs are the Bo components with the theme
// tokens; the script is DR's. @directus/constants and @directus/system-data are not dependencies of apps/web:
// PERMISSION_ACTIONS is the same five actions (app-permissions.ts) and isSystemCollection comes from get-item-route.ts.
// Adding a collection scrolls the injected `main-element` (a drawer) or the page itself when there is none.
import type { Alterations, Filter, Permission, PermissionsAction } from '@directus/types';
import { getEndpoint } from '@directus/utils';
import { cloneDeep, get, groupBy, isNil, merge, orderBy, sortBy } from 'lodash-es';
import { computed, inject, nextTick, type Ref, ref, toRefs, watch } from 'vue';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoNotice from '../../../components/BoNotice.vue';
import { showUnexpectedError as unexpectedError } from '../../../composables/use-notices.ts';
import type { DisplayItem } from '../../../composables/use-relation-multiple.ts';
import { type RelationO2M, useRelationO2M } from '../../../composables/use-relation-o2m.ts';
import { type Collection, useCollectionsStore } from '../../../stores/collections.ts';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { isSystemCollection } from '../../../utils/get-item-route.ts';
import AddCollection from './AddCollection.vue';
import {
	appAccessMinimalPermissions,
	appRecommendedPermissions,
	disabledActions,
	editablePermissionActions as PERMISSION_ACTIONS,
	isBackofficeAction,
	type BackofficeAction,
	type MatrixAction,
} from './app-permissions.ts';
import PermissionsDetail from './detail/PermissionsDetail.vue';
import PermissionsHeader from './PermissionsHeader.vue';
import PermissionsRow from './PermissionsRow.vue';
import { type BoDisplayItem, type BoPermission, useBoPermissions } from './use-bo-permissions.ts';

type PermissionGroup = {
	collection: Collection;
	permissions: Permission[];
};

const props = withDefaults(
	defineProps<{
		primaryKey: string;
		disabled?: boolean;
		value: number[] | Alterations<Permission>;
		collection: string;
		field: string;
	}>(),
	{
		disabled: false,
	},
);

const emit = defineEmits<{
	(e: 'input', value: Permission[] | number[] | Alterations<Permission>): void;
}>();

const { collection, primaryKey, field } = toRefs(props);

const mainElement = inject<Ref<Element | null> | null>('main-element', null);
const contentEl = computed(() => mainElement?.value ?? document.scrollingElement);
const permissionsTable = ref<HTMLTableElement | null>(null);

const collectionsStore = useCollectionsStore();
const { relationInfo } = useRelationO2M(collection, field);

const values = inject<Ref<Record<string, any>>>('values');
const appAccess = computed(() => values?.value['app_access'] ?? false);
const adminAccess = computed(() => values?.value['admin_access'] ?? false);

const value = computed({
	get: () => props.value,
	set: (val) => {
		emit('input', val);
	},
});

const { update, remove, create, displayItems, getItemEdits, loading, resetActive, resetSystemPermissions } =
	usePermissions(value, relationInfo, primaryKey, appAccess);

// Backoffice (spec 025, D-189.3): the import and export cells come from backoffice_permissions (use-bo-permissions.ts);
// without a staging (no policy page) or when the API is DR (FR-034) the matrix has the DR columns only.
const bo = useBoPermissions();
const permissionsStore = usePermissionsStore();
const boEnabled = computed(() => bo !== null && permissionsStore.hasBackofficeActions);
const matrixActions = computed(() =>
	PERMISSION_ACTIONS.filter((action) => boEnabled.value || !isBackofficeAction(action)),
);

watch(
	[primaryKey, boEnabled],
	() => {
		if (boEnabled.value) bo!.fetch().catch(unexpectedError);
	},
	{ immediate: true },
);

/** The locked cells of a row: DR's, and import of a system collection (admin-only as in DR, FR-007, FR-022). */
function disabledFor(collection: string): MatrixAction[] {
	return [...(disabledActions[collection] ?? []), ...(isSystemCollection(collection) ? (['import'] as const) : [])];
}

function emptyBoPermission(collection: string, action: BackofficeAction): BoPermission {
	return {
		policy: primaryKey.value,
		collection,
		action,
		permissions: null,
		validation: null,
		presets: null,
		fields: null,
		options: null,
	};
}

const { allPermissions, regularPermissions, systemPermissions, addEmptyPermission, removeEmptyCollection } =
	useGroupedPermissions();

function getPermission(collection: string, action: PermissionsAction) {
	return displayItems.value.find(
		(item) => item['collection'] === collection && item['action'] === action && !isNil(item['policy']),
	);
}

function getBoPermission(collection: string, action: BackofficeAction) {
	return bo?.displayItems.value.find((item) => item.collection === collection && item.action === action);
}

function createEmptyPermission<P extends Permission>(
	overrides: Pick<P, 'collection' | 'action'> & Partial<Omit<P, 'collection' | 'action'>>,
): P {
	return {
		policy: primaryKey.value,
		permissions: null,
		validation: null,
		fields: null,
		presets: null,
		...overrides,
	} as P;
}

const currentlyEditingKey = ref<string | null>(null);
const currentlyEditingItem = ref<DisplayItem | null>(null);
const editsAtStart = ref<Record<string, any>>({});
const newItem = ref(false);
const editingBackoffice = ref(false);

function editItem(collection: string, action: MatrixAction) {
	if (isBackofficeAction(action)) {
		// Backoffice (spec 025): the drawer edits the staged row itself, no read of /permissions/:id.
		const existing = getBoPermission(collection, action);
		newItem.value = existing === undefined;
		editingBackoffice.value = true;
		editsAtStart.value = existing ?? emptyBoPermission(collection, action);
		currentlyEditingKey.value = '+';
		currentlyEditingItem.value = (existing ?? null) as DisplayItem | null;
		return;
	}

	editingBackoffice.value = false;

	if (!relationInfo.value) return;

	const existingPermission = getPermission(collection, action);

	newItem.value = existingPermission === undefined;

	editsAtStart.value = existingPermission
		? getItemEdits(existingPermission)
		: createEmptyPermission({
				collection,
				action,
			});

	if (newItem.value || existingPermission?.$type === 'created') {
		currentlyEditingKey.value = '+';
	} else {
		currentlyEditingKey.value = existingPermission!['id'];
	}

	currentlyEditingItem.value = existingPermission ?? null;
}

function stageEdits(item: Permission | null) {
	if (editingBackoffice.value) {
		const current = currentlyEditingItem.value as BoDisplayItem | null;

		if (newItem.value && item !== null) bo!.create(item as unknown as BoPermission);
		else if (item && current) bo!.update({ ...current, ...(item as unknown as BoPermission) });
		else if (current) bo!.remove(current);

		return;
	}

	if (newItem.value && item !== null) {
		create(item);
	} else if (item) {
		update(item);
	} else if (currentlyEditingItem.value) {
		remove(currentlyEditingItem.value);
	}
}

function cancelEdit() {
	currentlyEditingItem.value = null;
	currentlyEditingKey.value = null;
}

function removeCollection(collection: string) {
	setNoAccessAll(collection);
	removeEmptyCollection(collection);
}

function setFullAccessAll(collection: string) {
	for (const action of matrixActions.value) {
		setFullAccess(collection, action);
	}
}

function setNoAccessAll(collection: string) {
	for (const action of matrixActions.value) {
		setNoAccess(collection, action);
	}
}

function setFullAccess(collection: string, action: MatrixAction) {
	if (disabledFor(collection).includes(action)) return;

	if (isBackofficeAction(action)) {
		const existing = getBoPermission(collection, action);
		const full = { fields: ['*'], permissions: null, validation: null, presets: null, options: null };

		if (existing) bo!.update({ ...existing, ...full });
		else bo!.create({ ...emptyBoPermission(collection, action), ...full });

		return;
	}

	const existing = getPermission(collection, action);

	if (existing) {
		update({
			...existing,
			fields: ['*'],
			permissions: null,
			validation: null,
			presets: null,
		});
	} else {
		create(
			createEmptyPermission({
				collection,
				action,
				policy: primaryKey.value,
				fields: ['*'],
			}),
		);
	}
}

function setNoAccess(collection: string, action: MatrixAction) {
	if (disabledFor(collection).includes(action)) return;

	if (isBackofficeAction(action)) {
		const existing = getBoPermission(collection, action);
		if (existing) bo!.remove(existing);
		return;
	}

	const existing = getPermission(collection, action);

	if (existing && existing.$type !== 'deleted') {
		remove(existing);
	}
}

function usePermissions(
	value: Ref<number[] | Alterations<Permission> | undefined>,
	relation: Ref<RelationO2M | undefined>,
	itemId: Ref<string | number>,
	addMinimalAppPermissions: Ref<boolean>,
) {
	const loading = ref(false);
	const fetchedItems = ref<Permission[]>([]);

	const _value = computed<Alterations<Record<string, any>>>({
		get() {
			if (!value.value || Array.isArray(value.value)) {
				return {
					create: [],
					update: [],
					delete: [],
				};
			}

			return value.value as Alterations<Permission>;
		},
		set(newValue) {
			if (newValue.create.length === 0 && newValue.update.length === 0 && newValue.delete.length === 0) {
				value.value = undefined;
				return;
			}

			value.value = newValue;
		},
	});

	// Fetch new items when the value gets changed by the external "save and stay"
	// We don't want to refresh when we ourself reset the value (when we have no more changes)
	watch(value, (newValue, oldValue) => {
		if (
			Array.isArray(newValue) &&
			oldValue &&
			(('create' in oldValue && Array.isArray(oldValue.create) && oldValue.create.length > 0) ||
				('update' in oldValue && Array.isArray(oldValue.update) && oldValue.update.length > 0) ||
				('delete' in oldValue && Array.isArray(oldValue.delete) && oldValue.delete.length > 0))
		) {
			fetchPermissions();
		}
	});

	watch([primaryKey, relationInfo], fetchPermissions, { immediate: true });

	const createdItems = computed(() => {
		const info = relation.value;
		if (info?.type === undefined) return [];

		const items = _value.value.create.map((item, index) => {
			return {
				...item,
				$type: 'created',
				$index: index,
			} as DisplayItem;
		});

		return items;
	});

	const displayItems = computed(() => {
		if (!relation.value) return [];

		const targetPKField = relation.value.relatedPrimaryKeyField.field;

		const items: DisplayItem[] = fetchedItems.value.map((item: Record<string, any>) => {
			let edits;

			for (const [index, value] of _value.value.update.entries()) {
				if (typeof value === 'object' && value[targetPKField] === item[targetPKField]) {
					edits = { index, value };
					break;
				}
			}

			let updatedItem: Record<string, any> = cloneDeep(item);

			if (edits) {
				updatedItem = {
					...updatedItem,
					...edits.value,
				};

				updatedItem['$type'] = 'updated';
				updatedItem['$index'] = edits.index;
				updatedItem['$edits'] = edits.index;
			}

			const deleteIndex = _value.value.delete.findIndex((id) => id === item[targetPKField]);

			if (deleteIndex !== -1) {
				merge(updatedItem, { $type: 'deleted', $index: deleteIndex });
			}

			return updatedItem;
		});

		items.push(...createdItems.value);

		if (addMinimalAppPermissions.value) {
			for (const perm of appAccessMinimalPermissions) {
				if (items.find((item) => item['collection'] === perm.collection && item['action'] === perm.collection))
					continue;
				items.push(perm);
			}
		}

		const sortField = 'collection';

		return items.sort((a, b) => {
			return get(a, sortField) - get(b, sortField);
		});
	});

	const { cleanItem, isEmpty, isLocalItem, getItemEdits } = useUtil();
	const { create, update, remove } = useActions(_value);
	const { resetActive, resetSystemPermissions } = useReset();

	return {
		loading,
		create,
		update,
		remove,
		displayItems,
		isLocalItem,
		getItemEdits,
		resetActive,
		resetSystemPermissions,
	};

	function useActions(target: Ref<any>) {
		return { create, update, remove };

		function create(...items: Record<string, any>[]) {
			for (const item of items) {
				target.value.create.push(cleanItem(item));
			}

			updateValue();
		}

		function update(...items: DisplayItem[]) {
			if (!relation.value) return;

			for (const item of items) {
				if (item.$type === undefined || item.$index === undefined) {
					target.value.update.push(cleanItem(item));
				} else if (item.$type === 'created') {
					target.value.create[item.$index] = cleanItem(item);
				} else if (item.$type === 'updated') {
					if (isEmpty(item)) target.value.update.splice(item.$index, 1);
					else target.value.update[item.$index] = cleanItem(item);
				} else if (item.$type === 'deleted') {
					if (item.$edits !== undefined) {
						if (isEmpty(item)) target.value.update.splice(item.$index, 1);
						else target.value.update[item.$edits] = cleanItem(item);
					} else {
						target.value.update.push(cleanItem(item));
					}

					target.value.delete.splice(item.$index, 1);
				}
			}

			updateValue();
		}

		function remove(...items: DisplayItem[]) {
			if (!relation.value) return;

			// Ensure that the objects are removed in reverse order to not mess up the indices while we're working with them
			items = orderBy(items, ['$index'], ['desc']);

			for (const item of items) {
				if (item.$type === undefined || item.$index === undefined) {
					target.value.delete.push(item['id']);
				} else if (item.$type === 'created') {
					target.value.create.splice(item.$index, 1);
				} else if (item.$type === 'updated') {
					target.value.update.splice(item.$index, 1);
					target.value.delete.push(item['id']);
				} else if (item.$type === 'deleted') {
					target.value.delete.splice(item.$index, 1);
				}
			}

			updateValue();
		}

		function updateValue() {
			target.value = cloneDeep(target.value);
		}
	}

	function useUtil() {
		return { cleanItem, isEmpty, isLocalItem, getItemEdits };

		function cleanItem(item: DisplayItem) {
			return Object.entries(item).reduce((acc, [key, value]) => {
				if (!key.startsWith('$')) acc[key] = value;
				return acc;
			}, {} as DisplayItem);
		}

		function isLocalItem(item: DisplayItem) {
			return item.$type !== undefined && item.$type !== 'updated';
		}

		function isEmpty(item: DisplayItem): boolean {
			if (item.$type !== 'updated' && item.$edits === undefined) return false;

			const topLevelKeys = Object.keys(item).filter((key) => !key.startsWith('$'));

			return topLevelKeys.length === 1 && topLevelKeys[0] === 'id';
		}

		function getItemEdits(item: DisplayItem) {
			if ('$type' in item && item.$index !== undefined) {
				if (item.$type === 'created') {
					return {
						..._value.value.create[item.$index],
						$type: 'created',
						$index: item.$index,
					};
				} else if (item.$type === 'updated') {
					return {
						..._value.value.update[item.$index],
						$type: 'updated',
						$index: item.$index,
					};
				} else if (item.$type === 'deleted' && item.$edits !== undefined) {
					return {
						..._value.value.update[item.$edits],
						$type: 'deleted',
						$index: item.$index,
						$edits: item.$edits,
					};
				}
			}

			return {};
		}
	}

	async function fetchPermissions() {
		if (!relation.value) return;

		if (!itemId.value || itemId.value === '+') {
			fetchedItems.value = [];
			return;
		}

		try {
			loading.value = true;

			if (itemId.value !== '+') {
				const filter: Filter = { _and: [{ policy: itemId.value } as Filter] };

				const response = await sdk.request<Permission[]>(
					requestEndpoint(getEndpoint('directus_permissions'), {
						params: {
							fields: '*',
							filter,
							page: 0,
							limit: -1,
						},
					}),
				);

				fetchedItems.value = response;
			}
		} catch (error) {
			unexpectedError(error);
		} finally {
			loading.value = false;
		}
	}

	function useReset() {
		const resetActive = ref<string | boolean>(false);

		return { resetActive, resetSystemPermissions };

		async function resetSystemPermissions(useRecommended: boolean) {
			if (!relation.value) return;

			// remove all system permissions that are not locally added app permissions
			const toBeRemoved = displayItems.value
				.filter((item) => isSystemCollection(item['collection']))
				.filter((item) => item.$type !== undefined || item['id'] !== undefined);

			remove(...toBeRemoved);

			if (addMinimalAppPermissions.value && useRecommended) {
				// Add recommended permissions for the app
				create(
					...appRecommendedPermissions.map((perm) => ({
						...perm,
						policy: itemId.value,
					})),
				);
			}

			resetActive.value = false;
		}
	}
}

function useGroupedPermissions() {
	const localPermissions = ref<PermissionGroup[]>([]);
	const loading = ref(false);

	const groupedPermissions = computed(() => {
		const groups = groupBy(
			[
				...displayItems.value.filter(({ $type }) => $type !== 'deleted'),
				// Backoffice (spec 025): a collection with import or export rows only is a row of the matrix too.
				...((boEnabled.value ? bo!.displayItems.value : []) as unknown as DisplayItem[]),
			],
			'collection',
		);

		return Object.entries(groups)
			.map(([collection, permissions]) => ({
				collection: collectionsStore.getCollection(collection),
				permissions,
			}))
			.filter(({ collection }) => collection !== null) as PermissionGroup[];
	});

	watch(groupedPermissions, (newValue, oldValue) => {
		// Remove local permissions that have since been added to the configured permissions
		localPermissions.value = localPermissions.value.filter(
			(local) => !newValue.find((group) => group.collection.collection === local.collection.collection),
		);

		// Add local permissions that have been removed from the configured permissions for visual consistency
		localPermissions.value.push(
			...oldValue
				.filter((old) => !newValue.find((group) => group.collection.collection === old.collection.collection))
				.map(({ collection }) => ({ collection, permissions: [] })),
		);
	});

	const allPermissions = computed(() =>
		sortBy([...groupedPermissions.value, ...localPermissions.value], 'collection.collection'),
	);

	const regularPermissions = computed(() =>
		allPermissions.value.filter(({ collection }) => !isSystemCollection(collection.collection)),
	);

	const systemPermissions = computed(() =>
		allPermissions.value.filter(({ collection }) => isSystemCollection(collection.collection)),
	);

	return {
		loading,
		addEmptyPermission,
		removeEmptyCollection,
		allPermissions,
		regularPermissions,
		systemPermissions,
	};

	function addEmptyPermission(collection: string) {
		if (groupedPermissions.value.filter((group) => group.collection.collection === collection).length > 0) {
			return;
		}

		const info = collectionsStore.getCollection(collection);
		if (info === null) return;

		localPermissions.value.push({
			collection: info,
			permissions: [],
		});

		nextTick(() => {
			if (!contentEl.value) return;

			const tableRow = permissionsTable.value?.querySelector(`tr[data-collection=${collection}]`);

			if (!tableRow) return;

			/** Header height + additional spacing */
			const TOP_SPACING = 80;
			const tableRowTop = tableRow.getBoundingClientRect().top - TOP_SPACING;

			// Only scroll to row if it is out of view
			if (tableRowTop > 0) return;

			const top = tableRowTop + contentEl.value.scrollTop;

			contentEl.value.scrollTo({ top, behavior: 'smooth' });
		});
	}

	function removeEmptyCollection(collection: string) {
		// Delay this to the next tick, since in the meantime it will have been added to the localPermissions
		nextTick(
			() =>
				(localPermissions.value = localPermissions.value.filter((group) => group.collection.collection !== collection)),
		);
	}
}

const LINK_BTN =
	'cursor-pointer rounded font-medium text-brand-500 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:text-brand-300 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div>
		<BoNotice v-if="adminAccess">
			{{ $t('admins_have_all_permissions') }}
		</BoNotice>

		<div v-else-if="!loading || allPermissions.length > 0" class="permissions-list">
			<div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
				<table
					ref="permissionsTable"
					data-permissions-matrix
					class="w-full border-separate border-spacing-0 text-theme-sm text-gray-700 dark:text-gray-400"
				>
					<caption class="sr-only">{{ $t('permissions') }}</caption>
					<PermissionsHeader :count="matrixActions.length + 1" />

					<tbody>
						<tr v-if="allPermissions.length === 0">
							<td class="empty-state px-3 py-3 text-gray-500 dark:text-gray-400" :colspan="matrixActions.length + 2">
								{{ $t('no_permissions') }}
							</td>
						</tr>

						<PermissionsRow
							v-for="group in regularPermissions"
							:key="group.collection.collection"
							:actions="matrixActions"
							:permissions="group.permissions"
							:collection="group.collection"
							@edit-item="editItem(group.collection.collection, $event)"
							@remove-row="removeCollection(group.collection.collection)"
							@set-full-access-all="setFullAccessAll(group.collection.collection)"
							@set-no-access-all="setNoAccessAll(group.collection.collection)"
							@set-full-access="setFullAccess(group.collection.collection, $event)"
							@set-no-access="setNoAccess(group.collection.collection, $event)"
						/>

						<tr v-if="regularPermissions.length > 0 && systemPermissions.length > 0">
							<td
								:colspan="matrixActions.length + 2"
								class="system-divider border-t border-gray-200 bg-gray-50 px-3 py-2 text-theme-xs font-medium tracking-wide text-gray-500 uppercase dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400"
							>
								{{ $t('system_collections') }}
							</td>
						</tr>

						<PermissionsRow
							v-for="group in systemPermissions"
							:key="group.collection.collection"
							:actions="matrixActions"
							:permissions="group.permissions"
							:collection="group.collection"
							:disabled-actions="disabledFor(group.collection.collection)"
							:app-minimal="
								appAccess
									? appAccessMinimalPermissions.filter(
											(permission) => permission.collection === group.collection.collection,
										)
									: undefined
							"
							@edit-item="editItem(group.collection.collection, $event)"
							@remove-row="removeCollection(group.collection.collection)"
							@set-full-access-all="setFullAccessAll(group.collection.collection)"
							@set-no-access-all="setNoAccessAll(group.collection.collection)"
							@set-full-access="setFullAccess(group.collection.collection, $event)"
							@set-no-access="setNoAccess(group.collection.collection, $event)"
						/>
					</tbody>

					<tfoot v-if="appAccess">
						<tr>
							<td
								:colspan="matrixActions.length + 2"
								class="reset-toggle border-t border-gray-200 px-3 py-3 text-center text-gray-500 dark:border-gray-800 dark:text-gray-400"
							>
								{{ $t('reset_system_permissions_to') }}
								<button type="button" :class="LINK_BTN" @click="resetActive = 'minimum'">
									{{ $t('app_access_minimum') }}
								</button>
								/
								<button type="button" :class="LINK_BTN" @click="resetActive = 'recommended'">
									{{ $t('recommended_defaults') }}
								</button>
							</td>
						</tr>
					</tfoot>
				</table>
			</div>

			<AddCollection
				class="add-collection mt-3"
				:exclude-collections="
					[...regularPermissions, ...systemPermissions].map(({ collection }) => collection.collection)
				"
				@select="addEmptyPermission($event)"
			/>
		</div>

		<PermissionsDetail
			:active="currentlyEditingKey !== null"
			:edits="editsAtStart"
			:permission-key="currentlyEditingKey"
			:policy-key="primaryKey"
			:policy-edits="values"
			:backoffice="editingBackoffice"
			@input="stageEdits"
			@update:active="cancelEdit"
		/>

		<BoDialog
			:open="!!resetActive"
			:title="$t('reset_system_permissions_copy')"
			@update:open="!$event && (resetActive = false)"
		>
			<template #actions>
				<BoButton variant="secondary" @click="resetActive = false">{{ $t('cancel') }}</BoButton>
				<BoButton @click="resetSystemPermissions(resetActive === 'recommended')">{{ $t('reset') }}</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
