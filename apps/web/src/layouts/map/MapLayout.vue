<!-- Ported from directus/app/src/layouts/map/map.vue -->
<script setup lang="ts">
// Backoffice: map frame of recipe Q-6: full content height in a `rounded-2xl border` card, the item popup is a
// theme popover with RenderTemplate, the geometry error is a danger BoNotice over the map (role="alert"), a missing
// geometry field shows the `no_compatible_fields` empty block, the footer is BoPagination + BoSelect (limit).
import type { GeometryOptions, ShowSelect } from '@directus/types';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoInfo from '../../components/BoInfo.vue';
import BoNotice from '../../components/BoNotice.vue';
import BoPagination from '../../components/BoPagination.vue';
import BoProgressCircular from '../../components/BoProgressCircular.vue';
import BoSelect from '../../components/BoSelect.vue';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import { usePageSize } from '../../composables/use-page-size.ts';
import MapView from './components/MapView.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		collection: string;
		geojson: any;
		directusSource: any;
		directusLayers: any[];
		handleClick: (event: { id: string | number; replace: boolean }) => void;
		handleSelect: (event: { ids: Array<string | number>; replace: boolean }) => void;
		resetPresetAndRefresh: () => Promise<void>;
		fitDataBounds: () => void;
		updateItemPopup: (update: { item?: any; position?: { x: number; y: number } }) => void;
		geojsonLoading: boolean;
		loading: boolean;
		totalCount: number | null;
		totalPages: number;
		page: number;
		toPage: (newPage: number) => void;
		limit: number;
		selection?: (string | number)[];
		showSelect?: ShowSelect;
		error?: any;
		geojsonError?: string | null;
		geometryOptions?: GeometryOptions | undefined;
		featureId?: string | null;
		geojsonBounds?: any;
		cameraOptions?: any;
		template?: string;
		itemPopup?: { item?: any; position?: { x: number; y: number } };
		info?: { name?: string } | null;
	}>(),
	{
		selection: () => [],
		showSelect: 'multiple',
		error: null,
		geojsonError: null,
		geometryOptions: undefined,
		featureId: null,
		geojsonBounds: undefined,
		cameraOptions: undefined,
		template: '',
		itemPopup: () => ({ item: null }),
		info: null,
	},
);

const emit = defineEmits<{ 'update:cameraOptions': [value: any]; 'update:limit': [value: number] }>();

const { n } = useI18n();

const limitWritable = computed({
	get: () => props.limit,
	set: (value: number) => emit('update:limit', value),
});

const { sizes: pageSizes, selected: selectedSize } = usePageSize<{ text: string; value: string }>(
	[100, 1000, 10000, 100000],
	(value) => ({ text: n(value), value: String(value) }),
	props.limit,
);

limitWritable.value = selectedSize;
</script>

<template>
	<div
		class="relative h-full min-h-80 w-full flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]"
		data-layout="map"
		:aria-busy="loading || geojsonLoading"
	>
		<!-- Fills the page content height like Directus `.layout-map { block-size: 100% }` (map.vue:153-157); 20rem at least outside a flex page,
		     where the map is laid over the box (a percent height of a min-height box is 0). -->
		<MapView
			class="absolute! inset-0 transition-opacity motion-reduce:transition-none"
			:class="{ 'opacity-90': loading, 'opacity-40': error || geojsonError || !geometryOptions }"
			:data="geojson"
			:feature-id="featureId"
			:selection="selection"
			:show-select="showSelect"
			:camera="cameraOptions"
			:bounds="geojsonBounds"
			:source="directusSource"
			:layers="directusLayers"
			@featureclick="handleClick"
			@featureselect="handleSelect"
			@moveend="emit('update:cameraOptions', $event)"
			@fitdata="fitDataBounds"
			@updateitempopup="updateItemPopup"
		/>

		<div
			v-if="itemPopup.item"
			class="pointer-events-none fixed z-99999 max-w-[80%] -translate-x-1/2 -translate-y-[140%] rounded-lg bg-white px-3 py-2 text-theme-sm font-medium text-gray-800 shadow-theme-lg dark:bg-gray-dark dark:text-white/90"
			data-popup
			:style="{ insetBlockStart: itemPopup.position!.y + 'px', insetInlineStart: itemPopup.position!.x + 'px' }"
		>
			<RenderTemplate :template="template" :item="itemPopup.item" :collection="collection" />
		</div>

		<div
			v-if="error || geojsonError || loading || geojsonLoading || !geometryOptions"
			class="pointer-events-none absolute inset-0 flex items-center justify-center p-6"
		>
			<div v-if="error" class="pointer-events-auto rounded-2xl bg-white p-6 dark:bg-gray-dark">
				<slot name="error" :error="error" :reset="resetPresetAndRefresh" />
			</div>
			<BoNotice v-else-if="geojsonError" type="danger" class="pointer-events-auto max-w-md" role="alert">
				<p class="font-medium text-gray-800 dark:text-white/90">{{ $t('layouts.map.invalid_geometry') }}</p>
				<p>{{ geojsonError }}</p>
			</BoNotice>
			<BoProgressCircular
				v-else-if="loading || geojsonLoading"
				indeterminate
				class="text-3xl text-brand-500 dark:text-brand-400"
				:aria-label="$t('loading')"
			/>
			<div v-else class="rounded-2xl bg-white p-6 dark:bg-gray-dark" data-empty="geometry">
				<BoInfo :title="$t('layouts.map.no_compatible_fields')" icon="wrong_location" />
			</div>
		</div>

		<div
			v-if="loading || (totalCount ?? 0) > 0"
			class="absolute end-0 bottom-0 flex items-center justify-between gap-3 p-3"
		>
			<div v-if="totalPages > 1" class="rounded-lg bg-white shadow-theme-sm dark:bg-gray-dark">
				<BoPagination
					:length="totalPages"
					:total-visible="7"
					show-first-last
					:label="info?.name ?? collection"
					:model-value="page"
					@update:model-value="toPage"
				/>
			</div>
			<BoSelect
				class="flex items-center gap-2 rounded-lg bg-white px-3 py-1 text-theme-sm text-gray-500 shadow-theme-sm dark:bg-gray-dark dark:text-gray-400 [&>button]:w-28 [&>label]:mb-0"
				:label="$t('limit')"
				:model-value="`${limit}`"
				:items="pageSizes"
				@update:model-value="limitWritable = +$event"
			/>
		</div>
	</div>
</template>
