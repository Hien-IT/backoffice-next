<!-- Ported from directus/app/src/modules/files/routes/collection.vue -->
<script setup lang="ts">
// Backoffice: user stories 1 and 2 of feature 015 (FR-010 to FR-021). Layouts render from the registry as the Content
// collection screen (014 research R4); the folder cards go in the cards `prepend` slot with `extraSelection`
// (FR-012, FR-013). Errors of batch actions open the error dialog (showUnexpectedError, D-66). The drop notice and the
// upload progress are in-place notices above the layout with `aria-live` (recipe Q-14, D-66) instead of the
// notifications store; the drop border is four fixed bars around `<main>` (`aria-hidden`). Downloads go through
// apiFetch + file-saver (saveResponse) instead of a temporary link (the API may be on another origin).
import type { Filter, PrimaryKey } from '@directus/types';
import { getDateTimeFormatted, mergeFilters } from '@directus/utils';
import { useEventListener } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, onBeforeRouteUpdate, RouterView, useRouter } from 'vue-router';
import { apiFetch, requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoInfo from '../../../components/BoInfo.vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoProgressLinear from '../../../components/BoProgressLinear.vue';
import SearchInput from '../../../components/SearchInput.vue';
import DrawerBatch from '../../../components/drawers/DrawerBatch.vue';
import FilesNavigation from '../../../components/files/FilesNavigation.vue';
import FolderPicker from '../../../components/files/FolderPicker.vue';
import ExportSidebarDetail from '../../../components/sidebar/ExportSidebarDetail.vue';
import LayoutSidebarDetail from '../../../components/sidebar/LayoutSidebarDetail.vue';
import { type Folder, useFolders } from '../../../composables/use-folders.ts';
import { showUnexpectedError } from '../../../composables/use-notices.ts';
import { useCollectionPermissions } from '../../../composables/use-permissions/index.ts';
import { usePreset } from '../../../composables/use-preset.ts';
import PrivateView from '../../../layout/PrivateView.vue';
import { getLayout } from '../../../layouts/index.ts';
import { useLayout } from '../../../layouts/use-layout.ts';
import { useFilesStore } from '../../../stores/files.ts';
import { useServerStore } from '../../../stores/server.ts';
import { useUserStore } from '../../../stores/user.ts';
import type { SpecialFolder } from '../../../types/folders.ts';
import { getFolderFilter } from '../../../utils/get-folder-filter.ts';
import { saveResponse } from '../../../utils/save-response.ts';
import { uploadFiles } from '../../../utils/upload-files.ts';
import AddFolder from '../components/AddFolder.vue';
import DeleteFolderDialog from '../components/DeleteFolderDialog.vue';
import FolderSection from '../components/FolderSection.vue';

const props = defineProps<{
	folder?: string | undefined;
	special?: SpecialFolder | undefined;
}>();

const { t } = useI18n();

const router = useRouter();

const { info } = useServerStore();
const { folders, fetchFolders } = useFolders();

const layoutRef = ref();
const selection = ref<(string | number)[]>([]);
const folderSelection = ref<(string | number)[]>([]);
const selectedFolderObjects = computed(() => (folders.value ?? []).filter((f) => folderSelection.value.includes(f.id)));

const userStore = useUserStore();

const { layout, layoutOptions, layoutQuery, filter, search, resetPreset } = usePreset(ref('directus_files'));

// Backoffice: the layout config whose component and slots render inside the wrapper (cards when unknown, the files
// default of the presets store).
const currentLayout = computed(() => getLayout(layout.value) ?? getLayout('cards'));

const confirmDelete = ref(false);
const batchEditActive = ref(false);
const isTransitioning = ref(false);

const { breadcrumb, title } = useBreadcrumb();

const currentUserId = computed(() => {
	const user = userStore.currentUser;
	return user && 'id' in user ? user.id : undefined;
});

const folderFilter = computed<Filter>(() => {
	return getFolderFilter(props.folder, props.special, currentUserId.value);
});

const subfolders = computed(() => {
	if (props.special || !folders.value) return [];
	return folders.value.filter((f) => (f.parent ?? null) === (props.folder ?? null));
});

const { layoutWrapper } = useLayout(layout);

const { moveToDialogActive, moveToFolder, moving, selectedFolder } = useMovetoFolder();

onBeforeRouteLeave(() => {
	selection.value = [];
	folderSelection.value = [];
	confirmDelete.value = false;
});

onBeforeRouteUpdate(() => {
	selection.value = [];
	folderSelection.value = [];
	confirmDelete.value = false;
});

watch(
	() => [props.folder, props.special],
	() => {
		isTransitioning.value = true;
	},
	{ flush: 'sync' },
);

const { isAnyUploadActive, showDropEffect, dragging, uploadProgress, dropBox } = useFileUpload();

watch(isAnyUploadActive, (isUploading, wasUploading) => {
	if (wasUploading && !isUploading) {
		refresh();
	}
});

// Refresh file list when folders change (e.g. sidebar delete moves files into current folder)
watch(folders, (_newVal, oldVal) => {
	if (oldVal === null) return; // skip initial load
	refresh();
});

watch(
	() => layoutRef.value?.state?.items,
	() => {
		isTransitioning.value = false;
	},
);

const {
	updateAllowed: batchEditAllowed,
	deleteAllowed: batchDeleteAllowed,
	createAllowed,
} = useCollectionPermissions('directus_files');

const { createAllowed: createFolderAllowed, deleteAllowed: folderDeleteAllowed } =
	useCollectionPermissions('directus_folders');

const addFileLink = computed(() => (props.folder ? `/files/folders/${props.folder}/+` : '/files/+'));

async function onFolderDeleteDone() {
	try {
		if (selection.value.length > 0) {
			await sdk.request(requestEndpoint('/files', { method: 'DELETE', body: selection.value }));
		}
	} catch (e) {
		showUnexpectedError(e);
	}

	selection.value = [];
	folderSelection.value = [];
	confirmDelete.value = false;
	fetchFolders();
}

const deletingFiles = ref(false);

async function batchDeleteFiles() {
	if (deletingFiles.value) return;
	deletingFiles.value = true;

	try {
		await sdk.request(requestEndpoint('/files', { method: 'DELETE', body: selection.value }));
		selection.value = [];
		confirmDelete.value = false;
		await refresh();
	} catch (e) {
		showUnexpectedError(e);
	} finally {
		deletingFiles.value = false;
	}
}

function useBreadcrumb() {
	const title = computed(() => {
		if (props.special === 'all') {
			return t('all_files');
		}

		if (props.special === 'mine') {
			return t('my_files');
		}

		if (props.special === 'recent') {
			return t('recent_files');
		}

		if (props.folder) {
			const folder = folders.value?.find((folder: Folder) => folder.id === props.folder);

			if (folder) {
				return folder.name;
			}
		}

		return t('file_library');
	});

	const breadcrumb = computed(() => {
		if (title.value !== t('file_library')) {
			return [
				{
					name: t('file_library'),
					to: `/files`,
				},
			];
		}

		return undefined;
	});

	return { breadcrumb, title };
}

function useMovetoFolder() {
	const moveToDialogActive = ref(false);
	const moving = ref(false);
	const selectedFolder = ref<string | null>(null);

	return { moveToDialogActive, moving, moveToFolder, selectedFolder };

	async function moveToFolder() {
		if (moving.value) return;

		moving.value = true;

		try {
			await sdk.request(
				requestEndpoint(`/files`, {
					method: 'PATCH',
					body: {
						keys: selection.value,
						data: {
							folder: selectedFolder.value,
						},
					},
				}),
			);

			selection.value = [];

			if (selectedFolder.value) {
				router.push({ name: 'folders-collection', params: { folder: selectedFolder.value } });
			}

			await nextTick();
			await refresh();
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			moveToDialogActive.value = false;
			moving.value = false;
		}
	}
}

async function refresh() {
	await layoutRef.value?.state?.refresh?.();
}

function clearFilters() {
	filter.value = null;
	search.value = null;
}

function useFileUpload() {
	const filesStore = useFilesStore();
	const { isAnyUploadActive } = storeToRefs(filesStore);
	const newUpload = filesStore.upload();

	const showDropEffect = ref(false);
	const uploadProgress = ref<{ done: number; total: number; percentage: number } | null>(null);
	const dropBox = ref<DOMRect | null>(null);

	const dragCounter = ref(0);

	const dragging = computed(() => dragCounter.value > 0);

	useEventListener(window, 'dragenter', onDragEnter);
	useEventListener(window, 'dragover', onDragOver);
	useEventListener(window, 'dragleave', onDragLeave);
	useEventListener(window, 'drop', onDrop);

	return { isAnyUploadActive, showDropEffect, dragging, uploadProgress, dropBox };

	function enableDropEffect() {
		dropBox.value = document.querySelector('main')?.getBoundingClientRect() ?? null;
		showDropEffect.value = true;
	}

	function disableDropEffect() {
		showDropEffect.value = false;
	}

	function onDragEnter(event: DragEvent) {
		if (!event.dataTransfer) return;
		if (event.dataTransfer?.types.indexOf('Files') === -1) return;

		event.preventDefault();
		dragCounter.value++;

		const isDropzone = event.target && (event.target as HTMLElement).getAttribute?.('data-dropzone') === '';

		if (dragCounter.value === 1 && showDropEffect.value === false && isDropzone === false) {
			enableDropEffect();
		}

		if (isDropzone) {
			disableDropEffect();
			dragCounter.value = 0;
		}
	}

	function onDragOver(event: DragEvent) {
		if (!event.dataTransfer) return;
		if (event.dataTransfer?.types.indexOf('Files') === -1) return;

		event.preventDefault();
	}

	function onDragLeave(event: DragEvent) {
		if (!event.dataTransfer) return;
		if (event.dataTransfer?.types.indexOf('Files') === -1) return;

		event.preventDefault();
		dragCounter.value--;

		if (dragCounter.value === 0) {
			disableDropEffect();
		}

		if (event.target && (event.target as HTMLElement).getAttribute?.('data-dropzone') === '') {
			enableDropEffect();
			dragCounter.value = 1;
		}
	}

	async function onDrop(event: DragEvent) {
		if (!event.dataTransfer) return;
		if (event.dataTransfer?.types.indexOf('Files') === -1) return;

		event.preventDefault();
		showDropEffect.value = false;

		dragCounter.value = 0;

		const files = Array.from(event.dataTransfer.files).filter((file) => file.type);

		if (files.length === 0) return;

		uploadProgress.value = { done: 0, total: files.length, percentage: 0 };

		const preset = props.folder ? { folder: props.folder } : undefined;

		try {
			newUpload.start(files.length);

			await uploadFiles(files, {
				...(preset && { preset }),
				maxConcurrency: info.uploads?.maxConcurrency,
				onProgressChange: (progress) => {
					const percentageDone = progress.reduce((val, cur) => (val += cur)) / progress.length;

					uploadProgress.value = {
						done: progress.filter((p) => p === 100).length,
						total: files.length,
						percentage: Math.round(percentageDone),
					};
				},
			});
		} finally {
			newUpload.finish();
			uploadProgress.value = null;
		}
	}
}

async function downloadFiles() {
	try {
		const response =
			selection.value.length === 1
				? await apiFetch(`/assets/${selection.value[0]}?download=`)
				: await apiFetch('/assets/files?download=', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ ids: selection.value }),
					});

		await saveResponse(response, `unknown-${getDateTimeFormatted()}`);
	} catch (error) {
		showUnexpectedError(error);
	}
}

