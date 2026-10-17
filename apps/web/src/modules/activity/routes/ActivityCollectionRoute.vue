<!-- Ported from directus/app/src/modules/activity/routes/collection.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-060, FR-061, FR-064): layouts render from the registry (getLayout(id).component and .slots)
// like the Content and Users lists (014 research R4) instead of global `layout-*` components; VInfo is BoInfo. The
// sub-menu filter is a local ref passed as `filter-system` (not saved in the preset, not shown in the filter UI).
import type { Filter } from '@directus/types';
import { mergeFilters } from '@directus/utils';
import { computed, ref } from 'vue';
import { RouterView } from 'vue-router';
import BoInfo from '../../../components/BoInfo.vue';
import SearchInput from '../../../components/SearchInput.vue';
import LayoutSidebarDetail from '../../../components/sidebar/LayoutSidebarDetail.vue';
import { usePreset } from '../../../composables/use-preset.ts';
import PrivateView from '../../../layout/PrivateView.vue';
import { getLayout } from '../../../layouts/index.ts';
import { useLayout } from '../../../layouts/use-layout.ts';
import ActivityNavigation from '../components/ActivityNavigation.vue';

defineProps<{
	primaryKey?: string;
}>();

const { layout, layoutOptions, layoutQuery, filter, search } = usePreset(ref('directus_activity'));

const { layoutWrapper } = useLayout(layout);

// Backoffice: the layout config whose component and slots render inside the wrapper (tabular when unknown).
const currentLayout = computed(() => getLayout(layout.value) ?? getLayout('tabular'));

const roleFilter = ref<Filter | null>(null);
</script>

<template>
	<component
		:is="layoutWrapper"
		v-slot="{ layoutState }"
		v-model:layout-options="layoutOptions"
		v-model:layout-query="layoutQuery"
		:filter="mergeFilters(filter, roleFilter)"
		:filter-user="filter"
		:filter-system="roleFilter"
		:search="search"
		show-select="none"
		collection="directus_activity"
	>
		<PrivateView fill :title="$t('activity_feed')" icon="access_time">
			<template #actions>
				<component :is="currentLayout?.slots.actions" v-if="currentLayout?.slots.actions" v-bind="layoutState" />

				<SearchInput v-model="search" v-model:filter="filter" collection="directus_activity" />
			</template>

			<template #navigation>
				<ActivityNavigation v-model:filter="roleFilter" />
			</template>

			<component :is="currentLayout?.component" v-bind="layoutState">
				<template #no-results>
					<BoInfo :title="$t('no_results')" icon="search">
						{{ $t('no_results_copy') }}
					</BoInfo>
				</template>

				<template #no-items>
					<BoInfo :title="$t('item_count', 0)" icon="access_time">
						{{ $t('no_items_copy') }}
					</BoInfo>
				</template>
			</component>

			<RouterView name="detail" :primary-key="primaryKey" />

			<template #sidebar>
				<LayoutSidebarDetail v-model="layout">
					<component :is="currentLayout?.slots.options" v-if="currentLayout?.slots.options" v-bind="layoutState" />
				</LayoutSidebarDetail>
				<component :is="currentLayout?.slots.sidebar" v-if="currentLayout?.slots.sidebar" v-bind="layoutState" />
			</template>
		</PrivateView>
	</component>
</template>
