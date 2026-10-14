<!-- Ported from directus/app/src/interfaces/file-image/file-image.vue -->
<script setup lang="ts">
// Backoffice: Image preview recipe (component-specs Tier 3): the title and meta stay under the image and the action
// row is always visible (Directus shows them on hover). No image editor button and no ImageEditor (D-59), so
// `refresh` and `updateAllowed` are not used. The error lookup of a broken image is a GET of the same asset URL
// (contracts/api-calls.md #41) through apiFetch, reading the error code like Directus `api.get`. VUpload with
// `from-library` renders drawer-files itself; here BoUpload emits `library` and DrawerFiles (T069) answers through
// the exposed `setSelection`, with the MIME type filter merged into `filter` as Directus does.
import type { File, Filter } from '@directus/types';
import { deepMap } from '@directus/utils';
import { render } from 'micromustache';
import { computed, inject, ref, toRefs, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiFetch } from '../../api/sdk.ts';
import BoButton from '../../components/BoButton.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoNotice from '../../components/BoNotice.vue';
import DrawerFiles from '../../components/drawers/DrawerFiles.vue';
import DrawerItem from '../../components/drawers/DrawerItem.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import FileLightbox from '../../components/files/FileLightbox.vue';
import { parseFilter } from '../../components/form/utils/parse-filter.ts';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { useMimeTypeFilter } from '../../composables/use-mime-type-filter.ts';
import { useRelationM2O } from '../../composables/use-relation-m2o.ts';
import { useRelationPermissionsM2O } from '../../composables/use-relation-permissions.ts';
import { type RelationQuerySingle, useRelationSingle } from '../../composables/use-relation-single.ts';
import { formatFilesize } from '../../utils/format-filesize.ts';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import { readableMimeType } from '../../utils/readable-mime-type.ts';
import BoRemove from '../../components/BoRemove.vue';

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
		width?: string | undefined;
		crop?: boolean;
		letterbox?: boolean;
		enableCreate?: boolean;
		enableSelect?: boolean;
		allowedMimeTypes?: string[] | undefined;
	}>(),
	{
		disabled: false,
		loading: false,
		crop: true,
		enableCreate: true,
		enableSelect: true,
		nonEditable: false,
		folder: undefined,
		filter: undefined,
		width: undefined,
		allowedMimeTypes: undefined,
	},
);

defineOptions({ name: 'InterfaceFileImage' });

const emit = defineEmits<{
	input: [value: string | Record<string, any> | null];
}>();

const a11y = inject(FORM_FIELD_A11Y, null);

const value = computed({
	get: () => props.value,
	set: (value) => {
		emit('input', value);
	},
});

const query = ref<RelationQuerySingle>({
	fields: ['id', 'title', 'width', 'height', 'filesize', 'type', 'filename_download', 'modified_on'],
});

const { collection, field } = toRefs(props);
const { relationInfo } = useRelationM2O(collection, field);

type Image = Pick<
	File,
	'id' | 'title' | 'width' | 'height' | 'filesize' | 'type' | 'filename_download' | 'modified_on'
>;

const {
	displayItem: image,
	loading,
	update,
	remove,
} = useRelationSingle<Image>(value, query, relationInfo, { enabled: computed(() => !props.loading) });

const isImage = ref(true);

const { n, te } = useI18n();

const lightboxActive = ref(false);
const editDrawerActive = ref(false);
const imageError = ref<string | null>(null);

const src = computed(() => {
	if (!image.value?.type) return null;

	if (image.value.type.includes('svg')) {
		return getAssetUrl(image.value.id);
	}

	if (image.value.type.includes('image')) {
		const fit = props.crop ? 'cover' : 'contain';

		return getAssetUrl(image.value.id, {
			imageKey: `system-large-${fit}`,
			cacheBuster: image.value.modified_on ?? false,
		});
	}

	return null;
});

const ext = computed(() => (image.value?.type ? readableMimeType(image.value.type, true) : 'unknown'));

const meta = computed(() => {
	if (!image.value) return null;
	const { filesize, width, height, type } = image.value;

	if (width && height) {
		return `${n(width)}x${n(height)} • ${formatFilesize(filesize)} • ${type}`;
	}

	return `${formatFilesize(filesize)} • ${type}`;
});

const editImageDetails = ref(false);

const internalDisabled = computed(() => {
	return props.disabled || (props.enableCreate === false && props.enableSelect === false);
});

async function imageErrorHandler() {
	isImage.value = false;
	if (!src.value) return;

	// Backoffice: fetch does not throw on an error status; the error body is read the same way.
	try {
		const response = await apiFetch(src.value);
		if (response.ok) return;
		const body = await response.json().catch(() => null);
		imageError.value = body?.errors?.[0]?.extensions?.code ?? null;
	} catch {
		imageError.value = null;
	}

	if (!imageError.value || !te('errors.' + imageError.value)) {
		imageError.value = 'UNKNOWN';
	}
}

const values = inject('values', ref<Record<string, unknown>>({}));

const { mimeTypeFilter, combinedAcceptString } = useMimeTypeFilter(
	computed(() => (props.allowedMimeTypes?.length ? props.allowedMimeTypes : ['image/*'])),
);

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

function onUpload(image: any) {
	if (image?.id) update(image.id);
}

function deselect() {
	remove();

	loading.value = false;
	lightboxActive.value = false;
	editDrawerActive.value = false;
	editImageDetails.value = false;
}