const DROP_BAR = 'pointer-events-none fixed z-99999 bg-brand-500';
</script>

<template>
	<component
		:is="layoutWrapper"
		ref="layoutRef"
		v-slot="{ layoutState }"
		v-model:selection="selection"
		v-model:layout-options="layoutOptions"
		v-model:layout-query="layoutQuery"
		:filter="mergeFilters(filter, folderFilter)"
		:filter-user="filter"
		:filter-system="folderFilter"
		:search="search"
		collection="directus_files"
		:select-mode="folderSelection.length > 0"
		:reset-preset="resetPreset"
		:clear-filters="clearFilters"
	>
		<PrivateView :title="title" icon="folder" :breadcrumb="breadcrumb" :class="{ dragging }">
			<template #actions>
				<component :is="currentLayout?.slots.actions" v-if="currentLayout?.slots.actions" v-bind="layoutState" />

				<SearchInput v-model="search" v-model:filter="filter" collection="directus_files" />

				<AddFolder :parent="folder" :disabled="createFolderAllowed !== true" />

				<BoButton
					v-if="selection.length > 0 && folderSelection.length === 0"
					variant="secondary"
					icon="folder_move"
					:aria-label="batchEditAllowed ? $t('move_to_folder') : $t('not_allowed')"
					:title="batchEditAllowed ? $t('move_to_folder') : $t('not_allowed')"
					:disabled="!batchEditAllowed"
					@click="moveToDialogActive = true"
				/>

				<BoButton
					v-if="selection.length > 0 || folderSelection.length > 0"
					variant="secondary"
					icon="delete"
					class="hover:bg-error-600 hover:text-white"
					:aria-label="
						batchDeleteAllowed && (folderSelection.length === 0 || folderDeleteAllowed)
							? $t('delete_label')
							: $t('not_allowed')
					"
					:title="
						batchDeleteAllowed && (folderSelection.length === 0 || folderDeleteAllowed)
							? $t('delete_label')
							: $t('not_allowed')
					"
					:disabled="batchDeleteAllowed !== true || (folderSelection.length > 0 && folderDeleteAllowed !== true)"
					@click="confirmDelete = true"
				/>

				<BoButton
					v-if="selection.length > 0 && folderSelection.length === 0"
					variant="secondary"
					icon="edit"
					:aria-label="batchEditAllowed ? $t('edit') : $t('not_allowed')"
					:title="batchEditAllowed ? $t('edit') : $t('not_allowed')"
					:disabled="batchEditAllowed === false"
					@click="batchEditActive = true"
				/>

				<BoButton
					v-if="selection.length > 0 && folderSelection.length === 0"
					variant="secondary"
					icon="download"
					:aria-label="$t('download')"
					:title="$t('download')"
					@click="downloadFiles"
				/>

				<BoButton
					icon="add"
					v-bind="createAllowed ? { to: addFileLink } : {}"
					:disabled="createAllowed === false"
					:aria-label="createAllowed ? $t('upload_file') : $t('not_allowed')"
					:title="createAllowed ? $t('upload_file') : $t('not_allowed')"
				/>
			</template>

			<template #navigation>
				<FilesNavigation :current-folder="folder" :current-special="special" />
			</template>

			<div aria-live="polite" class="empty:hidden mb-4 flex flex-col gap-3">
				<BoNotice v-if="showDropEffect" icon="cloud_upload">{{ $t('drop_to_upload') }}</BoNotice>
				<BoNotice v-if="uploadProgress">
					<span class="flex flex-col gap-2">
						<span>
							{{
								$t(
									'upload_files_indeterminate',
									{ done: uploadProgress.done, total: uploadProgress.total },
									uploadProgress.total,
								)
							}}
						</span>
						<BoProgressLinear :value="uploadProgress.percentage" />
					</span>
				</BoNotice>
			</div>

			<component
				:is="currentLayout?.component"
				v-bind="layoutState"
				v-model:extra-selection="folderSelection"
				:loading="layoutState.loading || isTransitioning"
				:has-prepend-content="!isTransitioning && subfolders.length > 0 && !search && !filter"
				:select-mode="layoutState.selectMode"
				@select-all="folderSelection = subfolders.map((f) => f.id)"
			>
				<template v-if="!special && !search && !filter" #prepend>
					<FolderSection
						v-model:selection="folderSelection"
						:subfolders="subfolders"
						:any-selection="selection.length > 0"
					/>
				</template>

				<template #no-results>
					<BoInfo v-if="!filter && !search" :title="$t('file_count', 0)" icon="folder">
						{{ $t('no_files_copy') }}

						<template #append>
							<BoButton :to="addFileLink">{{ $t('add_file') }}</BoButton>
						</template>
					</BoInfo>

					<BoInfo v-else :title="$t('no_results')" icon="search">
						{{ $t('no_results_copy') }}

						<template #append>
							<BoButton @click="clearFilters">{{ $t('clear_filters') }}</BoButton>
						</template>
					</BoInfo>
				</template>

				<template #no-items>
					<BoInfo :title="$t('file_count', 0)" icon="folder">
						{{ $t('no_files_copy') }}

						<template #append>
							<BoButton
								v-bind="createAllowed ? { to: addFileLink } : {}"
								:disabled="createAllowed === false"
								:title="createAllowed ? $t('add_file') : $t('not_allowed')"
							>
								{{ $t('add_file') }}
							</BoButton>
						</template>
					</BoInfo>
				</template>
			</component>

			<RouterView name="addNew" :folder="folder" @upload="refresh" />

			<BoDialog v-model:open="moveToDialogActive" :title="$t('move_to_folder')">
				<FolderPicker v-model="selectedFolder" />
				<template #actions>
					<BoButton variant="secondary" @click="moveToDialogActive = false">{{ $t('cancel') }}</BoButton>
					<BoButton :loading="moving" @click="moveToFolder">{{ $t('move') }}</BoButton>
				</template>
			</BoDialog>

			<DeleteFolderDialog
				v-if="folderSelection.length > 0"
				v-model="confirmDelete"
				:folders="selectedFolderObjects"
				:all-folders="folders ?? []"
				@done="onFolderDeleteDone"
			/>

			<BoDialog
				v-if="folderSelection.length === 0 && selection.length > 0"
				v-model:open="confirmDelete"
				:title="$t('batch_delete_confirm', selection.length)"
			>
				<template #actions>
					<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
					<BoButton variant="danger" :loading="deletingFiles" @click="batchDeleteFiles">
						{{ $t('delete_label') }}
					</BoButton>
				</template>
			</BoDialog>

			<DrawerBatch
				v-model:active="batchEditActive"
				:primary-keys="selection as PrimaryKey[]"
				collection="directus_files"
				@refresh="refresh"
			/>

			<template #sidebar>
				<LayoutSidebarDetail v-model="layout">
					<component :is="currentLayout?.slots.options" v-if="currentLayout?.slots.options" v-bind="layoutState" />
				</LayoutSidebarDetail>
				<component :is="currentLayout?.slots.sidebar" v-if="currentLayout?.slots.sidebar" v-bind="layoutState" />
				<ExportSidebarDetail
					collection="directus_files"
					:layout-query="layoutQuery"
					:filter="mergeFilters(filter, folderFilter) ?? undefined"
					:search="search ?? undefined"
					@refresh="refresh"
				/>
			</template>

			<template v-if="showDropEffect && dropBox">
				<div
					aria-hidden="true"
					:class="DROP_BAR"
					:style="{ top: `${dropBox.top}px`, left: `${dropBox.left}px`, width: `${dropBox.width}px`, height: '2px' }"
				/>
				<div
					aria-hidden="true"
					:class="DROP_BAR"
					:style="{ top: `${dropBox.top}px`, left: `${dropBox.right - 2}px`, width: '2px', height: `${dropBox.height}px` }"
				/>
				<div
					aria-hidden="true"
					:class="DROP_BAR"
					:style="{ top: `${dropBox.bottom - 2}px`, left: `${dropBox.left}px`, width: `${dropBox.width}px`, height: '2px' }"
				/>
				<div
					aria-hidden="true"
					:class="DROP_BAR"
					:style="{ top: `${dropBox.top}px`, left: `${dropBox.left}px`, width: '2px', height: `${dropBox.height}px` }"
				/>
			</template>
		</PrivateView>
	</component>
</template>
