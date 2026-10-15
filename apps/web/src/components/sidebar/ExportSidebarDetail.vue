<!-- Ported from directus/app/src/views/private/components/export-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: recipe Q-12 (export dialog = BoDialog with a 2-column grid, location radio, count notice that turns
// warning when locked to files; import block with background checkbox and progress) inside a Q-9 SidebarDetail.
// axios -> SDK / apiFetch (FR-001). The import upload uses XMLHttpRequest (uploadWithProgress) for byte progress
// (research R10). The download is fetch -> blob -> saveAs (Directus: window.open of the export URL, which cannot send
// the session cookie to another API origin); the file name is the server's Content-Disposition when exposed, else
// `<collection>.<ext>`. VDrawer -> BoDialog (recipe), FolderPicker -> folder BoSelect as DrawerFiles (013),
// InterfaceSystemField -> a BoSelect of the collection fields, InterfaceSystemFields -> chips + FieldList in a popover
// (recipe; no drag reorder). With no field selected the export button is disabled (spec FR-091). Errors go to the
// error dialog (showUnexpectedError) like the other 014 screens.
import { queryToParams } from '@directus/sdk';
import type { Filter } from '@directus/types';
import { getEndpoint } from '@directus/utils';
import fileSaver from 'file-saver';
import { debounce, pick } from 'lodash-es';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed, defineAsyncComponent, reactive, ref, toRefs, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiFetch, requestEndpoint, sdk } from '../../api/sdk.ts';
import { useCollection } from '../../composables/use-collection.ts';
import { notify, showUnexpectedError } from '../../composables/use-notices.ts';
import { useCollectionPermissions } from '../../composables/use-permissions/index.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useServerStore } from '../../stores/server.ts';
import { extractErrorCode } from '../../utils/extract-error-code.ts';
import { fetchAll } from '../../utils/fetch-all.ts';
import { readableMimeType } from '../../utils/readable-mime-type.ts';
import { uploadWithProgress } from '../../utils/upload-with-progress.ts';
import BoButton from '../BoButton.vue';
import BoCheckbox from '../BoCheckbox.vue';
import BoChip from '../BoChip.vue';
import BoDialog from '../BoDialog.vue';
import BoDivider from '../BoDivider.vue';
import BoIcon from '../BoIcon.vue';
import BoInput from '../BoInput.vue';
import BoNotice from '../BoNotice.vue';
import BoProgressLinear from '../BoProgressLinear.vue';
import BoRadio from '../BoRadio.vue';
import BoRemove from '../BoRemove.vue';
import BoSelect from '../BoSelect.vue';
import BoTooltip from '../BoTooltip.vue';
import FieldList from '../FieldList.vue';
import ImportErrorDialog from './ImportErrorDialog.vue';
import SidebarDetail from './SidebarDetail.vue';

// Backoffice: lazy, SystemFilter imports the interface registry (import cycle, as SearchInput).
const SystemFilter = defineAsyncComponent(() => import('../../interfaces/_system/system-filter/SystemFilter.vue'));

type LayoutQuery = {
	fields?: string[];
	sort?: string;
	limit?: number;
};

type APIError = { message?: string; extensions?: Record<string, any> };

const props = defineProps<{
	collection: string;
	layoutQuery?: LayoutQuery | undefined;
	filter?: Filter | undefined;
	search?: string | undefined;
	onDownload?: (() => Promise<void>) | undefined;
}>();

const emit = defineEmits(['refresh']);

const { t, n } = useI18n();

const { collection } = toRefs(props);

const fileInput = ref<HTMLInputElement | null>(null);

const file = ref<File | null>(null);
const { uploading, progress, importing, uploadFile, background: backgroundImport } = useUpload();

const exportDialogActive = ref(false);

const errorDialogActive = ref(false);
const errorDialogRows = ref<APIError[]>([]);

const fileExtension = computed(() => {
	if (file.value === null) return null;
	return readableMimeType(file.value.type, true);
});

const { primaryKeyField, fields, info: collectionInfo } = useCollection(collection);

const { createAllowed } = useCollectionPermissions(collection);

const { info } = useServerStore();

const queryLimitMax = info.queryLimit === undefined || info.queryLimit.max === -1 ? Infinity : info.queryLimit.max;
const defaultLimit = info.queryLimit !== undefined ? Math.min(25, queryLimitMax) : 25;

