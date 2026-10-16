<!-- Ported from directus/app/src/interfaces/map/options.vue -->
<script setup lang="ts">
// Backoffice (D-56 lifted): VSelect is BoSelect (`showDeselect`); maplibre-gl 6 with its worker URL like
// InterfaceMap.vue; the map box is the Input border recipe. GEOMETRY_TYPES of @directus/constants (not a dependency)
// is the same list as the map interface choices.
import type { Field, GeometryOptions, GeometryType } from '@directus/types';
import { type CameraOptions, Map, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import BoSelect from '../../components/BoSelect.vue';
import { useAppStore } from '../../stores/app.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { getBasemapSources, getStyleFromBasemapSource } from '../../utils/geometry/basemap.ts';

import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(maplibreWorkerUrl);

const GEOMETRY_TYPES = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'] as const;

const props = defineProps<{
	collection: string;
	field?: Field | undefined;
	value?: (GeometryOptions & { defaultView?: CameraOptions }) | undefined;
}>();

const emit = defineEmits(['input']);

const nativeGeometryType = computed(() => (props.field?.type.split('.')[1] as GeometryType) ?? 'Point');
const geometryType = ref<GeometryType>(nativeGeometryType.value ?? props.value?.geometryType ?? 'Point');
const defaultView = ref<CameraOptions | undefined>(props.value?.defaultView);

const settingsStore = useSettingsStore();

watch(() => props.field?.type, watchType);
watch(nativeGeometryType, watchNativeType);
watch([geometryType, defaultView], input, { immediate: true });

function watchType(type: string | undefined) {
	if (type === 'csv') geometryType.value = 'Point';
}

function watchNativeType(type: GeometryType) {
	geometryType.value = type;
}

function input() {
	emit('input', {
		defaultView,
		geometryType: geometryType.value,
	});
}

const mapContainer: Ref<HTMLElement | null> = ref(null);
let map: Map;

const mapboxKey = settingsStore.settings?.['mapbox_key'];
const basemaps = getBasemapSources();
const appStore = useAppStore();
const { basemap } = storeToRefs(appStore);

const style = computed(() => {
	const source = basemaps.find((source) => source.name == basemap.value) ?? basemaps[0];
	if (!source) return;
	return getStyleFromBasemapSource(source);
});

onMounted(() => {
	map = new Map({
		container: mapContainer.value!,
		style: style.value!,
		...(defaultView.value || {}),
		...(mapboxKey ? { accessToken: mapboxKey } : {}),
	} as never);

	map.on('moveend', () => {
		defaultView.value = {
			center: map.getCenter(),
			zoom: map.getZoom(),
			bearing: map.getBearing(),
			pitch: map.getPitch(),
		};
	});
});

onUnmounted(() => {
	map.remove();
});

const LABEL = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400';
</script>

<template>
	<div class="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
		<div v-if="!nativeGeometryType && field?.type !== 'csv'">
			<BoSelect
				:model-value="geometryType ?? null"
				@update:model-value="geometryType = $event as GeometryType"
				:label="$t('interfaces.map.geometry_type')"
				:placeholder="$t('any')"
				show-deselect
				:items="GEOMETRY_TYPES.map((value) => ({ value, text: value }))"
				@deselect="geometryType = null as never"
			/>
		</div>
		<div class="sm:col-span-2">
			<p :class="LABEL">{{ $t('interfaces.map.default_view') }}</p>
			<div ref="mapContainer" class="h-90 overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700"></div>
		</div>
	</div>
</template>
