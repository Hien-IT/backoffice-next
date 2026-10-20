<!-- Ported from directus/app/src/components/v-upload.vue -->
<script setup lang="ts">
// Backoffice: Upload recipe (component-specs Tier 3). Uploads go through utils/upload-files.ts and upload-file.ts
// (feature 015: TUS when the server enables it, otherwise multipart with byte progress, `maxConcurrency` from the
// server); no `start` controller. `fileId` replaces that file (PATCH /files/:id, feature 015 FR-033). Errors show inline under the zone (the notifications store with
// dialogs comes with 018): invalid files as Directus words them, failed uploads one line per file with
// translateAPIError. "Choose from library" emits `library`; the files drawer (T069) calls the exposed `setSelection`
// (GET /files or /files/:id as Directus).
import { readFile, readFiles } from '@directus/sdk';
import type { File, Filter } from '@directus/types';
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import BoButton from '../BoButton.vue';
import BoDialog from '../BoDialog.vue';
import BoIcon from '../BoIcon.vue';
import BoInput from '../BoInput.vue';
import BoMenu, { type BoMenuItem } from '../BoMenu.vue';
import BoProgressLinear from '../BoProgressLinear.vue';
import { useServerStore } from '../../stores/server.ts';
import { uploadFile } from '../../utils/upload-file.ts';
import { uploadFiles } from '../../utils/upload-files.ts';

interface Props {
	multiple?: boolean;
	preset?: Record<string, any>;
	/** In case that the user isn't allowed to upload files */
	fromUser?: boolean;
	fromUrl?: boolean;
	fromLibrary?: boolean;
	folder?: string | undefined;
	/** Replace this file instead of creating one (feature 015). */
	fileId?: string | undefined;
	/** Filter of the files drawer (T069). */
	filter?: Filter | undefined;
	disabled?: boolean;
	accept?: string | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	preset: () => ({}),
	folder: undefined,
	fileId: undefined,
	filter: undefined,
	accept: undefined,
	fromUser: true,
});

const emit = defineEmits<{
	input: [files: null | File | File[]];
	library: [];
}>();

const { t } = useI18n();

const errors = ref<string[]>([]);
const announcement = ref('');

const { uploading, progress, upload, onBrowseSelect, done, numberOfFiles } = useUpload();
const { onDragEnter, onDragLeave, onDrop, dragging } = useDragging();
const { url, isValidURL, loading: urlLoading, importFromURL } = useURLImport();
const { setSelection } = useSelection();
const activeDialog = ref<'url' | null>(null);
const input = ref<HTMLInputElement>();
const urlFormId = useId();

function validFiles(files: globalThis.File[]) {
	const typeErrors: string[] = [];
	const emptyErrors: string[] = [];

	for (const file of files) {
		if (file.size === 0) {
			emptyErrors.push(`"${file.name}"`);
			continue;
		}

		if (props.accept) {
			const acceptTypes = props.accept.split(',').map((type) => type.trim());

			const isValidType = acceptTypes.some((acceptType) => {
				if (acceptType.endsWith('/*')) {
					const baseType = acceptType.slice(0, -2);

					return file.type.startsWith(baseType + '/');
				} else {
					return file.type === acceptType;
				}
			});

			if (!isValidType) {
				typeErrors.push(`"${file.name}" (${file.type})`);
			}
		}
	}

	const totalErrors = typeErrors.length + emptyErrors.length;

	if (totalErrors > 0) {
		const errorParts: string[] = [t('invalid_files_selected', { count: totalErrors }, totalErrors)];

		if (typeErrors.length > 0) {
			errorParts.push(t('files_wrong_type', { files: typeErrors.join(', '), expected: props.accept }));
		}

		if (emptyErrors.length > 0) {
			errorParts.push(t('files_are_empty', { files: emptyErrors.join(', ') }));
		}

		errors.value = errorParts;

		return false;
	}

	return true;
}

function uploadError(file: globalThis.File, error: unknown) {
	errors.value.push(`${file.name}: ${translateAPIError(error as APIError)}`);
}