const isVirtualField = (fieldName: string) => fieldName.startsWith('$');

const isExportableField = (field: { field: string }) => isVirtualField(field.field) === false;

const sanitizeExportFields = (fieldNames: string[] | undefined) => {
	return fieldNames?.filter((fieldName) => isVirtualField(fieldName) === false) ?? [];
};

const getDefaultExportFields = () => {
	return (
		fields.value
			?.filter((field) => field.type !== 'alias' && isVirtualField(field.field) === false)
			.map((field) => field.field) ?? []
	);
};

const exportSettings = reactive({
	limit: (props.layoutQuery?.limit ?? defaultLimit) as number | null,
	filter: props.filter,
	search: props.search,
	fields: sanitizeExportFields(props.layoutQuery?.fields) ?? getDefaultExportFields(),
	sort: `${primaryKeyField.value?.field ?? ''}`,
});

watch(
	fields,
	() => {
		exportSettings.fields = props.layoutQuery?.fields
			? sanitizeExportFields(props.layoutQuery.fields)
			: getDefaultExportFields();
	},
	{ immediate: true },
);

watch(
	() => props.layoutQuery,
	() => {
		exportSettings.limit = props.layoutQuery?.limit ?? defaultLimit;

		if (props.layoutQuery?.fields) {
			exportSettings.fields = sanitizeExportFields(props.layoutQuery.fields);
		} else {
			exportSettings.fields = getDefaultExportFields();
		}

		if (props.layoutQuery?.sort) {
			if (Array.isArray(props.layoutQuery.sort)) {
				exportSettings.sort = props.layoutQuery.sort[0];
			} else {
				exportSettings.sort = props.layoutQuery.sort;
			}
		}
	},
	{ immediate: true },
);

watch(
	[() => props.filter, () => props.search],
	([filter, search]) => {
		exportSettings.filter = filter;
		exportSettings.search = search;
	},
	{ immediate: true },
);

const format = ref('csv');
const location = ref('download');
const folder = ref<string | null>(null);

const lockedToFiles = ref<{ previousLocation: string } | null>(null);

const itemCountTotal = ref<number>();
const itemCount = ref<number>();
const itemCountLoading = ref(false);

const getItemCount = async () => {
	itemCountLoading.value = true;

	try {
		const aggregate = primaryKeyField.value?.field
			? {
					countDistinct: [primaryKeyField.value.field],
				}
			: {
					count: ['*'],
				};

		const response = await sdk.request<Record<string, any>[]>(
			requestEndpoint(getEndpoint(collection.value), {
				params: {
					...pick(exportSettings, ['search', 'filter']),
					aggregate,
				},
			}),
		);

		let count;

		if (response?.[0]?.['count']) {
			count = Number(response[0]['count']);
		}

		if (response?.[0]?.['countDistinct']) {
			count = Number(response[0]['countDistinct'][primaryKeyField.value!.field]);
		}

		itemCount.value = count;
		return count;
	} finally {
		itemCountLoading.value = false;
	}
};

// Backoffice: a failed count (e.g. an invalid filter while editing) only leaves the count unknown.
watch(
	[() => exportSettings.search, () => exportSettings.filter],
	debounce(() => getItemCount().catch(() => {}), 250),
);

watch(
	() => exportSettings.limit,
	() => {
		if (exportSettings.limit === null) return;

		if (exportSettings.limit < -1) {
			exportSettings.limit = -1;
		}

		if (!Number.isNaN(exportSettings.limit) && !Number.isInteger(exportSettings.limit)) {
			exportSettings.limit = Math.round(exportSettings.limit);
		}
	},
);

const exportCount = computed(() => {
	const limit = exportSettings.limit === null || exportSettings.limit === -1 ? Infinity : exportSettings.limit;
	return itemCount.value !== undefined ? Math.min(itemCount.value, limit) : limit;
});

watch(
	exportCount,
	() => {
		const queryLimitThreshold = exportCount.value > queryLimitMax;
		const batchThreshold = exportCount.value >= 2500;

		if (queryLimitThreshold || batchThreshold) {
			lockedToFiles.value = {
				previousLocation: lockedToFiles.value?.previousLocation ?? location.value,
			};

			location.value = 'files';
		} else if (lockedToFiles.value) {
			location.value = lockedToFiles.value.previousLocation;
			lockedToFiles.value = null;
		}
	},
	{ immediate: true },
);

