<!-- Ported from directus/app/src/modules/settings/routes/marketplace/routes/registry/components/inline-filter.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-42): the toolbar row (search BoInput with a leading icon, type and sort BoSelects with sr-only
// labels, the item count at the end). The search debounce stays the Directus 300 ms. BoSelect values cannot be empty
// (Reka), so "all types" is the `all` value here and null in the model, as in Directus.
import { watchDebounced } from '@vueuse/core';
import { computed, ref, toRefs, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../../../components/BoIcon.vue';
import BoInput from '../../../../../components/BoInput.vue';
import BoSelect, { type BoSelectItem } from '../../../../../components/BoSelect.vue';
import { formatItemsCountPaginated } from '../../../../../utils/format-items-count.ts';
import { extensionTypeIconMap } from '../../extensions/constants.ts';

// EXTENSION_TYPES of @directus/constants (the web app does not depend on it, as stores/extensions.ts).
const EXTENSION_TYPES = [
	'interface',
	'display',
	'layout',
	'module',
	'panel',
	'theme',
	'hook',
	'endpoint',
	'operation',
	'bundle',
] as const;

const ALL = 'all';

const type = defineModel<string | null>('type', { default: null });
const sort = defineModel<string | null>('sort', { default: null });
const search = defineModel<string | null>('search', { default: null });

const props = defineProps<{
	page: number;
	filterCount: number;
	perPage: number;
}>();

const searchInputValue = ref(search.value);

watchDebounced(
	searchInputValue,
	(val) => {
		if (val === search.value) return;

		if (val && val.length > 0) {
			search.value = val;
		} else {
			search.value = null;
		}
	},
	{ debounce: 300 },
);

const { t, n } = useI18n();
const { filterCount, page, perPage } = toRefs(props);

const showingCount = computed(() =>
	formatItemsCountPaginated({
		currentItems: filterCount.value,
		currentPage: page.value,
		perPage: perPage.value,
		isFiltered: !!search.value,
		i18n: { t, n },
	}),
);

const typeOptions: BoSelectItem[] = [
	{
		text: t('all'),
		value: ALL,
		icon: 'category',
	},
	...EXTENSION_TYPES.map((type) => ({
		text: t(`extension_${type}s`),
		value: type,
		icon: extensionTypeIconMap[type],
	})),
];

const sortOptions: BoSelectItem[] = [
	{
		text: t('popular'),
		value: 'popular',
	},
	{
		text: t('recent'),
		value: 'recent',
	},
	{
		text: t('downloads'),
		value: 'downloads',
	},
];

const typeModel = computed({
	get: () => type.value ?? ALL,
	set: (value: string) => (type.value = value === ALL ? null : value),
});

const ids = { search: useId(), type: useId(), sort: useId() };
</script>

<template>
	<div class="mb-4 flex flex-wrap items-center gap-3">
		<div class="relative w-full sm:w-64">
			<label :for="ids.search" class="sr-only">{{ $t('search') }}</label>
			<BoIcon
				name="search"
				size="sm"
				class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
			/>
			<BoInput
				:id="ids.search"
				v-model="searchInputValue"
				type="search"
				autofocus
				:placeholder="$t('search_extensions')"
				class="ps-10!"
			/>
		</div>

		<div class="w-full sm:w-52">
			<label :for="ids.type" class="sr-only">{{ $t('type') }}</label>
			<BoSelect :id="ids.type" v-model="typeModel" :items="typeOptions" />
		</div>

		<div class="w-full sm:w-44">
			<label :for="ids.sort" class="sr-only">{{ $t('sort') }}</label>
			<BoSelect :id="ids.sort" v-model="sort" :items="sortOptions">
				<template #prepend><BoIcon name="sort" size="sm" /></template>
			</BoSelect>
		</div>

		<div v-show="filterCount !== 0" class="ms-auto text-theme-sm text-gray-500 dark:text-gray-400" aria-live="polite">
			{{ showingCount }}
		</div>
	</div>
</template>
