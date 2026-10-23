<!-- Ported from directus/app/src/modules/settings/routes/marketplace/routes/registry/registry.vue -->
<script setup lang="ts">
// Backoffice (spec 020 US6, recipe Q-42): PrivateView with the settings sub-menu; the DR banner (logo SVG) is
// the page title; skeleton cards until the first answer, the registry error in a danger BoNotice, BoInfo when empty.
// The list request is apiFetch (the SDK drops `meta`) with the query of the DR axios call (null values left
// out, `filter[type][_eq]` bracket keys).
import { isEqual } from 'lodash-es';
import { useRouteQuery } from '@vueuse/router';
import { computed, ref, watch, watchEffect } from 'vue';
import { apiFetch } from '../../../../api/sdk.ts';
import BoInfo from '../../../../components/BoInfo.vue';
import BoNotice from '../../../../components/BoNotice.vue';
import BoPagination from '../../../../components/BoPagination.vue';
import PrivateView from '../../../../layout/PrivateView.vue';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import ExtensionListItem from './components/ExtensionListItem.vue';
import InlineFilter from './components/InlineFilter.vue';
import type { RegistryListItem, RegistryListResponse } from './types.ts';
import { registryError } from './utils/registry-error.ts';

const perPage = 10;

const page = useRouteQuery('page', 1, {
	transform: (value) => Number(Array.isArray(value) ? value[0] : value) || 1,
});

const search = useRouteQuery<string | null>('search', null, {
	transform: (value) => (Array.isArray(value) ? value[0] : value),
});

const type = useRouteQuery<string | null>('type', null, {
	transform: (value) => (Array.isArray(value) ? value[0] : value),
});

const sort = useRouteQuery<'popular' | 'recent' | 'downloads'>('sort', 'popular');

watch([search, sort, type], (newVal, oldVal) => {
	if (isEqual(newVal, oldVal) === false) {
		page.value = 1;
	}
});

const filterCount = ref(0);

const extensions = ref<RegistryListItem[] | null>(null);
const pageCount = computed(() => Math.ceil(filterCount.value / perPage));
const loading = ref(false);
const error = ref<unknown>(null);

watchEffect(async () => {
	loading.value = true;

	try {
		error.value = null;

		const params = new URLSearchParams();
		if (search.value !== null && search.value !== undefined) params.set('search', search.value);
		params.set('limit', String(perPage));
		params.set('offset', String((page.value - 1) * perPage));
		if (type.value !== null && type.value !== undefined) params.set('filter[type][_eq]', type.value);
		params.set('sort', sort.value);

		const response = await apiFetch(`/extensions/registry?${params}`);
		const data = await response.json();
		if (!response.ok) throw data;

		filterCount.value = (data as RegistryListResponse).meta.filter_count;
		extensions.value = (data as RegistryListResponse).data;
	} catch (err) {
		error.value = err;
	} finally {
		loading.value = false;
	}
});
</script>

<template>
	<PrivateView :title="$t('marketplace')" icon="storefront" :breadcrumb="[{ name: $t('settings'), to: '/settings' }]">
		<template #navigation>
			<SettingsNavigation />
		</template>

		<div class="max-w-5xl">
			<InlineFilter
				v-model:type="type"
				v-model:sort="sort"
				v-model:search="search"
				:page="page"
				:filter-count="filterCount"
				:per-page="perPage"
			/>

			<BoNotice v-if="error && !loading" type="danger">{{ registryError(error) }}</BoNotice>

			<div v-else-if="!error && extensions === null && loading" class="space-y-2" aria-busy="true">
				<div
					v-for="n in 5"
					:key="n"
					class="h-24 animate-pulse rounded-xl bg-gray-100 motion-reduce:animate-none dark:bg-gray-800"
				/>
			</div>

			<ul
				v-if="!error && extensions !== null && extensions.length > 0"
				class="m-0 space-y-2 p-0 transition-opacity motion-reduce:transition-none"
				:class="{ 'opacity-50': loading }"
				:aria-busy="loading"
			>
				<ExtensionListItem
					v-for="extension in extensions"
					:key="extension.id"
					:extension="extension"
					:show-type="!type"
				/>
			</ul>

			<BoInfo v-if="extensions?.length === 0 && !loading && !error" :title="$t('no_results')" icon="search">
				{{ $t('no_results_copy') }}
			</BoInfo>

			<BoPagination
				v-if="pageCount > 1"
				v-model="page"
				class="mt-4"
				:length="pageCount"
				:total-visible="5"
				show-first-last
				:label="$t('marketplace')"
			/>
		</div>
	</PrivateView>
</template>