watch(primaryKeyField, (newVal) => {
	exportSettings.sort = newVal?.field ?? '';
});

const sortDirection = computed({
	get() {
		return exportSettings.sort.startsWith('-') ? 'DESC' : 'ASC';
	},
	set(newDirection: 'ASC' | 'DESC') {
		if (newDirection === 'ASC') {
			if (exportSettings.sort.startsWith('-')) {
				exportSettings.sort = exportSettings.sort.substring(1);
			}
		} else {
			if (exportSettings.sort.startsWith('-') === false) {
				exportSettings.sort = `-${exportSettings.sort}`;
			}
		}
	},
});

const sortField = computed({
	get() {
		if (exportSettings.sort.startsWith('-')) return exportSettings.sort.substring(1);
		return exportSettings.sort;
	},
	set(newSortField: string) {
		exportSettings.sort = newSortField;
	},
});

const exporting = ref(false);

async function openExportDialog() {
	try {
		itemCountTotal.value = await getItemCount();
	} catch (error) {
		showUnexpectedError(error);
		return;
	}

	exportDialogActive.value = true;
	if (folders.value === null) fetchFolders();
}

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
	const background = ref(false);

	return { uploading, progress, importing, uploadFile, background };

	async function uploadFile(file: File) {
		uploading.value = true;
		importing.value = false;
		progress.value = 0;

		const formData = new FormData();
		formData.append('file', file);

		const query = background.value ? '?background=true' : '';

		try {
			await uploadWithProgress(`/utils/import/${collection.value}${query}`, formData, (percentCompleted) => {
				progress.value = percentCompleted;
				importing.value = percentCompleted === 100 ? true : false;
			});

			clearFileInput();

			if (!background.value) {
				emit('refresh');

				notify({
					title: t('import_data_success', { filename: file.name }),
				});
			} else {
				notify({
					title: t('import_upload_success', { filename: file.name }),
				});
			}
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

function startExport() {
	if (location.value === 'download') {
		exportDataLocal();
	} else {
		exportDataFiles();
	}
}

async function exportDataLocal() {
	if (exporting.value) return;

	const params: Record<string, unknown> = {
		export: format.value,
	};

	if (exportSettings.sort && exportSettings.sort !== '') params['sort'] = exportSettings.sort;
	if (exportSettings.fields) params['fields'] = exportSettings.fields;
	if (exportSettings.search) params['search'] = exportSettings.search;
	if (exportSettings.filter) params['filter'] = exportSettings.filter;

	params['limit'] = exportSettings.limit ? Math.min(exportSettings.limit, queryLimitMax) : -1;

	exporting.value = true;

	try {
		const query = new URLSearchParams(queryToParams(params));
		const response = await apiFetch(`${getEndpoint(collection.value)}?${query}`);

		if (!response.ok) throw await response.json().catch(() => ({ response: { status: response.status } }));

		const disposition = /filename="?([^";]+)"?/.exec(response.headers.get('Content-Disposition') ?? '')?.[1];
		const extension = format.value === 'csv_utf8' ? 'csv' : format.value;

		fileSaver.saveAs(await response.blob(), disposition ?? `${collection.value}.${extension}`);
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		exporting.value = false;
	}
}

async function exportDataFiles() {
	if (exporting.value) return;

	exporting.value = true;

	try {
		await sdk.request(
			requestEndpoint(`/utils/export/${collection.value}`, {
				method: 'POST',
				body: {
					query: {
						...exportSettings,
						...(exportSettings.sort && exportSettings.sort !== '' && { sort: [exportSettings.sort] }),
					},
					format: format.value,
					file: {
						folder: folder.value,
					},
				},
			}),
		);

		exportDialogActive.value = false;

		notify({
			title: t('export_started'),
			text: t('export_started_copy'),
			type: 'success',
		});
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		exporting.value = false;
	}
}

/* Backoffice: the folder select of DrawerFiles (013) instead of folder-picker.vue; 'root' = the File Library. */
type FolderRaw = { id: string; name: string; parent: string | null };

const folders = ref<FolderRaw[] | null>(null);

async function fetchFolders() {
	try {
		folders.value = await fetchAll<FolderRaw>('/folders', { params: { sort: 'name' } });
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn(error);
	}
}

