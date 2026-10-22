<!-- Ported from directus/app/src/interfaces/map/map.vue -->
<script setup lang="ts">
// Backoffice: Map frame recipe (FR-063, FR-095): zoom, location, fit, draw modes and delete are theme buttons with
// aria-labels driving the map and Mapbox Draw APIs (the library's own buttons are hidden); errors are notices below
// the map; the geocoder is imported only with a Mapbox key. The basemap choice is local to the field because the app
// store has no `basemap` yet (D-45). MapLibre already makes flyTo/easeTo instant (duration 0, like jumpTo) under
// prefers-reduced-motion, which covers fit, zoom, location and geocoder moves (FR-094).
// Backoffice: maplibre-gl 6.14.0 instead of 1.15.3 (security: 1.15.3 has a critical XSS advisory fixed only in
// >= 6.4.1). The stored values do not change: Mapbox Draw still gives GeoJSON, serialized by utils/geometry as WKT,
// GeoJSON or [lng, lat] like Directus. v6 has no `accessToken`/`mapbox://` support (getMapboxTransformRequest) and
// uses `maplibregl-*` classes, so Mapbox Draw gets the usual MapLibre class patch below.
import type {
	Field,
	GeoJSONParser,
	GeoJSONSerializer,
	GeometryType,
	MultiGeometry,
	SimpleGeometry,
} from '@directus/types';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import StaticMode from '@mapbox/mapbox-gl-draw-static-mode';
import type { Feature, Geometry } from 'geojson';
import { debounce, isEqual, snakeCase } from 'lodash-es';
import * as maplibre from 'maplibre-gl';
import {
	AttributionControl,
	GeolocateControl,
	Map,
	type AnimationOptions,
	type CameraOptions,
	type LngLatBoundsLike,
	type LngLatLike,
	setWorkerUrl,
} from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { computed, inject, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../components/BoButton.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoNotice from '../../components/BoNotice.vue';
import BoProgressCircular from '../../components/BoProgressCircular.vue';
import BoSelect from '../../components/BoSelect.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { useThemeConfiguration } from '../../theme/use-theme-configuration.ts';
import { flatten, getBBox, getGeometryFormatForType, getParser, getSerializer } from '../../utils/geometry/index.ts';
import {
	getBasemapSources,
	getMapboxTransformRequest,
	getStyleFromBasemapSource,
} from '../../utils/geometry/basemap.ts';
import { getMapStyle } from './style.ts';

import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import 'maplibre-gl/dist/maplibre-gl.css';

// Backoffice: MapLibre 6 looks for its worker next to its own module, which bundling moves: use the emitted file.
setWorkerUrl(maplibreWorkerUrl);

// Backoffice: Mapbox Draw control classes for MapLibre (`maplibregl-ctrl*` instead of `mapboxgl-ctrl*`).
MapboxDraw.constants.classes.CONTROL_BASE = 'maplibregl-ctrl';
MapboxDraw.constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-';
MapboxDraw.constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group';

const activeLayers = [
	'directus-point',
	'directus-line',
	'directus-polygon-fill',
	'directus-polygon-stroke',
	'directus-polygon-midpoint',
	'directus-polygon-and-line-vertex',
].flatMap((name) => [name + '.hot', name + '.cold']);

const props = withDefaults(
	defineProps<{
		value: Record<string, unknown> | unknown[] | string | null;
		type: 'geometry' | 'json' | 'csv' | 'string' | 'text';
		fieldData?: Field | undefined;
		loading?: boolean;
		disabled?: boolean;
		nonEditable?: boolean;
		// Declared like Directus; drawing follows the subtype of the field type, not this option.
		geometryType?: GeometryType;
		defaultView?: Record<string, unknown>;
	}>(),
	{
		fieldData: undefined,
		loading: true,
		geometryType: undefined,
		defaultView: () => ({}),
	},
);

const emit = defineEmits<{
	(e: 'input', value: Record<string, unknown> | unknown[] | string | null): void;
}>();

const { t } = useI18n();
const a11y = inject(FORM_FIELD_A11Y, null);
const container: Ref<HTMLElement | null> = ref(null);
let map: Map;
const mapLoading = ref(true);
let currentGeometry: Geometry | null | undefined;

const geometryOptionsError = ref<string | null>();
const geometryParsingError = ref<string>();

const geometryType = props.fieldData?.type.split('.')[1] as GeometryType;
const geometryFormat = getGeometryFormatForType(props.type)!;

const settingsStore = useSettingsStore();
const mapboxKey = settingsStore.settings?.['mapbox_key'] as string | null | undefined;

const { darkMode } = useThemeConfiguration();
const basemaps = getBasemapSources();
const basemap = ref(basemaps[0]?.name);

const style = computed(() => {
	const source = basemaps.find((source) => source.name == basemap.value) ?? basemaps[0];
	if (!source) return;
	return getStyleFromBasemapSource(source);
});

let parse: GeoJSONParser;
let serialize: GeoJSONSerializer;

try {
	parse = getParser({ geometryFormat, geometryField: 'value' });
	serialize = getSerializer({ geometryFormat, geometryField: 'value' });
} catch (error: any) {
	geometryOptionsError.value = error.message;
}

const selection = ref<Feature[]>([]);
// Backoffice: the active Mapbox Draw mode, shown by aria-pressed on the draw buttons.
const drawMode = ref<string>('simple_select');

const location = ref<LngLatLike | null>();
const projection = ref<{ x: number; y: number } | null>();

function updateProjection() {
	projection.value = !location.value ? null : map.project(location.value as any);
}

watch(location, updateProjection);

const controls = {
	attribution: new AttributionControl(),
	draw: new MapboxDraw(getDrawOptions()),
	geolocate: new GeolocateControl({
		showUserLocation: false,
	}),
	geocoder: undefined as any,
};

// Backoffice: one button per draw mode the field allows (the controls of getDrawOptions).
const drawTypes = geometryType ? [geometryType.replace('Multi', '')] : ['LineString', 'Polygon', 'Point'];
const DRAW_ICONS: Record<string, string> = { Point: 'location_on', LineString: 'timeline', Polygon: 'pentagon' };

const tooltipVisible = ref(false);
const tooltipMessage = ref('');
const tooltipPosition = ref({ x: 0, y: 0 });

function hideTooltip() {
	tooltipVisible.value = false;
}

const updateTooltipDebounce = debounce((event: any) => {
	const feature = event.features?.[0];

	if (feature && feature.properties!.active === 'false') {
		tooltipMessage.value = t('interfaces.map.click_to_select', { geometry: feature.geometry.type });
		tooltipVisible.value = true;
		tooltipPosition.value = event.point;
	}
}, 200);

function updateTooltip(event: any) {
	tooltipVisible.value = false;
	updateTooltipDebounce({ point: event.point, features: event.features });
}

let unmounted = false;

onMounted(() => {
	const cleanup = setupMap();
	loadGeocoder();

	onUnmounted(() => {
		unmounted = true;
		cleanup();
	});
});

function setupMap(): () => void {
	map = new Map({
		container: container.value!,
		style: style.value!,
		dragRotate: false,
		logoPosition: 'bottom-left',
		attributionControl: false,
		...props.defaultView,
		...(mapboxKey ? { transformRequest: getMapboxTransformRequest(mapboxKey) } : {}),
	} as any);

	// Backoffice: the canvas (MapLibre's focusable element) is named by the field label (FR-094).
	const canvas = map.getCanvas();
	if (a11y?.value.labelId) canvas.setAttribute('aria-labelledby', a11y.value.labelId);
	canvas.addEventListener('keydown', handleKeyDown);

	controls.geolocate.on('geolocate', (event: any) => {
		const { longitude, latitude } = event.coords;
		location.value = [longitude, latitude];
	});

	watch(() => style.value, updateStyle);
	watch(darkMode, updateStyle);
	watch(() => props.disabled, updateDisabled, { immediate: true });
	watch(() => props.value, updateValue, { immediate: true });

	map.on('load', async () => {
		map.resize();
		mapLoading.value = false;
		// Mapbox Draw events are not in the MapLibre event map types
		map.on('draw.create' as any, handleDrawUpdate);
		map.on('draw.delete' as any, handleDrawUpdate);
		map.on('draw.update' as any, handleDrawUpdate);
		map.on('draw.modechange' as any, handleDrawModeChange);
		map.on('draw.selectionchange' as any, handleSelectionChange);
		map.on('move', updateProjection);

		for (const layer of activeLayers) {
			map.on('mousedown', layer, hideTooltip);
			map.on('mousemove', layer, updateTooltip);
			map.on('mouseleave', layer, updateTooltip);
		}
	});

	return () => {
		canvas.removeEventListener('keydown', handleKeyDown);
		map.remove();
	};
}

// Backoffice: the geocoder (and its CSS) is a separate chunk loaded only when settings have a Mapbox key (FR-081).
async function loadGeocoder() {
	if (!mapboxKey) return;

	const [{ default: MapboxGeocoder }] = await Promise.all([
		import('@mapbox/mapbox-gl-geocoder'),
		import('@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'),
	]);

	if (unmounted) return;

	controls.geocoder = new MapboxGeocoder({
		accessToken: mapboxKey,
		collapsed: true,
		flyTo: { speed: 1.4 },
		marker: false,
		mapboxgl: maplibre as any,
		placeholder: t('layouts.map.find_location'),
	});

	controls.geocoder.on('result', (event: any) => {
		location.value = event.result.center;
	});

	controls.geocoder.on('clear', () => {
		location.value = null;
	});

	// Backoffice: top-left, the end side holds the control buttons of the recipe.
	if (!props.disabled) map.addControl(controls.geocoder, 'top-left');
}

function setDrawMode(mode: string) {
	controls.draw.changeMode(mode);
	drawMode.value = mode;
}

function updateValue(value: any) {
	if (!value) {
		controls.draw.deleteAll();
		currentGeometry = null;

		if (geometryType) {
			const snaked = snakeCase(geometryType.replace('Multi', ''));
			const mode = `draw_${snaked}` as any;
			setDrawMode(mode);
		}
	} else {
		if (!isEqual(value, currentGeometry && serialize(currentGeometry as any))) {
			loadValueFromProps();
			setDrawMode('simple_select');
		}
	}

	if (props.disabled) {
		setDrawMode('static');
	}
}

function updateStyle() {
	refreshUI();
}

function updateDisabled() {
	refreshUI(true);
}

function refreshUI(updatedDisabled = false) {
	if (map.hasControl(controls.draw)) map.removeControl(controls.draw);
	if (style.value) map.setStyle(style.value, { diff: false });

	if (updatedDisabled) refreshDisabledState();

	controls.draw = new MapboxDraw(getDrawOptions());
	map.addControl(controls.draw, 'top-left');
	if (props.disabled) setDrawMode('static');
	loadValueFromProps();
}

function refreshDisabledState() {
	if (!props.disabled) {
		map.dragPan.enable();
		map.scrollZoom.enable();
		map.boxZoom.enable();
		map.keyboard.enable();
		map.doubleClickZoom.enable();
		map.touchZoomRotate.enable();

		if (controls.geocoder) map.addControl(controls.geocoder, 'top-left');
		map.addControl(controls.attribution, 'bottom-left');
		map.addControl(controls.geolocate, 'top-left');

		return;
	}

	if (!props.nonEditable) {
		map.dragPan.disable();
		map.scrollZoom.disable();
		map.boxZoom.disable();
		map.keyboard.disable();
		map.doubleClickZoom.disable();
		map.touchZoomRotate.disable();
	}

	if (controls.geocoder && map.hasControl(controls.geocoder)) map.removeControl(controls.geocoder);
	if (map.hasControl(controls.attribution)) map.removeControl(controls.attribution);
	if (map.hasControl(controls.geolocate)) map.removeControl(controls.geolocate);
}

function resetValue(hard: boolean) {
	geometryParsingError.value = undefined;
	if (hard) emit('input', null);
}

function zoomIn() {
	map.zoomIn();
}

function zoomOut() {
	map.zoomOut();
}

function geolocate() {
	controls.geolocate.trigger();
}

function fitDataBounds(options: CameraOptions & AnimationOptions = {}) {
	if (map && currentGeometry) {
		const bbox = getBBox(currentGeometry);

		map.fitBounds(bbox as LngLatBoundsLike, {
			padding: 80,
			maxZoom: 8,
			...options,
		});
	}
}

// Backoffice: no library buttons (`controls` stays empty): the template renders the draw and delete buttons for the
// modes Directus enables (one per subtype of the field type, or line, polygon and point).
function getDrawOptions(): any {
	return {
		styles: getMapStyle(darkMode.value),
		controls: {},
		userProperties: true,
		displayControlsDefault: false,
		modes: Object.assign(MapboxDraw.modes, {
			static: StaticMode,
		}),
	};
}

function isTypeCompatible(a?: GeometryType, b?: GeometryType): boolean {
	if (!a || !b) {
		return true;
	}

	if (a.startsWith('Multi')) {
		return a.replace('Multi', '') == b.replace('Multi', '');
	}

	return a == b;
}

function loadValueFromProps() {
	try {
		controls.draw.deleteAll();
		const initialValue = parse(props);

		if (!initialValue) {
			return;
		}

		if (!props.disabled && !isTypeCompatible(geometryType, initialValue!.type)) {
			geometryParsingError.value = t('interfaces.map.unexpected_geometry', {
				expected: geometryType,
				got: initialValue!.type,
			});
		}

		const flattened = flatten(initialValue);

		for (const geometry of flattened) {
			controls.draw.add(geometry);
		}

		currentGeometry = getCurrentGeometry();
		currentGeometry!.bbox = getBBox(currentGeometry!);

		if (geometryParsingError.value) {
			const bbox = getBBox(initialValue!) as LngLatBoundsLike;
			map.fitBounds(bbox, { padding: 0, maxZoom: 8, duration: 0 });
		} else {
			fitDataBounds({ duration: 0 });
		}
	} catch (error: any) {
		geometryParsingError.value = error.message ?? String(error);
	}
}

function getCurrentGeometry(): Geometry | null {
	const features = controls.draw.getAll().features as Feature[];
	const geometries = features.map((f) => f.geometry) as (SimpleGeometry | MultiGeometry)[];
	let result: Geometry;

	if (geometries.length === 0) {
		return null;
	} else if (!geometryType) {
		if (geometries.length > 1) {
			result = { type: 'GeometryCollection', geometries };
		} else {
			result = geometries[0] as Geometry;
		}
	} else if (geometryType.startsWith('Multi')) {
		const coordinates = geometries
			.filter(({ type }) => `Multi${type}` == geometryType)
			.map(({ coordinates }) => coordinates);

		result = { type: geometryType, coordinates } as Geometry;
	} else {
		result = geometries[geometries.length - 1] as Geometry;
	}

	return result;
}

function handleDrawModeChange(event: any) {
	drawMode.value = event.mode;

	if (!props.disabled && event.mode.startsWith('draw') && geometryType && !geometryType.startsWith('Multi')) {
		for (const feature of controls.draw.getAll().features.slice(0, -1)) {
			controls.draw.delete(feature.id as string);
		}
	}
}

// Backoffice: a draw button toggles its mode like the Mapbox Draw buttons (a button click fires draw.modechange).
function toggleDrawMode(type: string) {
	const mode = `draw_${snakeCase(type)}`;
	const next = drawMode.value === mode ? 'simple_select' : mode;
	controls.draw.changeMode(next);
	handleDrawModeChange({ mode: next });
}

function handleSelectionChange(event: any) {
	selection.value = event.features;
}

function handleDrawUpdate() {
	currentGeometry = getCurrentGeometry();

	if (!currentGeometry) {
		controls.draw.deleteAll();
		emit('input', null);
	} else {
		emit('input', serialize(currentGeometry as any));
	}
}

// Backoffice: Directus listens on window, so Backspace in another field deleted the selected shape; here only the
// focused map canvas reacts.
function handleKeyDown(event: KeyboardEvent) {
	if (['Backspace', 'Delete'].includes(event.key)) {
		trash();
	}
}

function trash() {
	controls.draw.trash();
}

// Map frame recipe: control buttons (Outline button colors) and the focus ring.
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const CONTROL = `flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-700 shadow-theme-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 ${FOCUS} dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-dark aria-pressed:bg-brand-50 aria-pressed:text-brand-600 dark:aria-pressed:bg-brand-500/15 dark:aria-pressed:text-brand-400`;
const CANVAS_FOCUS =
	'[&_.maplibregl-canvas:focus-visible]:outline-2 [&_.maplibregl-canvas:focus-visible]:-outline-offset-2 [&_.maplibregl-canvas:focus-visible]:outline-brand-500 dark:[&_.maplibregl-canvas:focus-visible]:outline-brand-400';
</script>

<template>
	<div class="interface-map">
		<div
			class="relative overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700"
			role="group"
			:aria-labelledby="a11y?.labelId"
			:aria-describedby="a11y?.describedBy"
			:aria-invalid="a11y?.invalid || undefined"
			:aria-busy="mapLoading"
			:data-disabled="disabled || undefined"
		>
			<div
				class="relative h-112.5 w-full"
				:class="{ 'opacity-25': mapLoading || geometryParsingError || geometryOptionsError }"
			>
				<!-- The library's own control groups (geolocate, draw) are hidden: the buttons below drive them. -->
				<div ref="container" data-map class="h-full w-full [&_.maplibregl-ctrl-group]:hidden" :class="CANVAS_FOCUS" />
			</div>
			<div
				v-if="location && projection"
				class="maplibregl-user-location-dot pointer-events-none absolute start-0 top-0"
				:style="`transform: translate(${projection.x}px, ${projection.y}px) translate(-50%, -50%)`"
			/>
			<div
				v-if="tooltipVisible"
				role="tooltip"
				class="pointer-events-none absolute start-0 top-0 rounded-lg bg-gray-900 px-3 py-2 text-theme-xs text-white shadow-theme-lg dark:bg-gray-800"
				:style="`transform: translate(${tooltipPosition.x}px, ${tooltipPosition.y}px) translate(-50%, -150%)`"
			>
				{{ tooltipMessage }}
			</div>
			<div v-if="!disabled || nonEditable" class="absolute end-3 top-3 flex flex-col gap-2">
				<button type="button" :class="CONTROL" :aria-label="t('map_zoom_in')" data-control="zoom-in" @click="zoomIn">
					<BoIcon name="add" size="sm" />
				</button>
				<button type="button" :class="CONTROL" :aria-label="t('map_zoom_out')" data-control="zoom-out" @click="zoomOut">
					<BoIcon name="remove" size="sm" />
				</button>
				<template v-if="!disabled">
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
						@click="fitDataBounds()"
					>
						<BoIcon name="fit_screen" size="sm" />
					</button>
					<button
						v-for="drawType in drawTypes"
						:key="drawType"
						type="button"
						:class="CONTROL"
						:aria-label="t(`geometry.${drawType}`)"
						:aria-pressed="drawMode === `draw_${snakeCase(drawType)}`"
						:data-control="`draw-${drawType}`"
						@click="toggleDrawMode(drawType)"
					>
						<BoIcon :name="DRAW_ICONS[drawType]!" size="sm" />
					</button>
					<button
						v-if="selection.length > 0"
						type="button"
						:class="CONTROL"
						:aria-label="t('delete_label')"
						data-control="trash"
						@click="trash"
					>
						<BoIcon name="delete" size="sm" />
					</button>
				</template>
			</div>
			<div
				v-if="!nonEditable"
				class="absolute bottom-8 end-3 w-48 rounded-lg bg-white dark:bg-gray-900 [&_label]:sr-only"
				data-basemap
			>
				<BoSelect
					v-model="basemap"
					:label="t('layouts.map.basemap')"
					:disabled="!!disabled"
					:items="basemaps.map((s) => ({ text: s.name, value: s.name }))"
				/>
			</div>
			<div
				v-if="mapLoading"
				class="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl text-brand-500 dark:text-brand-400"
			>
				<BoProgressCircular indeterminate :aria-label="t('loading')" />
			</div>
		</div>
		<BoNotice v-if="geometryOptionsError" type="danger" class="mt-3" data-error="options">
			<p class="font-medium text-gray-800 dark:text-white/90">{{ t('interfaces.map.invalid_options') }}</p>
			<p>{{ geometryOptionsError }}</p>
		</BoNotice>
		<BoNotice v-else-if="geometryParsingError" type="warning" class="mt-3" data-error="geometry">
			<p class="font-medium text-gray-800 dark:text-white/90">{{ t('layouts.map.invalid_geometry') }}</p>
			<p>{{ geometryParsingError }}</p>
			<div class="mt-3 flex gap-3">
				<BoButton variant="secondary" data-action="continue" @click="resetValue(false)">
					{{ t('continue_label') }}
				</BoButton>
				<BoButton variant="danger" data-action="reset" @click="resetValue(true)">{{ t('reset') }}</BoButton>
			</div>
		</BoNotice>
	</div>
</template>
