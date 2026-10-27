<!-- Ported from directus/app/src/views/private/components/basic-import-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-014): the import block of ExportSidebarDetail (014, recipe Q-12) without the background option
// or the export part, as DR. axios -> uploadWithProgress (byte progress, research R10); success is an in-place
// notice (D-66), errors go to ImportErrorDialog (validation) or the error dialog.
import { computed, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { notify, showUnexpectedError } from '../../composables/use-notices.ts';
import { useCollectionPermissions } from '../../composables/use-permissions/index.ts';
import { extractErrorCode } from '../../utils/extract-error-code.ts';
import { readableMimeType } from '../../utils/readable-mime-type.ts';
import { uploadWithProgress } from '../../utils/upload-with-progress.ts';
import BoButton from '../BoButton.vue';
import BoIcon from '../BoIcon.vue';
import BoProgressLinear from '../BoProgressLinear.vue';
import BoRemove from '../BoRemove.vue';
import ImportErrorDialog from './ImportErrorDialog.vue';
import SidebarDetail from './SidebarDetail.vue';

type APIError = { message?: string; extensions?: Record<string, any> };

const props = defineProps<{
	collection: string;
}>();

const emit = defineEmits(['refresh']);

const { t } = useI18n();

const { collection } = toRefs(props);

// Backoffice (spec 025, FR-028): the import permission of the policies (DR: create).
const { importAllowed } = useCollectionPermissions(collection);

const fileInput = ref<HTMLInputElement | null>(null);

const file = ref<File | null>(null);
const { uploading, progress, importing, uploadFile } = useUpload();

const errorDialogActive = ref(false);
const errorDialogRows = ref<APIError[]>([]);

const fileExtension = computed(() => {
	if (file.value === null) return null;
	return readableMimeType(file.value.type, true);
});

function onChange(event: Event) {
	const files = (event.target as HTMLInputElement)?.files;

	if (files && files.length > 0) {
		file.value = files.item(0)!;
	}
}

function clearFileInput() {
	if (fileInput.value) fileInput.value.value = '';
	file.value = null;
}

function openFileBrowser() {
	fileInput.value?.click();
}

function importData() {
	uploadFile(file.value!);
}

function useUpload() {
	const uploading = ref(false);
	const importing = ref(false);
	const progress = ref(0);

	return { uploading, progress, importing, uploadFile };

	async function uploadFile(file: File) {
		uploading.value = true;
		importing.value = false;
		progress.value = 0;

		const formData = new FormData();
		formData.append('file', file);

		try {
			await uploadWithProgress(`/utils/import/${collection.value}`, formData, (percentCompleted) => {
				progress.value = percentCompleted;
				importing.value = percentCompleted === 100 ? true : false;
			});

			clearFileInput();

			emit('refresh');

			notify({
				title: t('import_data_success', { filename: file.name }),
			});
		} catch (error: any) {
			const errors = error?.errors;

			if (extractErrorCode(error) === 'FAILED_VALIDATION' && Array.isArray(errors)) {
				errorDialogRows.value = errors;
				errorDialogActive.value = true;
			} else {
				showUnexpectedError(error);
			}
		} finally {
			uploading.value = false;
			importing.value = false;
			progress.value = 0;
		}
	}
}

const LABEL = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90';
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<SidebarDetail id="import" icon="publish" :title="$t('label_import')">
		<div v-if="importAllowed" class="flex flex-col gap-4">
			<div>
				<div
					v-if="uploading || importing"
					class="flex flex-col justify-center gap-1 rounded-lg bg-brand-500 px-4 py-2.5 text-white"
				>
					<div class="flex justify-between text-theme-sm">
						<span>{{ importing ? $t('import_data_indeterminate') : $t('upload_file_indeterminate') }}</span>
						<span v-if="!importing">{{ progress }}%</span>
					</div>
					<BoProgressLinear
						:indeterminate="importing"
						:value="progress"
						:aria-label="importing ? $t('import_data_indeterminate') : $t('upload_file_indeterminate')"
					/>
				</div>
				<template v-else>
					<p :class="LABEL">{{ $t('label_import') }}</p>

					<div
						class="flex items-center gap-2 rounded-lg border border-gray-300 p-1.5 focus-within:border-brand-500 dark:border-gray-700"
					>
						<button
							type="button"
							class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-start"
							:class="FOCUS"
							:title="file?.name"
							@click="openFileBrowser"
						>
							<span
								class="flex size-9 shrink-0 items-center justify-center rounded-lg"
								:class="file ? 'bg-brand-50 dark:bg-brand-500/15' : 'bg-gray-100 dark:bg-white/5'"
							>
								<span
									v-if="fileExtension"
									class="text-theme-xs font-semibold text-brand-500 uppercase dark:text-brand-400"
								>
									{{ fileExtension }}
								</span>
								<BoIcon v-else name="folder_open" class="text-gray-500 dark:text-gray-400" />
							</span>
							<span
								class="min-w-0 flex-1 truncate"
								:class="file ? 'text-gray-800 dark:text-white/90' : 'text-gray-500 dark:text-gray-400'"
							>
								{{ file ? file.name : $t('import_data_input_placeholder') }}
							</span>
						</button>

						<input
							ref="fileInput"
							type="file"
							accept="text/csv, application/json"
							hidden
							data-import-file
							@change="onChange"
						/>

						<BoRemove v-if="file" deselect @action="clearFileInput" />
						<BoIcon v-else name="attach_file" class="me-1.5 text-gray-500 dark:text-gray-400" />
					</div>
				</template>
			</div>

			<BoButton full-width :disabled="!file" :loading="uploading || importing" @click="importData">
				{{ $t('import_data_button') }}
			</BoButton>
		</div>

		<ImportErrorDialog v-model="errorDialogActive" :errors="errorDialogRows" :collection="collection" />
	</SidebarDetail>
</template>