const folderItems = computed(() => {
	const items = [{ text: t('file_library'), value: 'root' }];

	const addChildren = (parent: string | null, depth: number) => {
		for (const item of folders.value ?? []) {
			if (item.parent !== parent) continue;
			items.push({ text: `${'  '.repeat(depth * 2)}${item.name}`, value: item.id });
			addChildren(item.id, depth + 1);
		}
	};

	addChildren(null, 1);

	return items;
});

/* Backoffice: system-fields.vue (selected fields as chips, FieldList to add) and system-field.vue (sort field). */
const fieldsStore = useFieldsStore();

function fieldDisplayName(fieldKey: string) {
	const parts = fieldKey.split('.');

	return parts
		.map((key, index) => fieldsStore.getField(collection.value, parts.slice(0, index + 1).join('.'))?.name ?? key)
		.join(' -> ');
}

function addFields(keys: string[]) {
	exportSettings.fields = Array.from(new Set([...exportSettings.fields, ...keys]));
}

function removeField(key: string) {
	exportSettings.fields = exportSettings.fields.filter((field) => field !== key);
}

const sortFieldItems = computed(() =>
	fields.value
		.filter((field) => field.type !== 'alias' && isExportableField(field))
		.map((field) => ({ text: field.name, value: field.field })),
);

const ids = { fields: useId(), filter: useId() };

const LABEL = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400';
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const POPOVER =
	'z-99999 max-h-(--reka-popover-content-available-height) w-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark';
</script>

