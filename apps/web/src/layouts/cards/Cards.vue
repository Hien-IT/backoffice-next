<!-- Ported from directus/app/src/layouts/cards/cards.vue -->
<script setup lang="ts">
// Backoffice: recipe "Cards grid (Q-3)": the grid columns are `size × 40` px (Directus `size × 2.25rem`; 40 px is the
// width `isSingleRow` already uses) with `gap-6`; 12 skeleton cards while loading instead of v-progress-circular; the
// per page select sits in the header bar (recipe) with the tabular rule (shown when items >= 25 or limit < 25); the
// footer is BoPagination (no skeleton while the count loads, as tabular); no own padding (PrivateView pads the content).
// `prepend` slot, `hasPrependContent` and `extraSelection` are the Files module's folder cards (feature 015, FR-012):
// while loading with prepend content the grid keeps the prepend cards and shows skeletons for the items (Directus keeps
// the old items and no spinner).
import type { AppCollection, Field, Filter, Item, ShowSelect } from '@directus/types';
import { useElementSize } from '@vueuse/core';
import { computed, inject, ref, type Ref, watch } from 'vue';
import BoPagination from '../../components/BoPagination.vue';
import BoSelect from '../../components/BoSelect.vue';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import { usePageSize } from '../../composables/use-page-size.ts';
import Card from './components/Card.vue';
import CardsHeader from './components/CardsHeader.vue';

defineOptions({ name: 'LayoutCards', inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		collection: string;
		items: Item[];
		selection?: (number | string)[];
		selectMode: boolean;
		readonly: boolean;
		limit: number;
		size: number;
		icon: string;
		imageFit: string;
		isSingleRow: boolean;
		width: number;
		totalPages: number;
		page: number;
		toPage: (newPage: number) => void;
		getLinkForItem: (item: Record<string, any>) => string | undefined;
		fieldsInCollection: Field[];
		selectAll: () => void;
		resetPresetAndRefresh: () => Promise<void>;
		sort: string[];
		loading: boolean;
		loadingItemCount: boolean;
		showSelect?: ShowSelect;
		error?: any;
		itemCount: number | null;
		totalCount: number | null;
		primaryKeyField?: Field | null | undefined;
		imageSource?: string | null | undefined;
		title?: string | null | undefined;
		subtitle?: string | null | undefined;
		info?: AppCollection | null | undefined;
		filterUser?: Filter | null | undefined;
		search?: string | null | undefined;
		extraSelection?: (number | string)[];
		hasPrependContent?: boolean;
	}>(),
	{
		selection: () => [],
		showSelect: 'multiple',
		error: null,
		primaryKeyField: undefined,
		imageSource: undefined,
		title: undefined,
		subtitle: undefined,
		info: undefined,
		filterUser: undefined,
		search: undefined,
		extraSelection: () => [],
		hasPrependContent: false,
	},
);

const emit = defineEmits<{
	'update:selection': [value: (number | string)[]];
	'update:limit': [value: number];
	'update:size': [value: number];
	'update:sort': [value: string[]];
	'update:width': [value: number];
	'select-all': [];
	'update:extraSelection': [value: (number | string)[]];
}>();

const selectionWritable = computed({
	get: () => props.selection,
	set: (value) => emit('update:selection', value),
});

const extraSelectionWritable = computed({
	get: () => props.extraSelection,
	set: (value) => emit('update:extraSelection', value),
});

const limitWritable = computed({
	get: () => props.limit,
	set: (value: number) => emit('update:limit', value),
});

const mainElement = inject<Ref<Element | undefined> | undefined>('main-element', undefined);

const layoutElement = ref<HTMLElement>();

const { width: innerWidth } = useElementSize(layoutElement);

const columnSize = computed(() => `${props.size * 40}px`);

const gridColumns = computed(() =>
	props.isSingleRow ? `repeat(auto-fit, ${columnSize.value})` : `repeat(auto-fill, minmax(${columnSize.value}, 1fr))`,
);

const { sizes: pageSizes, selected: selectedSize } = usePageSize<{ text: string; value: string }>(
	[25, 50, 100, 250, 500, 1000],
	(value) => ({ text: String(value), value: String(value) }),
	props.limit,
);

if (limitWritable.value !== selectedSize) {
	limitWritable.value = selectedSize;
}

watch(
	() => props.page,
	() => mainElement?.value?.scrollTo({ top: 0, behavior: 'smooth' }),
);

watch(innerWidth, (value) => {
	emit('update:width', value);
});

function onSelectAll() {
	props.selectAll();
	emit('select-all');
}
</script>

<template>
	<div ref="layoutElement">
		<template v-if="loading || (items.length > 0 && !error) || hasPrependContent">
			<CardsHeader
				v-model:selection="selectionWritable"
				v-model:extra-selection="extraSelectionWritable"
				:size="size"
				:sort="sort"
				:fields="fieldsInCollection"
				:show-select="showSelect"
				@update:size="emit('update:size', $event)"
				@update:sort="emit('update:sort', $event)"
				@select-all="onSelectAll"
			>
				<template #end>
					<BoSelect
						v-if="loading === false && (items.length >= 25 || limit < 25)"
						class="flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400 [&>button]:w-24 [&>label]:mb-0"
						:label="$t('per_page')"
						:model-value="`${limit}`"
						:items="pageSizes"
						@update:model-value="limitWritable = +$event"
					/>
				</template>
			</CardsHeader>

			<div class="grid gap-6" :style="{ gridTemplateColumns: gridColumns }" :aria-busy="loading || undefined">
				<slot name="prepend" />
				<template v-if="loading">
					<Card v-for="n in 12" :key="n" item-key="" loading />
				</template>
				<template v-else>
					<Card
						v-for="item in items"
						:key="item[primaryKeyField!.field]"
						v-model="selectionWritable"
						:item-key="primaryKeyField!.field"
						:crop="imageFit === 'crop'"
						:icon="icon || undefined"
						:file="imageSource ? item[imageSource] : null"
						:item="item"
						:select-mode="selectMode || (selection && selection.length > 0)"
						:to="getLinkForItem(item)"
						:readonly="readonly"
					>
						<template v-if="title" #title>
							<RenderTemplate :collection="collection" :item="item" :template="title" />
						</template>
						<template v-if="subtitle" #subtitle>
							<RenderTemplate :collection="collection" :item="item" :template="subtitle" />
						</template>
					</Card>
				</template>
			</div>

			<div v-if="totalPages > 1" class="pt-9">
				<BoPagination
					:length="totalPages"
					:label="info?.name ?? collection"
					:model-value="page"
					@update:model-value="toPage"
				/>
			</div>
		</template>

		<slot v-else-if="error" name="error" :error="error" :reset="resetPresetAndRefresh" />
		<slot v-else-if="itemCount === 0 && (filterUser || search)" name="no-results" />
		<slot v-else-if="totalCount === 0" name="no-items" />
	</div>
</template>
