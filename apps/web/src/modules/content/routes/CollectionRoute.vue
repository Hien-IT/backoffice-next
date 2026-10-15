<!-- Ported from directus/app/src/modules/content/routes/collection.vue -->
<script setup lang="ts">
// Backoffice: user story 1 of feature 014 (FR-006, FR-008, FR-020 to FR-028): layout, preset, archive filter, create
// button, empty and error states, layout options in the detail panel. Search, filter, bookmarks, batch actions, export,
// import, refresh and flows are added by the later tasks of user stories 3 and 5 (T050-T054, T081-T090). Layouts render
// from the registry (getLayout(id).component and .slots) instead of global `layout-*` components (research R4).
import type { Filter } from '@directus/types';
import { mergeFilters } from '@directus/utils';
import { computed, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../components/BoButton.vue';
import BoInfo from '../../../components/BoInfo.vue';
import LayoutSidebarDetail from '../../../components/sidebar/LayoutSidebarDetail.vue';
import { useCollection } from '../../../composables/use-collection.ts';
import { useCollectionPermissions } from '../../../composables/use-permissions/index.ts';
import { usePreset } from '../../../composables/use-preset.ts';
import PrivateView from '../../../layout/PrivateView.vue';
import { getLayout } from '../../../layouts/index.ts';
import { useLayout } from '../../../layouts/use-layout.ts';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { extractErrorCode } from '../../../utils/extract-error-code.ts';
import { getCollectionRoute, getItemRoute, isSystemCollection } from '../../../utils/get-item-route.ts';
import ContentNavigation from '../components/ContentNavigation.vue';
import ContentNotFound from './ContentNotFound.vue';

type Item = {
	[field: string]: any;
};

const props = defineProps<{
	collection: string;
	bookmark?: string | undefined;
	archive?: string | null | undefined;
}>();

const { t } = useI18n();

const layoutRef = ref();

const { collection } = toRefs(props);
const bookmarkID = computed(() => (props.bookmark ? +props.bookmark : null));

const { selection } = useSelection();
const { info: currentCollection } = useCollection(collection);
const { addNewLink } = useLinks();
const { breadcrumb } = useBreadcrumb();

const { layout, layoutOptions, layoutQuery, filter, search, bookmarkTitle, resetPreset } = usePreset(
	collection,
	bookmarkID,
);

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

const { createAllowed } = useCollectionPermissions(collection);

const permissionsStore = usePermissionsStore();

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

function useBreadcrumb() {
	// Backoffice: the bookmark breadcrumb (`breadcrumb`) and the default one (`Content`) of the Directus headline.
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

	return { addNewLink };
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
		:search="search"
		:collection="collection"
		:reset-preset="resetPreset"
		:clear-filters="clearFilters"
	>
		<ContentNotFound v-if="!currentCollection || isSystemCollection(collection)" />

		<PrivateView
			v-else
			:title="title"
			:icon="archive ? 'archive' : (currentCollection.icon ?? undefined)"
			:icon-color="currentCollection.color"
			:breadcrumb="breadcrumb"
		>
			<template #actions>
				<component :is="currentLayout?.slots.actions" v-if="currentLayout?.slots.actions" v-bind="layoutState" />

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

			<component :is="currentLayout?.component" v-bind="layoutState">
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
			</template>
		</PrivateView>
	</component>
</template>
