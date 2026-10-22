<!-- Ported from directus/app/src/interfaces/file/file.vue -->
<script setup lang="ts">
// Backoffice: the attached v-menu is the Dropdown menu recipe (BoMenu) on a field-like trigger; the edit and deselect
// buttons sit next to the trigger instead of inside it (no nested controls), always visible. The download item opens
// the `?download` asset URL in a new tab (BoMenu links), so the server names the file. The menu divider is left out.
// Import from URL shows its error in the dialog with translateAPIError like BoUpload (Directus: unexpectedError
// snackbar, no notifications store before 018, D-45). The library is DrawerFiles (T069) with the MIME type filter
// merged into `filter` as Directus does.
import type { Filter } from '@directus/types';
import { deepMap } from '@directus/utils';
import { render } from 'micromustache';
import { computed, type FunctionalComponent, inject, ref, toRef, toRefs, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import BoButton from '../../components/BoButton.vue';
import BoDialog from '../../components/BoDialog.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoInput from '../../components/BoInput.vue';
import BoMenu, { type BoMenuItem } from '../../components/BoMenu.vue';
import BoTextOverflow from '../../components/BoTextOverflow.vue';
import DrawerFiles from '../../components/drawers/DrawerFiles.vue';
import DrawerItem from '../../components/drawers/DrawerItem.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import { parseFilter } from '../../components/form/utils/parse-filter.ts';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { useMimeTypeFilter } from '../../composables/use-mime-type-filter.ts';
import { useRelationM2O } from '../../composables/use-relation-m2o.ts';
import { useRelationPermissionsM2O } from '../../composables/use-relation-permissions.ts';
import { type RelationQuerySingle, useRelationSingle } from '../../composables/use-relation-single.ts';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import { readableMimeType } from '../../utils/readable-mime-type.ts';
import BoRemove from '../../components/BoRemove.vue';

type FileInfo = {
	id: string;
	title: string;
	type: string;
	filename_download?: string;
	modified_on?: string | null;
};

const props = withDefaults(
	defineProps<{
		value: string | Record<string, any> | null;
		disabled?: boolean;
		nonEditable?: boolean;
		loading?: boolean;
		folder?: string | undefined;
		filter?: Filter | undefined;
		collection: string;
		field: string;
		enableCreate?: boolean;
		enableSelect?: boolean;
		allowedMimeTypes?: string[] | undefined;
	}>(),
	{
		disabled: false,
		nonEditable: false,
		loading: false,
		enableCreate: true,
		enableSelect: true,
		folder: undefined,
		filter: undefined,
		allowedMimeTypes: undefined,
	},
);

defineOptions({ name: 'InterfaceFile' });

const emit = defineEmits<{
	input: [value: string | Record<string, any> | null];
}>();

const { t } = useI18n();

const a11y = inject(FORM_FIELD_A11Y, null);
const titleId = useId();

const value = computed({
	get: () => props.value,
	set: (value) => {
		emit('input', value);
	},
});

const { mimeTypeFilter, combinedAcceptString } = useMimeTypeFilter(toRef(props, 'allowedMimeTypes'));

const query = ref<RelationQuerySingle>({
	fields: ['id', 'title', 'type', 'filename_download', 'modified_on'],
});

const { collection, field } = toRefs(props);
const { relationInfo } = useRelationM2O(collection, field);

const activeDialog = ref<'upload' | 'choose' | 'url' | null>(null);

const {
	displayItem: file,
	loading,
	update,
	remove,
} = useRelationSingle<FileInfo>(value, query, relationInfo, {
	enabled: computed(() => !props.loading),
});

const { createAllowed } = useRelationPermissionsM2O(relationInfo);

const fileExtension = computed(() => {
	if (file.value === null) return null;
	return readableMimeType(file.value.type, true);
});

const imageThumbnail = computed(() => {
	if (file.value === null || props.value === null) return null;

	if (file.value.type.includes('image') === false) return null;

	if (file.value.type.includes('svg')) {
		return getAssetUrl(file.value.id, {
			cacheBuster: file.value.modified_on ?? false,
		});
	}

	return getAssetUrl(file.value.id, {
		imageKey: 'system-small-cover',
		cacheBuster: file.value.modified_on ?? false,
	});
});

const imageThumbnailError = ref<any>(null);

const { url, isValidURL, loading: urlLoading, error: urlError, importFromURL } = useURLImport();

const editDrawerActive = ref(false);

const edits = computed(() => {
	if (!props.value || typeof props.value !== 'object') return {};

	return props.value;
});

const values = inject('values', ref<Record<string, unknown>>({}));

const customFilter = computed(() => {
	const filter = parseFilter(
		deepMap(props.filter, (val: unknown) => {
			if (val && typeof val === 'string') {
				return render(val, values.value);
			}

			return val;
		}),
	);

	if (!mimeTypeFilter.value) return filter;
	if (!filter) return mimeTypeFilter.value;

	return {
		_and: [filter, mimeTypeFilter.value],
	};
});

const internalDisabled = computed(() => {
	return props.disabled || (props.enableCreate === false && props.enableSelect === false);
});

function setSelection(selection: (string | number)[] | null) {
	if (selection![0]) {
		update(selection![0]);
	} else {
		remove();
	}
}

function onUpload(fileInfo: Record<string, any> | Record<string, any>[] | null) {
	// Backoffice: BoUpload emits null when the upload failed (its error stays in the dialog).
	if (!fileInfo || Array.isArray(fileInfo)) return;

	file.value = fileInfo as FileInfo;
	activeDialog.value = null;
	update(fileInfo['id']);
}

function useURLImport() {
	const url = ref('');
	const loading = ref(false);
	const error = ref<string | null>(null);

	const isValidURL = computed(() => {
		try {
			new URL(url.value);
			return true;
		} catch {
			return false;
		}
	});

	return { url, loading, error, isValidURL, importFromURL };

	async function importFromURL() {
		if (!isValidURL.value || loading.value) return;

		loading.value = true;
		error.value = null;

		try {
			const response = await sdk.request(
				requestEndpoint<FileInfo>('/files/import', {
					method: 'POST',
					body: {
						url: url.value,
						data: {
							folder: props.folder,
						},
						options: { filterMimeType: props.allowedMimeTypes },
					},
				}),
			);

			file.value = response;

			activeDialog.value = null;
			url.value = '';
			update(file.value.id);
		} catch (err) {
			error.value = translateAPIError(err as APIError);
		} finally {
			loading.value = false;
		}
	}
}

const menuItems = computed<BoMenuItem[]>(() => {
	const items: BoMenuItem[] = [];

	if (file.value) {
		items.push({
			text: t('download_file'),
			icon: 'get_app',
			href: getAssetUrl(file.value.id, { isDownload: true }),
		});
	}

	if (!internalDisabled.value) {
		if (createAllowed.value && props.enableCreate) {
			items.push({
				text: t(file.value ? 'replace_from_device' : 'upload_from_device'),
				icon: 'phonelink',
				onSelect: () => (activeDialog.value = 'upload'),
			});
		}

		if (props.enableSelect) {
			items.push({
				text: t(file.value ? 'replace_from_library' : 'choose_from_library'),
				icon: 'folder_open',
				onSelect: () => (activeDialog.value = 'choose'),
			});
		}

		if (createAllowed.value && props.enableCreate) {
			items.push({
				text: t(file.value ? 'replace_from_url' : 'import_from_url'),
				icon: 'link',
				onSelect: () => (activeDialog.value = 'url'),
			});
		}
	}

	return items;
});

// Directus: the menu is disabled while loading or internalDisabled; a non-editable field opens the details instead.
const menuEnabled = computed(() => !props.nonEditable && !loading.value && !internalDisabled.value);
const activatorDisabled = computed(() => !(props.nonEditable && file.value) && internalDisabled.value);

const urlFormId = useId();

// The trigger without the menu (non-editable or disabled field).
const Plain: FunctionalComponent = (_, { slots }) => slots['trigger']?.();

const ROW =
	'flex h-11 w-full items-center gap-2 rounded-lg border border-gray-300 bg-transparent px-2 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900';
const ROW_DISABLED = 'cursor-not-allowed border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]';
const ACTIVATOR =
	'flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-md text-start text-sm text-gray-800 disabled:cursor-not-allowed disabled:text-gray-500 dark:text-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ICON_BTN =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div class="file">
		<div
			v-if="loading"
			class="h-11 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5"
			aria-busy="true"
		/>

		<div
			v-else
			:class="[ROW, activatorDisabled && ROW_DISABLED, a11y?.invalid && 'border-error-600 dark:border-error-400']"
		>
			<component :is="menuEnabled ? BoMenu : Plain" v-bind="menuEnabled ? { items: menuItems } : {}">
				<template #trigger>
					<button
						type="button"
						class="activator"
						:class="ACTIVATOR"
						:aria-labelledby="a11y ? `${a11y.labelId} ${titleId}` : undefined"
						:aria-describedby="a11y?.describedBy"
						:aria-invalid="a11y?.invalid || undefined"
						:disabled="activatorDisabled"
						@click="nonEditable && file ? (editDrawerActive = true) : undefined"
					>
						<span
							class="preview flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md"
							:class="[
								file ? 'bg-brand-50 dark:bg-brand-500/15' : 'bg-gray-100 dark:bg-white/5',
								{ 'is-svg p-1': file?.type?.includes('svg') },
							]"
						>
							<img
								v-if="imageThumbnail && !imageThumbnailError"
								:src="imageThumbnail"
								:alt="file?.title"
								class="h-full w-full"
								:class="file?.type?.includes('svg') ? 'object-contain' : 'object-cover'"
								@error="imageThumbnailError = $event"
							/>
							<span
								v-else-if="fileExtension"
								class="extension text-[0.625rem] font-semibold uppercase text-brand-600 dark:text-brand-400"
							>
								{{ fileExtension }}
							</span>
							<BoIcon v-else name="folder_open" size="sm" class="text-gray-500 dark:text-gray-400" />
						</span>

						<span :id="titleId" class="min-w-0 flex-1">
							<BoTextOverflow v-if="file?.title" :text="file.title" />
							<BoTextOverflow
								v-else
								class="placeholder text-gray-500 dark:text-gray-400"
								:text="$t('no_file_selected')"
							/>
						</span>
					</button>
				</template>
			</component>

			<div v-if="!nonEditable" class="item-actions flex shrink-0 items-center gap-1">
				<template v-if="file">
					<button
						type="button"
						class="edit"
						:class="ICON_BTN"
						:disabled="internalDisabled"
						:aria-label="$t('edit_item')"
						:title="internalDisabled ? undefined : $t('edit_item')"
						@click="editDrawerActive = true"
					>
						<BoIcon name="edit" size="sm" />
					</button>

					<BoRemove
						class="deselect"
						:item-info="relationInfo"
						:item-edits="edits"
						deselect
						:disabled="internalDisabled"
						@action="remove"
					/>
				</template>

				<BoIcon v-else name="attach_file" size="sm" class="me-1.5 text-gray-500 dark:text-gray-400" />
			</div>
		</div>

		<DrawerItem
			v-if="file"
			v-model:active="editDrawerActive"
			collection="directus_files"
			:primary-key="file.id"
			:edits="edits"
			:disabled="internalDisabled"
			:non-editable="nonEditable"
			@input="update"
		>
			<template #actions>
				<BoButton
					variant="secondary"
					icon="download"
					:aria-label="$t('download')"
					:href="getAssetUrl(file.id, { isDownload: true })"
					:download="file.filename_download"
				/>
			</template>
		</DrawerItem>

		<BoDialog :open="activeDialog === 'upload'" :title="$t('upload_from_device')" @update:open="activeDialog = null">
			<BoUpload from-url :folder="folder" :accept="combinedAcceptString" @input="onUpload" />
			<template #actions>
				<BoButton variant="secondary" @click="activeDialog = null">{{ $t('cancel') }}</BoButton>
			</template>
		</BoDialog>

		<DrawerFiles
			v-if="activeDialog === 'choose'"
			:folder="folder"
			:field="field"
			:active="activeDialog === 'choose'"
			:filter="customFilter"
			@update:active="activeDialog = null"
			@input="setSelection"
		/>

		<BoDialog
			:open="activeDialog === 'url'"
			:title="$t('import_from_url')"
			@update:open="!urlLoading && (activeDialog = null)"
		>
			<form :id="urlFormId" @submit.prevent="importFromURL">
				<BoInput
					v-model="url"
					type="url"
					autofocus
					:label="$t('url')"
					:placeholder="$t('url')"
					:disabled="urlLoading"
				/>
			</form>
			<p v-if="urlError" role="alert" class="mt-1.5 text-theme-xs text-error-600 dark:text-error-400">{{ urlError }}</p>
			<template #actions>
				<BoButton variant="secondary" :disabled="urlLoading" @click="activeDialog = null">
					{{ $t('cancel') }}
				</BoButton>
				<BoButton type="submit" :form="urlFormId" :loading="urlLoading" :disabled="isValidURL === false">
					{{ $t('import_label') }}
				</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
