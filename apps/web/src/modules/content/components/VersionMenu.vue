<!-- Ported from directus/app/src/modules/content/components/version-menu.vue -->
<script setup lang="ts">
// Backoffice: recipe Q-8 (version menu in the breadcrumb line). The VMenu/VList is a Reka DropdownMenu: main and the
// versions are radio items (the current one checked), the actions are items after a separator, delete/discard in the
// danger colour. The edit dot carries a screen-reader text in place of the Directus tooltip. VDialogs are BoDialogs
// (Esc and outside click cancel, Enter submits the create/rename forms); the delete text is the dialog description. The
// key input is slugified like v-input `slug`, empty inputs are null like its `nullable`; a reserved key also shows
// `reserved_version_key` as the key field error (the tooltip of a disabled button is not reachable by keyboard).
// Requests go through the SDK client and errors to the useNotices dialog (FR-054b). The comparison modal is loaded on
// demand.
import type { ContentVersion, PrimaryKey } from '@directus/types';
import slugify from '@sindresorhus/slugify';
import {
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuRoot,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from 'reka-ui';
import { computed, defineAsyncComponent, ref, toRefs, unref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoInput from '../../../components/BoInput.vue';
import BoTooltip from '../../../components/BoTooltip.vue';
import { showUnexpectedError as unexpectedError } from '../../../composables/use-notices.ts';
import { useCollectionPermissions } from '../../../composables/use-permissions/index.ts';
import { DRAFT_VERSION_KEY } from '../../../constants.ts';
import type { ContentVersionMaybeNew, ContentVersionWithType } from '../../../types/versions.ts';
import { getVersionDisplayName } from '../../../utils/get-version-display-name.ts';

const ComparisonModal = defineAsyncComponent(() => import('../../../components/comparison/ComparisonModal.vue'));

interface Props {
	collection: string;
	primaryKey: PrimaryKey;
	updateAllowed: boolean;
	hasEdits: boolean;
	currentVersion: ContentVersionMaybeNew | null;
	versions: ContentVersionMaybeNew[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
	add: [version: ContentVersion];
	update: [updates: { key: string; name?: string | null }];
	delete: [deleteOnPromote: boolean];
	switch: [version: ContentVersionMaybeNew | null];
}>();

const { collection, primaryKey, hasEdits, currentVersion, versions } = toRefs(props);

const { t } = useI18n();

const createFormId = useId();
const renameFormId = useId();

// Backoffice: radio value of the main version (the radio group needs a string).
const MAIN = '';

const ITEM =
	'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 outline-hidden data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 dark:text-gray-400 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300 dark:data-[disabled]:text-white/15';

const VERSION_ITEM = `${ITEM} data-[state=checked]:bg-brand-50 data-[state=checked]:text-brand-600 dark:data-[state=checked]:bg-brand-500/[0.12] dark:data-[state=checked]:text-brand-400`;

const DANGER_ITEM =
	'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-error-600 outline-hidden data-[highlighted]:bg-error-50 data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 dark:text-error-400 dark:data-[highlighted]:bg-error-500/15 dark:data-[disabled]:text-white/15';

const draftVersion = computed(() => versions.value.find((version) => version.key === DRAFT_VERSION_KEY));
const localVersions = computed(() => versions.value.filter((version) => version.type === 'local'));

const {
	createAllowed: createVersionsAllowed,
	readAllowed: readVersionsAllowed,
	updateAllowed: updateVersionsAllowed,
	deleteAllowed: deleteVersionsAllowed,
} = useCollectionPermissions('directus_versions');

const { switchDialogActive, switchTarget, switchVersion } = useSwitchDialog();

const {
	createDialogActive,
	newVersionKey,
	newVersionName,
	closeCreateDialog,
	creating,
	isCreateDisabled,
	createVersion,
} = useCreateDialog();

const { renameDialogActive, openRenameDialog, closeRenameDialog, updating, renameVersion, isRenameDisabled } =
	useRenameDialog();

const { deleting, deleteVersion } = useDelete();
const { deleteDialogActive, onDeleteVersion } = useDeleteDialog();

const { comparisonModalActive, comparableVersion, onPromoteComplete } = useComparisonDialog();

const { isCurrentVersionGlobal, isCurrentVersionNew, canAccessGlobalVersion, isVersionKeyGlobal, isVersionNew } =
	useGlobalVersions();

const newVersionKeyReservedTooltip = computed(() =>
	isVersionKeyGlobal(newVersionKey.value) ? t('reserved_version_key', { key: newVersionKey.value }) : undefined,
);

const currentVersionName = computed(() => getVersionDisplayName(currentVersion.value));

const checkedValue = computed(() => {
	if (currentVersion.value === null) return MAIN;
	if (currentVersion.value.type === 'global') return currentVersion.value.key;
	return String(currentVersion.value.id);
});

/** Backoffice: v-input `slug` + `nullable`. */
function setNewVersionKey(value: string) {
	newVersionKey.value = slugify(value, { separator: '-', preserveTrailingDash: true }) || null;
}

/** Backoffice: v-input `trim` + `nullable`. */
function trimmedName() {
	return newVersionName.value?.trim() || null;
}

function useSwitchDialog() {
	const switchDialogActive = ref(false);
	const switchTarget = ref<ContentVersionMaybeNew | null>(null);

	return {
		switchDialogActive,
		switchTarget,
		switchVersion,
	};

	function switchVersion(version?: ContentVersionMaybeNew | null) {
		if (version !== undefined) switchTarget.value = version;

		if (hasEdits.value && !switchDialogActive.value) {
			switchDialogActive.value = true;
		} else {
			switchDialogActive.value = false;
			emit('switch', switchTarget.value);
		}
	}
}

function useCreateDialog() {
	const createDialogActive = ref(false);
	const creating = ref(false);
	const newVersionKey = ref<string | null>(null);
	const newVersionName = ref<string | null>(null);
	const isCreateDisabled = computed(() => newVersionKey.value === null || isVersionKeyGlobal(newVersionKey.value));

	watch(
		newVersionName,
		(newName, oldName) => {
			if (
				newName === null ||
				newVersionKey.value ===
					slugify(oldName ?? '', {
						separator: '-',
					})
			) {
				newVersionKey.value = slugify(newName ?? '', {
					separator: '-',
				});
			}
		},
		{ immediate: true },
	);

	return {
		newVersionKey,
		newVersionName,
		createDialogActive,
		creating,
		isCreateDisabled,
		createVersion,
		closeCreateDialog,
	};

	async function createVersion() {
		if (isCreateDisabled.value || creating.value || !newVersionKey.value) return;

		if (!unref(primaryKey) || unref(primaryKey) === '+') return;

		creating.value = true;

		try {
			const version = await sdk.request<ContentVersion>(
				requestEndpoint('/versions', {
					method: 'POST',
					body: {
						key: newVersionKey.value,
						name: isVersionKeyGlobal(newVersionKey.value) ? null : trimmedName(),
						collection: collection.value,
						item: String(primaryKey.value),
					},
				}),
			);

			emit('add', version);

			closeCreateDialog();
		} catch (error) {
			unexpectedError(error);
		} finally {
			creating.value = false;
		}
	}

	function closeCreateDialog() {
		createDialogActive.value = false;
		newVersionKey.value = null;
		newVersionName.value = null;
	}
}

function useRenameDialog() {
	const renameDialogActive = ref(false);
	const updating = ref(false);

	const isRenameDisabled = computed(
		() =>
			((newVersionKey.value === null || newVersionKey.value === currentVersion.value?.key) &&
				newVersionName.value === currentVersion.value?.name) ||
			isVersionKeyGlobal(newVersionKey.value) ||
			!unref(primaryKey) ||
			unref(primaryKey) === '+' ||
			!newVersionKey.value ||
			isCurrentVersionGlobal.value,
	);

	return {
		renameDialogActive,
		updating,
		isRenameDisabled,
		renameVersion,
		openRenameDialog,
		closeRenameDialog,
	};

	async function renameVersion() {
		if (isRenameDisabled.value || updating.value || newVersionKey.value === null || !currentVersion.value?.id) return;

		updating.value = true;

		try {
			const updates = {
				key: newVersionKey.value,
				name: isVersionKeyGlobal(newVersionKey.value) ? null : trimmedName(),
			};

			await sdk.request(
				requestEndpoint(`/versions/${encodeURIComponent(currentVersion.value.id)}`, {
					method: 'PATCH',
					body: updates,
				}),
			);

			emit('update', updates);

			closeRenameDialog();
		} catch (error) {
			unexpectedError(error);
		} finally {
			updating.value = false;
		}
	}

	function openRenameDialog() {
		if (!currentVersion.value) return;
		newVersionKey.value = currentVersion.value.key;
		newVersionName.value = currentVersion.value.name;
		renameDialogActive.value = true;
	}

	function closeRenameDialog() {
		renameDialogActive.value = false;
		newVersionKey.value = null;
		newVersionName.value = null;
	}
}

function useDelete() {
	const deleting = ref(false);

	return {
		deleting,
		deleteVersion,
	};

	async function deleteVersion(deleteOnPromote = false) {
		if (!currentVersion.value) return;

		deleting.value = true;

		try {
			await sdk.request(
				requestEndpoint(`/versions/${encodeURIComponent(currentVersion.value.id)}`, { method: 'DELETE' }),
			);

			emit('delete', deleteOnPromote);
		} catch (error) {
			unexpectedError(error);
		} finally {
			deleting.value = false;
		}
	}
}

function useDeleteDialog() {
	const deleteDialogActive = ref(false);

	return {
		deleteDialogActive,
		onDeleteVersion,
	};

	async function onDeleteVersion() {
		if (deleting.value) return;

		await deleteVersion();
		deleteDialogActive.value = false;
	}
}

function useComparisonDialog() {
	const comparisonModalActive = ref(false);

	const comparableVersion = computed(() => {
		if (currentVersion.value === null) return null;
		if (currentVersion.value.id === '+') return undefined;
		return currentVersion.value as ContentVersionWithType;
	});

	return {
		comparisonModalActive,
		comparableVersion,
		onPromoteComplete,
	};

	async function onPromoteComplete(deleteOnPromote: boolean) {
		comparisonModalActive.value = false;

		if (deleteOnPromote) {
			await deleteVersion(true);
			return;
		}

		emit('switch', null);
	}
}

function useGlobalVersions() {
	const isCurrentVersionGlobal = computed(() => currentVersion.value?.type === 'global');
	const isCurrentVersionNew = computed(() => isVersionNew(currentVersion.value));

	return {
		isCurrentVersionGlobal,
		isCurrentVersionNew,
		canAccessGlobalVersion,
		isVersionKeyGlobal,
		isVersionNew,
	};

	function canAccessGlobalVersion(version: ContentVersionMaybeNew | null): boolean {
		return isVersionNew(version) ? createVersionsAllowed.value : readVersionsAllowed.value;
	}

	function isVersionKeyGlobal(key: ContentVersion['key'] | null) {
		return key !== null && versions.value.find((version) => version.key === key)?.type === 'global';
	}

	function isVersionNew(version: ContentVersionMaybeNew | null) {
		return version?.id === '+';
	}
}

function hasVersionEdits(version: ContentVersionMaybeNew | null) {
	if (!version || isVersionNew(version)) return false;
	return (version as ContentVersion).delta !== null;
}
</script>

<template>
	<div class="version-menu-wrapper flex min-w-0 items-center">
		<span aria-hidden="true" class="hidden pe-0.5 text-gray-500 sm:inline dark:text-gray-400">•</span>

		<DropdownMenuRoot>
			<DropdownMenuTrigger as-child>
				<button
					class="version-button inline-flex h-8 min-w-0 items-center gap-1 rounded-lg px-2 text-theme-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:focus-visible:outline-brand-400"
					type="button"
					:aria-label="`${t('version')}: ${currentVersionName}`"
				>
					<BoIcon name="published_with_changes" size="sm" />
					<span class="version-name truncate">{{ currentVersionName }}</span>
					<BoIcon name="arrow_drop_down" size="sm" />
				</button>
			</DropdownMenuTrigger>

			<DropdownMenuPortal>
				<DropdownMenuContent
					align="start"
					:side-offset="4"
					class="version-list z-99999 max-w-64 min-w-40 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
				>
					<DropdownMenuRadioGroup :model-value="checkedValue">
						<DropdownMenuRadioItem :value="MAIN" :class="['version-item', VERSION_ITEM]" @select="switchVersion(null)">
							<span class="flex w-4 justify-center">
								<span class="edit-dot size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
								<span class="sr-only">{{ t('content_edited') }}</span>
							</span>
							<span class="truncate">{{ t('main_version') }}</span>
						</DropdownMenuRadioItem>

						<DropdownMenuRadioItem
							v-if="draftVersion"
							:value="draftVersion.key"
							:class="['version-item', VERSION_ITEM]"
							:disabled="!canAccessGlobalVersion(draftVersion)"
							@select="switchVersion(draftVersion)"
						>
							<span class="flex w-4 justify-center">
								<template v-if="hasVersionEdits(draftVersion)">
									<span class="edit-dot size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
									<span class="sr-only">{{ t('content_edited') }}</span>
								</template>
							</span>
							<span class="truncate">{{ getVersionDisplayName(draftVersion) }}</span>
						</DropdownMenuRadioItem>

						<DropdownMenuRadioItem
							v-for="versionItem of localVersions"
							:key="versionItem.id"
							:value="String(versionItem.id)"
							:class="['version-item', VERSION_ITEM]"
							@select="switchVersion(versionItem)"
						>
							<span class="flex w-4 justify-center">
								<template v-if="hasVersionEdits(versionItem)">
									<span class="edit-dot size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
									<span class="sr-only">{{ t('content_edited') }}</span>
								</template>
							</span>
							<span class="truncate">{{ getVersionDisplayName(versionItem) }}</span>
						</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>

					<template v-if="createVersionsAllowed">
						<DropdownMenuSeparator class="my-1 border-t border-gray-200 dark:border-gray-800" />

						<DropdownMenuItem :class="ITEM" @select="createDialogActive = true">
							<BoIcon name="add" size="sm" class="text-gray-500 dark:text-gray-400" />
							{{ t('create_version') }}
						</DropdownMenuItem>
					</template>

					<template v-if="currentVersion !== null">
						<DropdownMenuSeparator class="my-1 border-t border-gray-200 dark:border-gray-800" />

						<DropdownMenuItem
							v-if="updateAllowed"
							:class="ITEM"
							:disabled="isCurrentVersionNew"
							@select="comparisonModalActive = true"
						>
							<BoIcon name="arrow_upload_progress" size="sm" class="text-gray-500 dark:text-gray-400" />
							{{ t('promote_version') }}
						</DropdownMenuItem>

						<DropdownMenuItem
							v-if="updateVersionsAllowed && !isCurrentVersionGlobal"
							:class="ITEM"
							@select="openRenameDialog"
						>
							<BoIcon name="edit" size="sm" class="text-gray-500 dark:text-gray-400" />
							{{ t('rename_version') }}
						</DropdownMenuItem>

						<DropdownMenuItem
							v-if="deleteVersionsAllowed"
							:class="['version-delete', DANGER_ITEM]"
							:disabled="isCurrentVersionNew"
							@select="deleteDialogActive = true"
						>
							<BoIcon :name="isCurrentVersionGlobal ? 'undo' : 'delete'" size="sm" />
							{{ t(isCurrentVersionGlobal ? 'discard_changes' : 'delete_version') }}
						</DropdownMenuItem>
					</template>
				</DropdownMenuContent>
			</DropdownMenuPortal>
		</DropdownMenuRoot>

		<ComparisonModal
			v-if="comparableVersion"
			v-model="comparisonModalActive"
			:delete-versions-allowed
			:collection
			:primary-key
			mode="version"
			:current-version="comparableVersion"
			@cancel="comparisonModalActive = false"
			@promote="onPromoteComplete"
		/>

		<BoDialog
			:open="switchDialogActive"
			:title="t('unsaved_changes')"
			:description="
				t('switch_version_copy', {
					version: switchTarget ? switchTarget.name || switchTarget.key : t('main_version'),
				})
			"
			@update:open="switchDialogActive = $event"
		>
			<template #actions>
				<BoButton variant="secondary" @click="switchVersion()">{{ t('switch_version') }}</BoButton>
				<BoButton @click="switchDialogActive = false">{{ t('keep_editing') }}</BoButton>
			</template>
		</BoDialog>

		<BoDialog
			:open="createDialogActive"
			:title="t('create_version')"
			@update:open="$event ? (createDialogActive = true) : closeCreateDialog()"
		>
			<form :id="createFormId" class="grid gap-4" @submit.prevent="createVersion">
				<BoInput
					:model-value="newVersionName"
					:label="t('version_name')"
					:placeholder="t('version_name')"
					autofocus
					:maxlength="255"
					@update:model-value="newVersionName = $event || null"
				/>
				<BoInput
					:model-value="newVersionKey"
					:label="t('version_key')"
					:placeholder="t('version_key')"
					:maxlength="64"
					:error="newVersionKeyReservedTooltip ?? ''"
					@update:model-value="setNewVersionKey"
				/>
			</form>
			<template #actions>
				<BoButton variant="secondary" @click="closeCreateDialog">{{ t('cancel') }}</BoButton>
				<BoTooltip v-if="newVersionKeyReservedTooltip" :text="newVersionKeyReservedTooltip">
					<span>
						<BoButton type="submit" :form="createFormId" disabled>{{ t('save') }}</BoButton>
					</span>
				</BoTooltip>
				<BoButton v-else type="submit" :form="createFormId" :disabled="isCreateDisabled" :loading="creating">
					{{ t('save') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog
			:open="renameDialogActive"
			:title="t('rename_version')"
			@update:open="$event ? (renameDialogActive = true) : closeRenameDialog()"
		>
			<form :id="renameFormId" class="grid gap-4" @submit.prevent="renameVersion">
				<BoInput
					:model-value="newVersionName"
					:label="t('version_name')"
					:placeholder="t('version_name')"
					autofocus
					:maxlength="255"
					@update:model-value="newVersionName = $event || null"
				/>
				<BoInput
					:model-value="newVersionKey"
					:label="t('version_key')"
					:placeholder="t('version_key')"
					:maxlength="64"
					:error="newVersionKeyReservedTooltip ?? ''"
					@update:model-value="setNewVersionKey"
				/>
			</form>
			<template #actions>
				<BoButton variant="secondary" @click="closeRenameDialog">{{ t('cancel') }}</BoButton>
				<BoTooltip v-if="newVersionKeyReservedTooltip" :text="newVersionKeyReservedTooltip">
					<span>
						<BoButton type="submit" :form="renameFormId" disabled>{{ t('save') }}</BoButton>
					</span>
				</BoTooltip>
				<BoButton v-else type="submit" :form="renameFormId" :disabled="isRenameDisabled" :loading="updating">
					{{ t('save') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog
			v-if="currentVersion !== null"
			:open="deleteDialogActive"
			:title="t(isCurrentVersionGlobal ? 'discard_changes' : 'delete_version')"
			:description="
				isCurrentVersionGlobal
					? t('discard_changes_copy')
					: t('delete_version_copy', { version: getVersionDisplayName(currentVersion) })
			"
			@update:open="deleteDialogActive = $event"
		>
			<template #actions>
				<BoButton variant="secondary" @click="deleteDialogActive = false">{{ t('cancel') }}</BoButton>
				<BoButton :loading="deleting" variant="danger" @click="onDeleteVersion">
					{{ t(isCurrentVersionGlobal ? 'discard_label' : 'delete_label') }}
				</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
