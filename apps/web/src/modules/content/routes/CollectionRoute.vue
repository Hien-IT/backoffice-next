<!-- Ported from directus/app/src/modules/content/routes/collection.vue -->
<script setup lang="ts">
// Backoffice: user stories 1 and 3 of feature 014 (FR-006, FR-008, FR-012 to FR-017, FR-020 to FR-028, FR-040,
// FR-042): layout, preset, archive filter, search and filter, bookmark controls (recipe Q-8), create button, empty and
// error states, layout options in the detail panel. Batch actions, export, import, refresh and flows come with user
// story 5 (T081-T090). Layouts render
// from the registry (getLayout(id).component and .slots) instead of global `layout-*` components (research R4).
import type { Filter, PrimaryKey } from '@directus/types';
import { mergeFilters } from '@directus/utils';
import { computed, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoDialog from '../../../components/BoDialog.vue';
import DrawerBatch from '../../../components/drawers/DrawerBatch.vue';
import BoButton from '../../../components/BoButton.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoInfo from '../../../components/BoInfo.vue';
import SearchInput from '../../../components/SearchInput.vue';
import ArchiveSidebarDetail from '../../../components/sidebar/ArchiveSidebarDetail.vue';
import ExportSidebarDetail from '../../../components/sidebar/ExportSidebarDetail.vue';
import FlowSidebarDetail from '../../../components/sidebar/FlowSidebarDetail.vue';
import RefreshSidebarDetail from '../../../components/sidebar/RefreshSidebarDetail.vue';
import LayoutSidebarDetail from '../../../components/sidebar/LayoutSidebarDetail.vue';
import FlowDialogs from '../../../interfaces/presentation-header/FlowDialogs.vue';
import { useFlows } from '../../../composables/use-run-manual-flow.ts';
import { useCollection } from '../../../composables/use-collection.ts';
import { useCollectionPermissions } from '../../../composables/use-permissions/index.ts';
import { showUnexpectedError } from '../../../composables/use-notices.ts';
import { translateAPIError } from '../../../lang/index.ts';
import { usePreset } from '../../../composables/use-preset.ts';
import PrivateView from '../../../layout/PrivateView.vue';
import { getLayout } from '../../../layouts/index.ts';
import { useLayout } from '../../../layouts/use-layout.ts';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { useUserStore } from '../../../stores/user.ts';
import { extractErrorCode } from '../../../utils/extract-error-code.ts';
import { getCollectionRoute, getItemRoute, isSystemCollection } from '../../../utils/get-item-route.ts';
import BookmarkAdd from '../components/BookmarkAdd.vue';
import ContentNavigation from '../components/ContentNavigation.vue';
import ContentNotFound from './ContentNotFound.vue';

// Recipe Q-8: the bookmark buttons next to the title.
const BOOKMARK_BTN =
	'inline-flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-white/5 dark:focus-visible:outline-brand-400';

type Item = {
	[field: string]: any;
};

const props = defineProps<{
	collection: string;
	bookmark?: string | undefined;
	archive?: string | null | undefined;
}>();

const { t } = useI18n();
const router = useRouter();

const layoutRef = ref();

const { collection } = toRefs(props);
const bookmarkID = computed(() => (props.bookmark ? +props.bookmark : null));

const { selection } = useSelection();
const { info: currentCollection } = useCollection(collection);
const { addNewLink, currentCollectionLink } = useLinks();
const { breadcrumb } = useBreadcrumb();

const {
	layout,
	layoutOptions,
	layoutQuery,
	filter,
	search,
	savePreset,
	bookmarkExists,
	saveCurrentAsBookmark,
	bookmarkTitle,
	resetPreset,
	bookmarkSaved,
	bookmarkIsMine,
	refreshInterval,
	busy: bookmarkSaving,
	clearLocalSave,
} = usePreset(collection, bookmarkID);

const { bookmarkDialogActive, creatingBookmark, createBookmark } = useBookmarks();

const { layoutWrapper } = useLayout(layout);

// Backoffice: the layout config whose component and slots render inside the wrapper (tabular when unknown).
const currentLayout = computed(() => getLayout(layout.value) ?? getLayout('tabular'));

watch(
	collection,
	() => {
		if (layout.value === null) {
			layout.value = 'tabular';
		}
	},
	{ immediate: true },
);

const {
	updateAllowed: batchEditAllowed,
	archiveAllowed: batchArchiveAllowed,
	deleteAllowed: batchDeleteAllowed,
	createAllowed,
} = useCollectionPermissions(collection);

const {
	confirmDelete,
	deleting,
	batchDelete,
	confirmArchive,
	archiveItems,
	archiving,
	error: deleteError,
	batchEditActive,
} = useBatch();

const { flowDialogsContext, manualFlows, provideRunManualFlow } = useFlows({
	collection,
	selection,
	location: 'collection',
	onRefreshCallback: refresh,
});

provideRunManualFlow();

async function refresh() {
	await layoutRef.value?.state?.refresh?.();
}

const downloadHandler = computed(() => layoutRef.value?.state?.download);

// Backoffice (spec 022 D-179): the toggles of directus_collections (bo_show_*); null or missing means shown (FR-007).
const toggles = computed(() => (currentCollection.value?.meta ?? {}) as Record<string, unknown>);
const showSearch = computed(() => toggles.value['bo_show_search'] !== false);
const showImport = computed(() => toggles.value['bo_show_import'] !== false);
const showExport = computed(() => toggles.value['bo_show_export'] !== false);
// FR-004: a hidden keyword box sends no preset, bookmark or URL search; the stored preset keeps it.
const activeSearch = computed(() => (showSearch.value ? search.value : null));

const permissionsStore = usePermissionsStore();
const userStore = useUserStore();
// Backoffice: a share session writes no presets, so it gets no bookmark controls (FR-084).
const shareSession = computed(() => !!userStore.currentUser && 'share' in userStore.currentUser);

const hasArchive = computed(() => {
	const archiveField = currentCollection.value?.meta?.archive_field;
	if (!archiveField || !currentCollection.value?.meta?.archive_app_filter) return false;

	const permissions = permissionsStore.getPermission(collection.value, 'read');
	if (permissions?.access === 'none') return false;

	const hasArchiveFieldPermission = permissions?.fields?.[0] === '*' || permissions?.fields?.includes(archiveField);
	return hasArchiveFieldPermission;
});

const archiveFilter = computed<Filter | null>(() => {
	if (!hasArchive.value) return null;

	const field = currentCollection.value!.meta!.archive_field!;
	let archiveValue: any = currentCollection.value!.meta!.archive_value;
	if (archiveValue === 'true') archiveValue = true;
	if (archiveValue === 'false') archiveValue = false;

	if (props.archive === 'all') {
		return null;
	} else if (props.archive === 'archived') {
		return {
			[field]: {
				_eq: archiveValue,
			},
		};
	} else {
		return {
			[field]: {
				_neq: archiveValue,
			},
		};
	}
});

const title = computed(() => (props.bookmark ? bookmarkTitle.value : currentCollection.value?.name) ?? undefined);

async function batchRefresh() {
	selection.value = [];
	await refresh();
}

function useBatch() {
	const confirmDelete = ref(false);
	const deleting = ref(false);

	const batchEditActive = ref(false);

	const confirmArchive = ref(false);
	const archiving = ref(false);

	const error = ref<any>(null);

	return { batchEditActive, confirmDelete, deleting, batchDelete, confirmArchive, archiving, archiveItems, error };

	async function batchDelete() {
		if (deleting.value) return;

		deleting.value = true;

		const batchPrimaryKeys = selection.value;

		try {
			await sdk.request(requestEndpoint(`/items/${props.collection}`, { method: 'DELETE', body: batchPrimaryKeys }));

			selection.value = [];
			await refresh();
		} catch (err: any) {
			error.value = err;
		} finally {
			confirmDelete.value = false;
			deleting.value = false;
		}
	}

	async function archiveItems() {
		if (archiving.value || !currentCollection.value?.meta?.archive_field) return;

		archiving.value = true;

		let archiveValue: any = currentCollection.value.meta.archive_value;
		if (archiveValue === 'true') archiveValue = true;
		if (archiveValue === 'false') archiveValue = false;

		try {
			await sdk.request(
				requestEndpoint(`/items/${props.collection}`, {
					method: 'PATCH',
					body: {
						keys: selection.value,
						data: {
							[currentCollection.value.meta.archive_field]: archiveValue,
						},
					},
				}),
			);

			selection.value = [];
			await refresh();

			confirmArchive.value = false;
		} catch (err: any) {
			error.value = err;
		} finally {
			archiving.value = false;
		}
	}
}

function useBreadcrumb() {
	// Backoffice: the bookmark breadcrumb (`breadcrumb`) and the default one (`Content`) of the DR headline.
	const breadcrumb = computed(() =>
		props.bookmark
			? [{ name: currentCollection.value?.name ?? props.collection, to: getCollectionRoute(props.collection) }]
			: [{ name: t('content'), to: '/content' }],
	);

	return { breadcrumb };
}

function useSelection() {
	const selection = ref<Item[]>([]);

	// Whenever the collection we're working on changes, we have to clear the selection
	watch(
		() => props.collection,
		() => (selection.value = []),
	);

	return { selection };
}

function useLinks() {
	const addNewLink = computed<string>(() => {
		return getItemRoute(props.collection, '+');
	});

	const currentCollectionLink = computed<string>(() => {
		return getCollectionRoute(props.collection);
	});

	return { addNewLink, currentCollectionLink };
}

function useBookmarks() {
	const bookmarkDialogActive = ref(false);
	const creatingBookmark = ref(false);

	return {
		bookmarkDialogActive,
		creatingBookmark,
		createBookmark,
	};

	async function createBookmark(bookmark: { name: string | null; icon: string | null; color: string | null }) {
		creatingBookmark.value = true;

		try {
			const newBookmark = await saveCurrentAsBookmark({
				bookmark: bookmark.name,
				icon: bookmark.icon ?? 'bookmark',
				color: bookmark.color ?? null,
			});

			router.push(`${getCollectionRoute(newBookmark.collection)}?bookmark=${newBookmark.id}`);

			bookmarkDialogActive.value = false;
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			creatingBookmark.value = false;
		}
	}
}

function clearFilters() {
	filter.value = null;
	search.value = null;
}
</script>

<template>
	<component
		:is="layoutWrapper"
		ref="layoutRef"
		v-slot="{ layoutState }"
		v-model:selection="selection"
		v-model:layout-options="layoutOptions"
		v-model:layout-query="layoutQuery"
		:filter-user="filter"
		:filter-system="archiveFilter"
		:filter="mergeFilters(filter, archiveFilter)"
		:search="activeSearch"
		:collection="collection"
		:reset-preset="resetPreset"
		:clear-filters="clearFilters"
	>
		<ContentNotFound v-if="!currentCollection || isSystemCollection(collection)" />

		<PrivateView
			v-else
			fill
			:title="title"
			:icon="archive ? 'archive' : (currentCollection.icon ?? undefined)"
			:icon-color="currentCollection.color"
			:breadcrumb="breadcrumb"
		>
			<template #title-append>
				<div v-if="!shareSession" class="flex items-center gap-1">
					<BookmarkAdd
						v-if="!bookmark || (!bookmarkSaved && !bookmarkIsMine)"
						v-model="bookmarkDialogActive"
						:saving="creatingBookmark"
						@save="createBookmark"
					>
						<template #activator="{ on }">
							<button
								type="button"
								:class="BOOKMARK_BTN"
								class="text-gray-500 dark:text-gray-400"
								:aria-label="$t('create_bookmark')"
								:title="$t('create_bookmark')"
								@click="on"
							>
								<BoIcon name="bookmark" size="sm" />
							</button>
						</template>
					</BookmarkAdd>

					<span
						v-else-if="bookmarkSaved"
						class="inline-flex size-8 items-center justify-center text-brand-500 dark:text-brand-400"
					>
						<BoIcon name="bookmark" filled size="sm" />
					</span>

					<button
						v-else-if="bookmarkIsMine"
						type="button"
						:class="BOOKMARK_BTN"
						class="text-warning-600 dark:text-warning-400"
						:aria-label="$t('update_bookmark')"
						:title="$t('update_bookmark')"
						@click="savePreset()"
					>
						<BoIcon name="bookmark_save" size="sm" />
					</button>

					<button
						v-if="bookmark && !bookmarkSaving && bookmarkSaved === false"
						type="button"
						:class="BOOKMARK_BTN"
						class="text-gray-500 dark:text-gray-400"
						:aria-label="$t('reset_bookmark')"
						:title="$t('reset_bookmark')"
						@click="clearLocalSave"
					>
						<BoIcon name="settings_backup_restore" size="sm" />
					</button>
				</div>
			</template>

			<template #actions>
				<component :is="currentLayout?.slots.actions" v-if="currentLayout?.slots.actions" v-bind="layoutState" />

				<!-- Backoffice (spec 023, D-187): "JSON path" under json fields of the filter. -->
				<SearchInput
					v-model="search"
					v-model:filter="filter"
					:collection="collection"
					:show-search="showSearch"
					include-json-path
				/>

				<template v-if="selection.length > 0">
					<BoButton
						variant="secondary"
						icon="delete"
						class="hover:bg-error-600 hover:text-white"
						:aria-label="batchDeleteAllowed ? $t('delete_label') : $t('not_allowed')"
						:title="batchDeleteAllowed ? $t('delete_label') : $t('not_allowed')"
						:disabled="batchDeleteAllowed !== true"
						@click="confirmDelete = true"
					/>

					<BoButton
						v-if="currentCollection.meta && currentCollection.meta.archive_field && archive !== 'archived'"
						variant="secondary"
						icon="archive"
						:aria-label="batchArchiveAllowed ? $t('archive') : $t('not_allowed')"
						:title="batchArchiveAllowed ? $t('archive') : $t('not_allowed')"
						:disabled="batchArchiveAllowed !== true"
						@click="confirmArchive = true"
					/>

					<BoButton
						variant="secondary"
						icon="edit"
						:aria-label="batchEditAllowed ? $t('edit') : $t('not_allowed')"
						:title="batchEditAllowed ? $t('edit') : $t('not_allowed')"
						:disabled="batchEditAllowed === false"
						@click="batchEditActive = true"
					/>
				</template>

				<BoButton
					icon="add"
					v-bind="createAllowed ? { to: addNewLink } : {}"
					:disabled="createAllowed === false"
					:aria-label="createAllowed ? $t('create_item') : $t('not_allowed')"
					:title="createAllowed ? $t('create_item') : $t('not_allowed')"
				/>
			</template>

			<template #navigation>
				<ContentNavigation :current-collection="collection" />
			</template>

			<FlowDialogs v-bind="flowDialogsContext" />

			<BoDialog v-model:open="confirmDelete" :title="$t('batch_delete_confirm', selection.length)">
				<template #actions>
					<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
					<BoButton variant="danger" :loading="deleting" @click="batchDelete">{{ $t('delete_label') }}</BoButton>
				</template>
			</BoDialog>

			<BoDialog v-model:open="confirmArchive" :title="$t('archive_confirm_count', selection.length)">
				<template #actions>
					<BoButton variant="secondary" @click="confirmArchive = false">{{ $t('cancel') }}</BoButton>
					<BoButton :loading="archiving" @click="archiveItems">{{ $t('archive') }}</BoButton>
				</template>
			</BoDialog>

			<BoDialog
				:open="deleteError !== null"
				:title="$t('something_went_wrong')"
				v-bind="deleteError ? { description: translateAPIError(deleteError) } : {}"
				@update:open="!$event && (deleteError = null)"
			>
				<template #actions>
					<BoButton @click="deleteError = null">{{ $t('done') }}</BoButton>
				</template>
			</BoDialog>

			<DrawerBatch
				v-model:active="batchEditActive"
				:primary-keys="selection as unknown as PrimaryKey[]"
				:collection="collection"
				@refresh="batchRefresh"
			/>

			<BoInfo
				v-if="bookmark && bookmarkExists === false"
				type="warning"
				:title="$t('bookmark_doesnt_exist')"
				icon="bookmark"
			>
				{{ $t('bookmark_doesnt_exist_copy') }}

				<template #append>
					<BoButton :to="currentCollectionLink">
						{{ $t('bookmark_doesnt_exist_cta') }}
					</BoButton>
				</template>
			</BoInfo>

			<component :is="currentLayout?.component" v-else v-bind="layoutState">
				<template #no-results>
					<BoInfo :title="$t('no_results')" icon="search">
						{{ $t('no_results_copy') }}

						<template #append>
							<BoButton @click="clearFilters">{{ $t('clear_filters') }}</BoButton>
						</template>
					</BoInfo>
				</template>

				<template #no-items>
					<BoInfo :title="$t('item_count', 0)" :icon="currentCollection.icon ?? 'box'">
						{{ $t('no_items_copy') }}

						<template v-if="createAllowed" #append>
							<BoButton :to="getItemRoute(collection, '+')">{{ $t('create_item') }}</BoButton>
						</template>
					</BoInfo>
				</template>

				<template #error="{ error, reset }">
					<BoInfo type="danger" :title="$t('unexpected_error')" icon="error">
						{{ $t('unexpected_error_copy') }}

						<template #append>
							<!-- Backoffice: v-error shows the error code; the full error stays in the console. -->
							<code
								class="rounded-lg bg-gray-100 px-3 py-1 text-theme-xs text-gray-700 dark:bg-white/5 dark:text-white/80"
							>
								{{ extractErrorCode(error) }}
							</code>

							<BoButton variant="secondary" @click="reset">
								{{ $t('reset_page_preferences') }}
							</BoButton>
						</template>
					</BoInfo>
				</template>
			</component>

			<template #sidebar>
				<LayoutSidebarDetail v-model="layout">
					<component :is="currentLayout?.slots.options" v-if="currentLayout?.slots.options" v-bind="layoutState" />
				</LayoutSidebarDetail>
				<component :is="currentLayout?.slots.sidebar" v-if="currentLayout?.slots.sidebar" v-bind="layoutState" />
				<ArchiveSidebarDetail v-if="hasArchive" :collection="collection" :archive="archive" />
				<RefreshSidebarDetail v-model="refreshInterval" @refresh="refresh" />
				<ExportSidebarDetail
					v-if="showImport || showExport"
					:collection="collection"
					:show-import="showImport"
					:show-export="showExport"
					:filter="mergeFilters(filter, archiveFilter) ?? undefined"
					:search="activeSearch ?? undefined"
					:layout-query="layoutQuery"
					:on-download="downloadHandler"
					@refresh="refresh"
				/>
				<FlowSidebarDetail :manual-flows="manualFlows" />
			</template>
		</PrivateView>
	</component>
</template>