function useUpload() {
	const uploading = ref(false);
	const progress = ref(0);
	const done = ref(0);
	const numberOfFiles = ref(0);

	return { uploading, progress, upload, onBrowseSelect, numberOfFiles, done };

	async function upload(fileList: FileList | globalThis.File[]) {
		const files = Array.from(fileList);

		errors.value = [];

		if (files.length === 0 || !validFiles(files)) return;

		uploading.value = true;
		progress.value = 0;
		done.value = 0;
		numberOfFiles.value = files.length;
		announcement.value =
			props.multiple && files.length > 1
				? t('upload_files_indeterminate', { done: 0, total: files.length })
				: t('upload_file_indeterminate');

		const preset = {
			...props.preset,
			...(props.folder && { folder: props.folder }),
		};

		try {
			if (props.multiple === true) {
				const uploadedFiles = await uploadFiles(files, {
					preset,
					maxConcurrency: useServerStore().info.uploads?.maxConcurrency,
					onError: uploadError,
					onProgressChange: (percentages) => {
						progress.value = Math.round(percentages.reduce((total, p) => total + p, 0) / percentages.length);
						done.value = percentages.filter((p) => p === 100).length;
					},
				});

				const succeeded = uploadedFiles.filter((f): f is File => !!f);
				emit('input', succeeded);
				announce(succeeded.length);
			} else {
				const uploadedFile = await uploadFile(files[0]!, {
					preset,
					...(props.fileId && { fileId: props.fileId }),
					onError: (error) => uploadError(files[0]!, error),
					onProgressChange: (percentage) => (progress.value = Math.round(percentage)),
				});

				progress.value = 100;
				done.value = 1;

				if (uploadedFile) emit('input', uploadedFile);
				announce(uploadedFile ? 1 : 0);
			}
		} catch (error) {
			errors.value.push(translateAPIError(error as APIError));
			emit('input', null);
		} finally {
			uploading.value = false;
		}
	}

	function announce(count: number) {
		announcement.value =
			count === 0 ? '' : count === 1 ? t('upload_file_success') : t('upload_files_success', { count });
	}

	function onBrowseSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target?.files;

		if (files) {
			upload(files);
		}

		// Backoffice: lets the same file be chosen again.
		target.value = '';
	}
}

function useDragging() {
	const dragging = ref(false);

	let dragCounter = 0;

	return { onDragEnter, onDragLeave, onDrop, dragging };

	function onDragEnter() {
		dragCounter++;

		if (dragCounter === 1) {
			dragging.value = true;
		}
	}

	function onDragLeave() {
		dragCounter--;

		if (dragCounter === 0) {
			dragging.value = false;
		}
	}

	function onDrop(event: DragEvent) {
		dragCounter = 0;
		dragging.value = false;

		const files = event.dataTransfer?.files;

		// Backoffice: a disabled zone ignores drops (recipe).
		if (files && props.fromUser && !props.disabled) {
			upload(files);
		}
	}
}

function useSelection() {
	return { setSelection };

	async function setSelection(selection: (string | number)[] | null) {
		if (!selection) return;

		if (props.multiple) {
			const files = (await sdk.request(readFiles({ filter: { id: { _in: selection } } } as any))) as unknown as File[];
			emit('input', files);
		} else if (selection[0]) {
			const id = selection[0];
			const file = (await sdk.request(readFile(String(id)))) as unknown as File;
			emit('input', file);
		} else {
			emit('input', null);
		}
	}
}

function useURLImport() {
	const url = ref('');
	const loading = ref(false);

	const isValidURL = computed(() => {
		try {
			new URL(url.value);
			return true;
		} catch {
			return false;
		}
	});

	return { url, loading, isValidURL, importFromURL };

	async function importFromURL() {
		if (!isValidURL.value || loading.value) return;

		loading.value = true;
		errors.value = [];

		const data = {
			...props.preset,
			...(props.folder && { folder: props.folder }),
		};

		try {
			const file = await sdk.request(
				requestEndpoint<File>('/files/import', {
					method: 'POST',
					body: { url: url.value, data, options: { filterMimeType: props.accept?.split(',') } },
				}),
			);

			if (props.multiple) {
				emit('input', [file]);
			} else {
				emit('input', file);
			}

			announcement.value = t('upload_file_success');
			activeDialog.value = null;
			url.value = '';
		} catch (error) {
			errors.value = [translateAPIError(error as APIError)];
		} finally {
			loading.value = false;
		}
	}
}