<template>
	<SidebarDetail id="export" icon="import_export" :title="$t('import_export')">
		<div class="flex flex-col gap-4">
			<template v-if="createAllowed">
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

							<input id="import-file" ref="fileInput" type="file" accept=".csv,.json" hidden @change="onChange" />

							<BoRemove v-if="file" deselect @action="clearFileInput" />
							<BoIcon v-else name="attach_file" class="me-1.5 text-gray-500 dark:text-gray-400" />
						</div>
					</template>
				</div>

				<BoCheckbox v-model="backgroundImport" :label="$t('import_background')" :disabled="uploading || importing" />

				<BoButton full-width :disabled="!file" :loading="uploading || importing" @click="importData">
					{{ $t('import_data_button') }}
				</BoButton>

				<BoDivider />
			</template>

			<div class="flex flex-col gap-2">
				<BoButton full-width @click="openExportDialog">
					{{ $t('export_items') }}
				</BoButton>

				<BoTooltip
					side="bottom"
					:text="
						!!onDownload ? $t('presentation_text_values_cannot_be_reimported') : $t('download_page_as_csv_unsupported')
					"
				>
					<div>
						<button
							type="button"
							class="block w-full rounded-lg py-1 text-center text-theme-sm text-gray-500 transition-colors hover:text-brand-500 disabled:cursor-not-allowed disabled:hover:text-gray-500 motion-reduce:transition-none dark:text-gray-400 dark:hover:text-brand-400"
							:class="FOCUS"
							:disabled="!onDownload"
							@click="onDownload?.()"
						>
							{{ $t('download_page_as_csv') }}
						</button>
					</div>
				</BoTooltip>
			</div>
		</div>

		<BoDialog v-model:open="exportDialogActive" :title="$t('export_items')">
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<BoSelect
					v-model="format"
					:label="$t('format')"
					:items="[
						{ text: $t('csv'), value: 'csv' },
						{ text: $t('csv_utf8'), value: 'csv_utf8' },
						{ text: $t('json'), value: 'json' },
						{ text: $t('xml'), value: 'xml' },
						{ text: $t('yaml'), value: 'yaml' },
					]"
				/>

				<BoInput
					:model-value="exportSettings.limit"
					type="number"
					:label="$t('limit')"
					:placeholder="$t('unlimited')"
					@update:model-value="exportSettings.limit = $event === '' ? null : Number($event)"
				/>

				<BoRadio
					v-model="location"
					:label="$t('export_location')"
					:disabled="lockedToFiles !== null"
					:items="[
						{ value: 'download', text: $t('download_file') },
						{ value: 'files', text: $t('file_library') },
					]"
				/>

				<BoSelect
					v-if="location === 'files'"
					:model-value="folder ?? 'root'"
					:label="$t('folder')"
					:items="folderItems"
					@update:model-value="folder = $event === 'root' ? null : $event"
				/>
				<div v-else>
					<p :class="LABEL">{{ $t('folder') }}</p>
					<BoNotice type="normal">{{ $t('not_available_for_local_downloads') }}</BoNotice>
				</div>

				<div class="sm:col-span-2" aria-live="polite">
					<BoNotice :type="lockedToFiles ? 'warning' : 'normal'">
						<p v-if="itemCountLoading">
							{{ $t('loading') }}
						</p>

						<p v-else-if="exportCount === 0">
							{{ $t('exporting_no_items_to_export') }}
						</p>

						<p v-else-if="itemCountTotal && exportCount >= itemCountTotal">
							{{
								$t('exporting_all_items_in_collection', {
									total: itemCountTotal ? n(itemCountTotal) : '??',
									collection: collectionInfo?.name,
								})
							}}
						</p>

						<p v-else-if="itemCountTotal && exportCount < itemCountTotal">
							{{
								$t('exporting_limited_items_in_collection', {
									count: n(exportCount),
									total: itemCountTotal ? n(itemCountTotal) : '??',
									collection: collectionInfo?.name,
								})
							}}
						</p>

						<p v-if="lockedToFiles">
							{{ $t('exporting_library_hint_forced', { format: $t(format) }) }}
						</p>

						<p v-else-if="location === 'files'">
							{{ $t('exporting_library_hint', { format: $t(format) }) }}
						</p>

						<p v-else>
							{{ $t('exporting_download_hint', { format: $t(format) }) }}
						</p>
					</BoNotice>
				</div>

				<BoDivider class="sm:col-span-2" />

				<BoSelect v-model="sortField" :label="$t('sort_field')" :items="sortFieldItems" />

				<BoSelect
					v-model="sortDirection"
					:label="$t('sort_direction')"
					:items="[
						{ value: 'ASC', text: $t('sort_asc') },
						{ value: 'DESC', text: $t('sort_desc') },
					]"
				/>

				<div class="sm:col-span-2">
					<BoInput
						:model-value="exportSettings.search ?? ''"
						:label="$t('full_text_search')"
						:placeholder="$t('search')"
						@update:model-value="exportSettings.search = $event || undefined"
					/>
				</div>

				<div class="sm:col-span-2" role="group" :aria-labelledby="ids.filter">
					<p :id="ids.filter" :class="LABEL">{{ $t('filter') }}</p>
					<SystemFilter
						:value="exportSettings.filter"
						:collection-name="collection"
						@input="exportSettings.filter = $event ?? undefined"
					/>
				</div>

				<div class="sm:col-span-2" role="group" :aria-labelledby="ids.fields">
					<p :id="ids.fields" :class="LABEL">{{ $t('field', 2) }}</p>
					<div class="flex flex-wrap items-center gap-2">
						<BoChip
							v-for="key in exportSettings.fields"
							:key="key"
							:text="fieldDisplayName(key)"
							size="md"
							removable
							@remove="removeField(key)"
						/>
						<span v-if="exportSettings.fields.length === 0" class="text-theme-sm text-gray-500 dark:text-gray-400">
							{{ $t('interfaces.system-fields.no_fields') }}
						</span>
						<PopoverRoot>
							<PopoverTrigger
								class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-theme-sm font-medium text-brand-500 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/15"
								:class="FOCUS"
							>
								{{ $t('add_field') }}
								<BoIcon name="expand_more" size="sm" />
							</PopoverTrigger>
							<PopoverPortal>
								<PopoverContent :side-offset="4" align="start" :collision-padding="8" :class="POPOVER">
									<FieldList
										:collection="collection"
										:disabled-fields="exportSettings.fields"
										:field-filter="isExportableField"
										allow-select-all
										@add="addFields"
									/>
								</PopoverContent>
							</PopoverPortal>
						</PopoverRoot>
					</div>
				</div>
			</div>

			<template #actions>
				<BoButton variant="secondary" @click="exportDialogActive = false">{{ $t('cancel') }}</BoButton>
				<BoButton
					:icon="location === 'download' ? 'download' : 'start'"
					:loading="exporting"
					:disabled="exportSettings.fields.length === 0"
					@click="startExport"
				>
					{{ location === 'download' ? $t('download_file') : $t('start_export') }}
				</BoButton>
			</template>
		</BoDialog>

		<ImportErrorDialog v-model="errorDialogActive" :errors="errorDialogRows" :collection="collection" />
	</SidebarDetail>
</template>
