<!-- Ported from directus/app/src/layouts/map/components/map.vue -->
<script setup lang="ts">
// Backoffice: Map frame recipe of 013 (recipe Q-6): zoom, location, fit data and box select are theme buttons with
// aria-labels driving the map API and the BoxSelectControl (the library control groups are hidden), Shift + drag still
// box-selects like Directus; the geocoder and its CSS load only with a Mapbox key (FR-039, FR-112).
// Backoffice: maplibre-gl 6.14.0 instead of 1.15.3 (D-62): no `accessToken` option (getMapboxTransformRequest),
// `maplibregl-*` classes, getClusterExpansionZoom returns a promise, the worker URL comes from the bundle.
// Backoffice: `showSelect` comes from the layout props (Directus leaves the default `multiple`), so a single select
// replaces the selection (FR-020).
import type { ShowSelect } from '@directus/types';
import { useResizeObserver } from '@vueuse/core';
import type { BBox, FeatureCollection, Point } from 'geojson';
import { debounce } from 'lodash-es';
import * as maplibre from 'maplibre-gl';
import {
	type AddLayerObject,
	AttributionControl,
	type CameraOptions,
	type GeoJSONSource,
	GeolocateControl,
	type LngLatBoundsLike,
	type LngLatLike,
	Map,
	type MapGeoJSONFeature,
	type MapLayerMouseEvent,
	setWorkerUrl,
} from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch, type WatchStopHandle } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../components/BoIcon.vue';
import { useAppStore } from '../../../stores/app.ts';
import { useSettingsStore } from '../../../stores/settings.ts';
import {
	getBasemapSources,
	getMapboxTransformRequest,
	getStyleFromBasemapSource,
} from '../../../utils/geometry/basemap.ts';
import { BoxSelectControl } from '../../../utils/geometry/controls.ts';

import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(maplibreWorkerUrl);

const ACTIVE_LAYERS = ['__directus_polygons', '__directus_points', '__directus_lines'];

const props = withDefaults(
	defineProps<{
		data: FeatureCollection;
		source: Record<string, any>;
		layers?: AddLayerObject[];
		camera?: (CameraOptions & { bbox: any }) | undefined;
		bounds?: BBox | undefined;
		featureId?: string | null | undefined;
		selection?: (string | number)[];
		showSelect?: ShowSelect;
	}>(),
	{
		layers: () => [],
		camera: () => ({}) as any,
		bounds: undefined,
		featureId: undefined,
		selection: () => [],
		showSelect: 'multiple',
	},
);

const emit = defineEmits(['moveend', 'featureclick', 'featureselect', 'fitdata', 'updateitempopup']);

const { t } = useI18n();
const settingsStore = useSettingsStore();
let map: Map;
const hoveredFeature = ref<MapGeoJSONFeature>();
const hoveredCluster = ref<boolean>();
const selectMode = ref<boolean>();
const container = useTemplateRef<HTMLElement>('container');
const unwatchers = [] as WatchStopHandle[];
const { basemap } = storeToRefs(useAppStore());
const mapboxKey = settingsStore.settings?.['mapbox_key'] as string | null | undefined;
const basemaps = getBasemapSources();

const style = computed(() => {
	const source = basemaps.find((source) => source.name === basemap.value) ?? basemaps[0];
	if (!source) return;
	return getStyleFromBasemapSource(source);
});

const attributionControl = new AttributionControl();

const geolocateControl = new GeolocateControl({});

const boxSelectControl = new BoxSelectControl({
	boxElementClass:
		'pointer-events-none absolute start-0 top-0 z-10 rounded-sm border-2 border-brand-500 bg-brand-500/10 dark:border-brand-400',
	selectButtonClass: 'maplibregl-ctrl-select',
	layers: ACTIVE_LAYERS,
});

let unmounted = false;

onMounted(() => {
	setupMap();
	loadGeocoder();
});

onUnmounted(() => {
	unmounted = true;
	map.remove();
});

useResizeObserver(
	container,
	debounce(() => {
		map?.resize();
	}, 50),
);

function setupMap() {
	map = new Map({
		container: container.value!,
		style: style.value!,
		dragRotate: false,
		attributionControl: false,
		...props.camera,
		...(mapboxKey ? { transformRequest: getMapboxTransformRequest(mapboxKey) } : {}),
	} as any);

	map.addControl(attributionControl, 'bottom-left');
	map.addControl(geolocateControl, 'top-left');
	map.addControl(boxSelectControl, 'top-left');

	map.on('load', () => {
		watch(() => style.value, updateStyle);
		watch(() => props.bounds, fitBounds);

		for (const layer of ACTIVE_LAYERS) {
			map.on('click', layer, onFeatureClick);
			map.on('mousemove', layer, updatePopup);
			map.on('mouseleave', layer, updatePopup);
		}

		map.on('move', updatePopupLocation as any);
		map.on('click', '__directus_clusters', expandCluster);
		map.on('mousemove', '__directus_clusters', hoverCluster);
		map.on('mouseleave', '__directus_clusters', hoverCluster);
		// The box select events are custom: not in the MapLibre event map.
		map.on('select.enable' as any, () => (selectMode.value = true));
		map.on('select.disable' as any, () => (selectMode.value = false));

		map.on('select.end' as any, (event: MapLayerMouseEvent & { alt: unknown }) => {
			const ids = event.features?.map((f) => f.id);
			emit('featureselect', { ids, replace: !event.alt });
		});

		map.on('moveend', () => {
			emit('moveend', {
				center: map.getCenter(),
				zoom: map.getZoom(),
				bearing: map.getBearing(),
				pitch: map.getPitch(),
				bbox: map.getBounds().toArray().flat(),
			});
		});

		startWatchers();
	});
}