function openFileBrowser() {
	input.value?.click();
}

const menuItems = computed<BoMenuItem[]>(() => [
	...(props.fromLibrary
		? [{ text: t('choose_from_library'), icon: 'folder_open', onSelect: () => emit('library') }]
		: []),
	...(props.fromUrl && props.fromUser
		? [{ text: t('import_from_url'), icon: 'link', onSelect: () => (activeDialog.value = 'url') }]
		: []),
]);

defineExpose({ setSelection });

const ICON_BTN =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div>
		<div
			data-dropzone
			class="v-upload flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center transition-colors motion-reduce:transition-none"
			:class="[
				dragging && fromUser
					? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/[0.12]'
					: errors.length > 0
						? 'border-error-600 bg-gray-50 dark:border-error-400 dark:bg-white/[0.03]'
						: 'border-gray-500 bg-gray-50 dark:border-gray-500 dark:bg-white/[0.03]',
				{ 'disabled cursor-not-allowed opacity-50': disabled },
			]"
			:data-dragging="(dragging && fromUser) || undefined"
			:aria-busy="uploading || undefined"
			@dragenter.prevent="onDragEnter"
			@dragover.prevent
			@dragleave.prevent="onDragLeave"
			@drop.stop.prevent="onDrop"
		>
			<template v-if="dragging && fromUser">
				<BoIcon name="file_upload" size="lg" class="text-gray-700 dark:text-gray-400" />
				<p class="text-sm text-gray-700 dark:text-gray-400">{{ $t('drop_to_upload') }}</p>
			</template>

			<template v-else-if="uploading">
				<p class="text-theme-sm text-gray-700 dark:text-gray-400">{{ progress }}%</p>
				<p class="text-theme-sm text-gray-700 dark:text-gray-400">
					{{
						multiple && numberOfFiles > 1
							? $t('upload_files_indeterminate', { done: done, total: numberOfFiles })
							: $t('upload_file_indeterminate')
					}}
				</p>
				<BoProgressLinear :value="progress" :aria-label="$t('upload_file_indeterminate')" class="rounded-full" />
			</template>

			<template v-else>
				<div class="actions flex items-center gap-2">
					<BoButton
						v-if="fromUser"
						variant="secondary"
						icon="file_upload"
						:disabled="!!disabled"
						@click="openFileBrowser"
					>
						{{ $t('upload_from_device') }}
					</BoButton>
					<input
						v-if="fromUser"
						ref="input"
						class="browse sr-only"
						type="file"
						tabindex="-1"
						aria-hidden="true"
						:multiple="multiple"
						:accept="accept"
						:disabled="disabled"
						@input="onBrowseSelect"
					/>
					<BoMenu v-if="menuItems.length > 0" :items="menuItems" align="end">
						<template #trigger>
							<button type="button" :class="ICON_BTN" :disabled="disabled" :aria-label="$t('options')">
								<BoIcon name="more_vert" size="sm" />
							</button>
						</template>
					</BoMenu>
				</div>

				<p class="text-sm text-gray-700 dark:text-gray-400">
					{{ $t(fromUser ? 'drag_file_here' : 'choose_from_library') }}
				</p>
			</template>
		</div>

		<div v-if="errors.length > 0" role="alert" class="mt-1.5 text-theme-xs text-error-600 dark:text-error-400">
			<p v-for="(error, index) in errors" :key="index">{{ error }}</p>
		</div>

		<div class="sr-only" aria-live="polite">{{ announcement }}</div>

		<BoDialog
			v-if="fromUrl"
			:open="activeDialog === 'url'"
			:title="$t('import_from_url')"
			@update:open="activeDialog = $event ? 'url' : null"
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
			<template #actions>
				<BoButton variant="secondary" :disabled="urlLoading" @click="activeDialog = null">{{ $t('cancel') }}</BoButton>
				<BoButton type="submit" :form="urlFormId" :loading="urlLoading" :disabled="!isValidURL">
					{{ $t('import_label') }}
				</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