const edits = computed(() => {
	if (!props.value || typeof props.value !== 'object') return {};

	return props.value;
});

const { createAllowed } = useRelationPermissionsM2O(relationInfo);

const libraryActive = ref(false);
const upload = useTemplateRef<InstanceType<typeof BoUpload>>('upload');

const ACTION_BTN =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div
		class="image"
		:class="[width, { crop }]"
		role="group"
		:aria-labelledby="a11y?.labelId"
		:aria-describedby="a11y?.describedBy"
		:aria-invalid="a11y?.invalid || undefined"
	>
		<div
			v-if="loading"
			class="h-[200px] animate-pulse rounded-xl bg-gray-100 motion-reduce:animate-none dark:bg-white/5"
			aria-busy="true"
		/>

		<BoNotice v-else-if="nonEditable && !image" icon="hide_image" class="non-editable-notice">
			{{ $t('no_image_selected') }}
		</BoNotice>

		<div
			v-else-if="image"
			class="image-preview overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]"
			:class="{ disabled, 'non-editable': nonEditable }"
		>
			<component
				:is="nonEditable ? 'button' : 'div'"
				class="relative flex w-full items-center justify-center overflow-hidden bg-gray-100 dark:bg-white/5"
				:class="[width === 'full' || width === 'fill' ? 'max-h-[360px]' : 'h-[200px]', nonEditable && FOCUS]"
				:type="nonEditable ? 'button' : undefined"
				:aria-label="nonEditable ? image.title : undefined"
				@click="nonEditable ? (editImageDetails = true) : undefined"
			>
				<div
					v-if="imageError || !src"
					class="image-error flex h-full flex-col items-center justify-center p-7 text-center text-gray-500 dark:text-gray-400"
				>
					<BoIcon size="lg" :name="imageError === 'UNKNOWN' ? 'error' : 'info'" class="mb-1" />

					<span class="message max-w-[270px] px-3.5 text-sm">
						{{ src ? $t(`errors.${imageError}`) : $t('errors.UNSUPPORTED_MEDIA_TYPE') }}
					</span>
				</div>

				<img
					v-else-if="image.type?.startsWith('image') && isImage"
					:src="src"
					class="h-full max-h-[inherit] w-full"
					:class="[
						crop ? 'object-cover' : 'object-contain',
						{ 'is-letterbox p-7': letterbox },
						{ 'mix-blend-luminosity': disabled && !nonEditable },
					]"
					:width="image.width ?? undefined"
					:height="image.height ?? undefined"
					alt=""
					role="presentation"
					@error="imageErrorHandler"
				/>

				<div v-else class="fallback flex h-full items-center justify-center">
					<span class="text-theme-xs font-medium uppercase text-gray-700 dark:text-gray-400">{{ ext }}</span>
				</div>
			</component>

			<div class="flex items-center gap-2 border-t border-gray-200 px-3 py-2 dark:border-gray-800">
				<div class="info min-w-0 flex-1">
					<div class="title truncate text-sm font-medium text-gray-800 dark:text-white/90">{{ image.title }}</div>
					<div class="meta truncate text-theme-xs text-gray-500 dark:text-gray-400">{{ meta }}</div>
				</div>

				<div v-if="!internalDisabled" class="actions flex shrink-0 justify-end gap-1">
					<button
						type="button"
						class="zoom"
						:class="ACTION_BTN"
						:aria-label="$t('zoom')"
						:title="$t('zoom')"
						@click="lightboxActive = true"
					>
						<BoIcon name="zoom_in" size="sm" />
					</button>

					<a
						class="download"
						:class="ACTION_BTN"
						:aria-label="$t('download')"
						:title="$t('download')"
						:href="getAssetUrl(image.id, { isDownload: true })"
						:download="image.filename_download"
					>
						<BoIcon name="download" size="sm" />
					</a>

					<button
						type="button"
						class="edit"
						:class="ACTION_BTN"
						:aria-label="$t('edit_item')"
						:title="$t('edit_item')"
						@click="editImageDetails = true"
					>
						<BoIcon name="edit" size="sm" />
					</button>

					<BoRemove class="deselect" deselect :item-info="relationInfo" :item-edits="edits" @action="deselect" />
				</div>
			</div>

			<DrawerItem
				v-if="image"
				v-model:active="editImageDetails"
				:disabled="internalDisabled"
				:non-editable="nonEditable"
				collection="directus_files"
				:primary-key="image.id"
				:edits="edits"
				@input="update"
			>
				<template #actions>
					<BoButton
						variant="secondary"
						icon="download"
						:aria-label="$t('download')"
						:download="image.filename_download"
						:href="getAssetUrl(image.id, { isDownload: true })"
					/>
				</template>
			</DrawerItem>

			<FileLightbox v-model="lightboxActive" :file="image" />
		</div>

		<template v-else>
			<BoUpload
				ref="upload"
				from-url
				:from-user="createAllowed && enableCreate"
				:from-library="enableSelect"
				:folder="folder"
				:filter="customFilter"
				:disabled="internalDisabled"
				:accept="combinedAcceptString"
				@input="onUpload"
				@library="libraryActive = true"
			/>

			<DrawerFiles
				v-if="enableSelect"
				v-model:active="libraryActive"
				:folder="folder"
				:filter="customFilter"
				@input="upload?.setSelection($event)"
			/>
		</template>
	</div>
</template>