// Backoffice: the geocoder (and its CSS) is a separate chunk loaded only when settings have a Mapbox key (FR-039).
async function loadGeocoder() {
	if (!mapboxKey) return;

	const [{ default: MapboxGeocoder }] = await Promise.all([
		import('@mapbox/mapbox-gl-geocoder'),
		import('@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'),
	]);

	if (unmounted) return;

	const marker = document.createElement('div');
	// The dot does not catch clicks meant for the map: styles/lib/_mapbox.scss:54-59.
	marker.className = 'maplibregl-user-location-dot pointer-events-none';

	const geocoderControl = new MapboxGeocoder({
		accessToken: mapboxKey,
		collapsed: true,
		marker: { element: marker } as any,
		flyTo: { speed: 1.4 },
		mapboxgl: maplibre as any,
		placeholder: t('layouts.map.find_location'),
	});

	map.addControl(geocoderControl, 'top-right');
}

function fitBounds() {
	const bbox = props.data.bbox;

	if (map && bbox) {
		map.fitBounds(bbox as LngLatBoundsLike, {
			padding: 100,
			speed: 1.3,
			maxZoom: 14,
		});
	}
}

function updateStyle(style: any) {
	unwatchers.forEach((unwatch) => unwatch());
	unwatchers.length = 0;
	map.setStyle(style, { diff: false });
	map.once('styledata', startWatchers);
}

function startWatchers() {
	unwatchers.push(
		watch(() => props.source, updateSource, { immediate: true }),
		watch(() => props.selection, updateSelection, { immediate: true }),
		watch(() => props.layers, updateLayers),
		watch(() => props.data, updateData),
	);
}

function updateData(newData: any) {
	const source = map.getSource('__directus');
	(source as GeoJSONSource).setData(newData);
	updateSelection(props.selection, undefined);
}

function updateSource(newSource: Record<string, any>) {
	const layersId = new Set(map.getStyle().layers?.map(({ id }) => id));

	for (const layer of props.layers) {
		if (layersId.has(layer.id)) {
			map.removeLayer(layer.id);
		}
	}

	// Backoffice: a copy, the layout state owns the source object (Directus mutates the prop).
	const source: Record<string, any> = { ...newSource };

	if (props.featureId) {
		source['promoteId'] = props.featureId;
	} else {
		source['generateId'] = true;
	}

	if (map.getStyle().sources?.['__directus']) {
		map.removeSource('__directus');
	}

	map.addSource('__directus', { ...source, data: props.data } as any);

	map.once('sourcedata', () => {
		setTimeout(() => props.layers.forEach((layer) => map.addLayer(layer)));
	});
}

function updateLayers(newLayers?: AddLayerObject[], previousLayers?: AddLayerObject[]) {
	const currentMapLayersId = new Set(map.getStyle().layers?.map(({ id }) => id));

	previousLayers?.forEach((layer) => {
		if (currentMapLayersId.has(layer.id)) map.removeLayer(layer.id);
	});

	newLayers?.forEach((layer) => {
		map.addLayer(layer);
	});
}

function updateSelection(newSelection?: (string | number)[], previousSelection?: (string | number)[]) {
	previousSelection?.forEach((id) => {
		map.setFeatureState({ id, source: '__directus' }, { selected: false });
		map.removeFeatureState({ id, source: '__directus' });
	});

	newSelection?.forEach((id) => {
		map.setFeatureState({ id, source: '__directus' }, { selected: true });
	});
}

function onFeatureClick(event: MapLayerMouseEvent) {
	const feature = event.features?.[0];
	const replace = props.showSelect === 'multiple' ? false : !event.originalEvent.altKey;

	if (feature && props.featureId) {
		if (boxSelectControl.active()) {
			emit('featureselect', { ids: [feature.id], replace });
		} else {
			emit('featureclick', { id: feature.id, replace });
		}
	}
}

