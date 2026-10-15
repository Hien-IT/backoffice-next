<!-- Ported from directus/app/src/modules/files/routes/item.vue -->
<script setup lang="ts">
// Backoffice: user story 2 of feature 015 (FR-030 to FR-039), recipe "File page and file details" (Q-15). The form is
// BoForm on use-item of 014 with the Directus field deny list; no collaboration (D-68), so no collab header, collision
// modal or collab dialogs; the unsaved-changes dialog puts "keep editing" first (D-76). There is no new-file state:
// `/files/+` is the upload dialog of the library (CHK014). The image editor button comes with the shared editor
// (wave 2, T053). Errors open the error dialog (showUnexpectedError, D-66); the move notice is in place.
import type { Field, File, PrimaryKey } from '@directus/types';
import { computed, ref, toRefs, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { apiFetch, requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import FilePreviewReplace from '../../../components/files/FilePreviewReplace.vue';
import FilesNavigation from '../../../components/files/FilesNavigation.vue';
import FolderPicker from '../../../components/files/FolderPicker.vue';
import BoForm from '../../../components/form/BoForm.vue';
import SaveOptions from '../../../components/SaveOptions.vue';
import CommentsSidebarDetail from '../../../components/sidebar/CommentsSidebarDetail.vue';
import RevisionsSidebarDetail from '../../../components/sidebar/RevisionsSidebarDetail.vue';
import { useEditsGuard } from '../../../composables/use-edits-guard.ts';
import { useItem } from '../../../composables/use-item/index.ts';
import { notify, showUnexpectedError } from '../../../composables/use-notices.ts';
import { useShortcut } from '../../../composables/use-shortcut.ts';
import PrivateView from '../../../layout/PrivateView.vue';
import { getAssetUrl } from '../../../utils/get-asset-url.ts';
import { uploadFile } from '../../../utils/upload-file.ts';
import ContentNotFound from '../../content/routes/ContentNotFound.vue';
import FileInfoSidebarDetail from '../components/FileInfoSidebarDetail.vue';

const props = defineProps<{
	primaryKey: string;
}>();

const { t } = useI18n();

const router = useRouter();

const form = useTemplateRef<InstanceType<typeof BoForm>>('form');
const { primaryKey } = toRefs(props);
const { breadcrumb } = useBreadcrumb();

const revisionsSidebarDetailRef = ref<InstanceType<typeof RevisionsSidebarDetail> | null>(null);

const {
	isNew,
	edits,
	hasEdits,
	item: rawItem,
	permissions,
	saving,
	loading,
	save,
	remove,
	deleting,
	refresh,
	validationErrors,
} = useItem<File>(ref('directus_files'), primaryKey as unknown as import('vue').Ref<PrimaryKey | null>);

const item = computed(() => rawItem.value as File | null);

const {
	collectionPermissions: { createAllowed, revisionsAllowed },
	itemPermissions: { updateAllowed, deleteAllowed, saveAllowed, fields },
} = permissions;

const isSavable = computed(() => saveAllowed.value && hasEdits.value);

const { confirmLeave, leaveTo } = useEditsGuard(hasEdits);

const confirmDelete = ref(false);

// These are the fields that will be prevented from showing up in the form because they'll be shown in the sidebar
const fieldsDenyList: string[] = [
	'type',
	'width',
	'height',
	'filesize',
	'created_on',
	'uploaded_by',
	'uploaded_on',
	'modified_by',
	'modified_on',
	'duration',
	'folder',
	'charset',
	'embed',
];

const to = computed(() => {
	if (item.value && item.value?.folder) return `/files/folders/${item.value.folder}`;
	else return '/files';
});

const { moveToDialogActive, moveToFolder, moving, selectedFolder } = useMovetoFolder();

useShortcut('meta+s', saveAndStay, form as never);

const fieldsFiltered = computed(() => {
	return fields.value.filter((field: Field) => fieldsDenyList.includes(field.field) === false);
});

function useBreadcrumb() {
	const breadcrumb = computed(() => {
		if (!item?.value?.folder) {
			return [
				{
					name: t('file_library'),
					to: '/files',
				},
			];
		}

		return [
			{
				name: t('file_library'),
				to: { path: `/files/folders/${item.value.folder}` },
			},
		];
	});

	return { breadcrumb };
}

async function saveAndQuit() {
	try {
		await save();
		router.push(to.value);
	} catch {
		// `save` shows the error
	}
}

async function saveAndStay() {
	try {
		await save();
		revisionsSidebarDetailRef.value?.refresh?.();
		refresh();
	} catch {
		// `save` shows the error
	}
}

async function saveAsCopyAndNavigate() {
	saving.value = true;

	try {
		const response = await apiFetch(`/assets/${primaryKey.value}`);
		if (!response.ok) throw { response: { status: response.status } };
		const blob = await response.blob();

		const fileObject = new globalThis.File(
			[blob],
			item.value!.filename_download,
			item.value!.type ? { type: item.value!.type } : {},
		);

		// Only forward user-editable fields (not hidden or readonly in the system definition).
		// filename_disk, server timestamps, file dimensions, etc. are excluded and handled by the upload pipeline.
		const copyableFieldNames = new Set(
			fields.value.filter((field) => !field.meta?.hidden && !field.meta?.readonly).map((field) => field.field),
		);

		// folder and storage are readonly in the form but should carry over to the copy.
		copyableFieldNames.add('folder');
		copyableFieldNames.add('storage');

		const preset: Record<string, any> = {};

		for (const [key, value] of Object.entries(item.value ?? {})) {
			if (copyableFieldNames.has(key)) preset[key] = value;
		}

		Object.assign(preset, edits.value);

		const uploadedFile = await uploadFile(fileObject, {
			preset: preset as Partial<File>,
			onError: showUnexpectedError,
		});

		if (uploadedFile) {
			notify({ title: t('item_create_success', 1), type: 'success' });
			edits.value = {};
			router.push({ name: 'files-item', params: { primaryKey: uploadedFile.id } });
		}
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		saving.value = false;
	}
}

async function deleteAndQuit() {
	if (deleting.value) return;

	try {
		await remove();
		edits.value = {};
		router.replace(to.value);
	} catch {
		// `remove` shows the error
		confirmDelete.value = false;
	}
}

function discardAndLeave() {
	if (!leaveTo.value) return;
	edits.value = {};
	confirmLeave.value = false;
	router.push(leaveTo.value);
}

function discardAndStay() {
	// Backoffice: no collaboration session to discard (D-68): the edits go back to the saved item.
	edits.value = {};
	confirmLeave.value = false;
}

function useMovetoFolder() {
	const moveToDialogActive = ref(false);
	const moving = ref(false);
	const selectedFolder = ref<string | null>(null);

	watch(item, () => {
		selectedFolder.value = (item.value?.folder as string | null) || null;
	});

	return { moveToDialogActive, moving, moveToFolder, selectedFolder };

	async function moveToFolder() {
		if (moving.value) return;

		moving.value = true;

		try {
			const response = await sdk.request(
				requestEndpoint<{ folder: { name: string } | null }>(`/files/${props.primaryKey}`, {
					method: 'PATCH',
					body: {
						folder: selectedFolder.value,
					},
					params: {
						fields: 'folder.name',
					},
				}),
			);

			refresh();
			const folder = response?.folder?.name || t('file_library');

			notify({
				title: t('file_moved', { folder }),
				type: 'success',
			});
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			moveToDialogActive.value = false;
			moving.value = false;
		}
	}
}

function revert(values: Record<string, any>) {
	edits.value = {
		...edits.value,
		...values,
	};
}
</script>

<template>
	<ContentNotFound v-if="!loading && !item" module="files" />
	<PrivateView v-else :title="loading || !item ? $t('loading') : (item.title ?? undefined)" back="/files" :breadcrumb="breadcrumb">
		<template #actions>
			<BoButton
				variant="secondary"
				icon="delete"
				class="hover:bg-error-600 hover:text-white"
				:aria-label="deleteAllowed ? $t('delete_label') : $t('not_allowed')"
				:title="deleteAllowed ? $t('delete_label') : $t('not_allowed')"
				:disabled="item === null || deleteAllowed === false"
				@click="confirmDelete = true"
			/>

			<BoButton
				v-if="isNew === false"
				variant="secondary"
				icon="folder_move"
				:aria-label="item === null || !updateAllowed ? $t('not_allowed') : $t('move_to_folder')"
				:title="item === null || !updateAllowed ? $t('not_allowed') : $t('move_to_folder')"
				:disabled="item === null || !updateAllowed"
				@click="moveToDialogActive = true"
			/>

			<BoButton
				variant="secondary"
				icon="download"
				:aria-label="$t('download')"
				:title="$t('download')"
				:href="getAssetUrl(props.primaryKey, { isDownload: true })"
				:download="item?.filename_download"
			/>

			<div class="flex items-center">
				<BoButton
					icon="check"
					:class="isSavable ? 'rounded-e-none' : ''"
					:aria-label="saveAllowed ? $t('save') : $t('not_allowed')"
					:title="saveAllowed ? $t('save') : $t('not_allowed')"
					:loading="saving"
					:disabled="!isSavable"
					@click="saveAndQuit"
				/>
				<SaveOptions
					v-if="isSavable"
					:disabled-options="createAllowed ? ['save-and-add-new'] : ['save-and-add-new', 'save-as-copy']"
					@save-and-stay="saveAndStay"
					@save-as-copy="saveAsCopyAndNavigate"
					@discard-and-stay="discardAndStay"
				/>
			</div>
		</template>

		<template #navigation>
			<FilesNavigation :current-folder="(item?.folder as string | null) ?? undefined" />
		</template>

		<div class="file-item flex max-w-5xl flex-col gap-8">
			<FilePreviewReplace v-if="item" :disabled="updateAllowed === false" :file="item" @replace="refresh" />

			<BoForm
				ref="form"
				v-model="edits"
				:fields="fieldsFiltered"
				:loading="loading"
				:initial-values="item"
				:primary-key="primaryKey"
				:disabled="updateAllowed === false"
				:validation-errors="validationErrors"
			/>
		</div>

		<BoDialog v-model:open="confirmDelete" :title="$t('delete_are_you_sure')">
			<template #actions>
				<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
				<BoButton variant="danger" :loading="deleting" @click="deleteAndQuit">{{ $t('delete_label') }}</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="moveToDialogActive" :title="$t('move_to_folder')">
			<FolderPicker v-model="selectedFolder" />
			<template #actions>
				<BoButton variant="secondary" @click="moveToDialogActive = false">{{ $t('cancel') }}</BoButton>
				<BoButton :loading="moving" @click="moveToFolder">{{ $t('move') }}</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="confirmLeave" :title="$t('unsaved_changes')" :description="$t('unsaved_changes_copy')">
			<template #actions>
				<!-- Backoffice: the non-discarding button first, it gets the initial focus (D-76). -->
				<BoButton @click="confirmLeave = false">{{ $t('keep_editing') }}</BoButton>
				<BoButton variant="secondary" @click="discardAndLeave">{{ $t('discard_changes') }}</BoButton>
			</template>
		</BoDialog>

		<template #sidebar>
			<FileInfoSidebarDetail :file="item" :is-new="isNew" />
			<RevisionsSidebarDetail
				v-if="isNew === false && revisionsAllowed"
				ref="revisionsSidebarDetailRef"
				collection="directus_files"
				:primary-key="primaryKey"
				@revert="revert"
			/>
			<CommentsSidebarDetail v-if="isNew === false" collection="directus_files" :primary-key="primaryKey" />
		</template>
	</PrivateView>
</template>