function updatePopup(event: MapLayerMouseEvent) {
	const feature = map.queryRenderedFeatures(event.point, {
		layers: ACTIVE_LAYERS,
	})[0];

	const previousId = hoveredFeature.value?.id;
	const featureChanged = previousId !== feature?.id;

	if (previousId && featureChanged) {
		map.setFeatureState({ id: previousId, source: '__directus' }, { hovered: false });
	}

	if (feature && feature.properties) {
		if (feature.geometry.type === 'Point') {
			const { x, y } = map.project(feature.geometry.coordinates as LngLatLike);
			const rect = map.getContainer().getBoundingClientRect();
			emit('updateitempopup', { position: { x: rect.x + x, y: rect.y + y } });
		} else {
			const { clientX: x, clientY: y } = event.originalEvent;
			emit('updateitempopup', { position: { x, y } });
		}

		if (featureChanged) {
			map.setFeatureState({ id: feature.id, source: '__directus' }, { hovered: true });
			hoveredFeature.value = feature;
			emit('updateitempopup', { item: feature.id });
		}
	} else {
		if (featureChanged) {
			hoveredFeature.value = feature;
			emit('updateitempopup', { item: null });
		}
	}
}

function updatePopupLocation(event: MapLayerMouseEvent) {
	if (hoveredFeature.value && event.originalEvent) {
		const { x, y } = event.originalEvent;
		emit('updateitempopup', { position: { x, y } });
	}
}

async function expandCluster(event: MapLayerMouseEvent) {
	const features = map.queryRenderedFeatures(event.point, {
		layers: ['__directus_clusters'],
	});

	const clusterId = features[0]?.properties?.['cluster_id'];
	const source = map.getSource('__directus') as GeoJSONSource;

	try {
		const zoom = await source.getClusterExpansionZoom(clusterId);

		map.flyTo({
			center: (features[0]?.geometry as Point).coordinates as LngLatLike,
			zoom: zoom,
			speed: 1.3,
		});
	} catch {
		return;
	}
}

function hoverCluster(event: MapLayerMouseEvent) {
	if (event.type == 'mousemove') {
		hoveredCluster.value = true;
	} else {
		hoveredCluster.value = false;
	}
}

// Backoffice: the theme control buttons (recipe Q-6 with the 013 map control classes).
function zoomIn() {
	map.zoomIn();
}

function zoomOut() {
	map.zoomOut();
}

function geolocate() {
	geolocateControl.trigger();
}

function toggleBoxSelect() {
	boxSelectControl.activate(!boxSelectControl.shiftPressed);
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const CONTROL = `flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-700 shadow-theme-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 ${FOCUS} dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-dark aria-pressed:bg-brand-50 aria-pressed:text-brand-600 dark:aria-pressed:bg-brand-500/15 dark:aria-pressed:text-brand-400`;
const CANVAS_FOCUS =
	'[&_.maplibregl-canvas:focus-visible]:outline-2 [&_.maplibregl-canvas:focus-visible]:-outline-offset-2 [&_.maplibregl-canvas:focus-visible]:outline-brand-500 dark:[&_.maplibregl-canvas:focus-visible]:outline-brand-400';
</script>

<template>
	<div class="relative h-full w-full">
		<!-- The library's own control groups (geolocate, box select) are hidden: the buttons below drive them. The
			top-right controls (geocoder) keep to 80% of the width: styles/lib/_mapbox.scss:193-195. -->
		<div
			ref="container"
			data-map
			class="h-full w-full [&_.maplibregl-ctrl-group]:hidden [&_.maplibregl-ctrl-top-right]:max-w-[80%]"
			:class="[
				CANVAS_FOCUS,
				{
					'[&_.maplibregl-canvas-container]:cursor-crosshair!': selectMode,
					'[&_.maplibregl-canvas-container]:cursor-pointer!': !selectMode && (hoveredFeature || hoveredCluster),
				},
			]"
		/>
		<div class="absolute start-3 top-3 flex flex-col gap-2">
			<button type="button" :class="CONTROL" :aria-label="t('map_zoom_in')" data-control="zoom-in" @click="zoomIn">
				<BoIcon name="add" size="sm" />
			</button>
			<button type="button" :class="CONTROL" :aria-label="t('map_zoom_out')" data-control="zoom-out" @click="zoomOut">
				<BoIcon name="remove" size="sm" />
			</button>
			<button
				type="button"
				:class="CONTROL"
				:aria-label="t('map_geolocate')"
				data-control="geolocate"
				@click="geolocate"
			>
				<BoIcon name="my_location" size="sm" />
			</button>
			<button
				type="button"
				:class="CONTROL"
				:aria-label="t('interfaces.map.fit_bounds')"
				data-control="fit"
				@click="emit('fitdata')"
			>
				<BoIcon name="fit_screen" size="sm" />
			</button>
			<button
				type="button"
				:class="CONTROL"
				:aria-label="t('map_box_select')"
				:aria-pressed="!!selectMode"
				data-control="select"
				@click="toggleBoxSelect"
			>
				<BoIcon name="highlight_alt" size="sm" />
			</button>
		</div>
	</div>
</template>
