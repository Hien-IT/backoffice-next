// Directus has no test for the map interface: fixture, options (contracts/tests.md §5), value shapes per field type,
// errors, disabled states and controls, with maplibre-gl, Mapbox Draw and the geocoder replaced by fakes (T005: the
// real map runs in InterfaceMap.browser.test.ts when chromium has WebGL).
import type { FieldRaw } from '@directus/types';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useSettingsStore, type Settings } from '../../stores/settings.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import InterfaceMap from './InterfaceMap.vue';
import { getMapStyle } from './style.ts';

const lib = vi.hoisted(() => {
	const maps: any[] = [];
	const draws: any[] = [];
	const geocoders: any[] = [];
	const handler = () => ({ enable: vi.fn(), disable: vi.fn() });

	class FakeMap {
		handlers: Record<string, ((event: any) => void)[]> = {};
		controls = new Set<unknown>();
		canvas = document.createElement('canvas');
		dragPan = handler();
		scrollZoom = handler();
		boxZoom = handler();
		keyboard = handler();
		doubleClickZoom = handler();
		touchZoomRotate = handler();
		setStyle = vi.fn();
		fitBounds = vi.fn();
		resize = vi.fn();
		remove = vi.fn();
		zoomIn = vi.fn();
		zoomOut = vi.fn();
		project = vi.fn(() => ({ x: 10, y: 20 }));

		constructor(public options: any) {
			maps.push(this);
			options.container.appendChild(this.canvas);
		}

		getCanvas() {
			return this.canvas;
		}

		on(event: string, layerOrFn: any, fn?: any) {
			(this.handlers[event] ??= []).push(fn ?? layerOrFn);
		}

		fire(event: string, data: unknown = {}) {
			for (const fn of this.handlers[event] ?? []) fn(data);
		}

		addControl(control: unknown) {
			this.controls.add(control);
		}

		removeControl(control: unknown) {
			this.controls.delete(control);
		}

		hasControl(control: unknown) {
			return this.controls.has(control);
		}
	}

	class FakeControl {
		on = vi.fn();
	}

	class FakeGeolocate extends FakeControl {
		trigger = vi.fn();
	}

	class FakeDraw {
		static modes = { simple_select: {} };
		static constants = { classes: {} as Record<string, string> };
		features: any[] = [];
		mode = 'simple_select';
		count = 0;
		trash = vi.fn();

		constructor(public options: any) {
			draws.push(this);
		}

		add(geometry: unknown) {
			const id = `f${++this.count}`;
			// Mapbox Draw keeps its own copies
			this.features.push({ id, type: 'Feature', properties: {}, geometry: JSON.parse(JSON.stringify(geometry)) });
			return [id];
		}

		getAll() {
			return { type: 'FeatureCollection', features: JSON.parse(JSON.stringify(this.features)) };
		}

		deleteAll() {
			this.features = [];
		}

		delete(id: string) {
			this.features = this.features.filter((f) => f.id !== id);
		}

		changeMode(mode: string) {
			this.mode = mode;
		}
	}

	class FakeGeocoder {
		handlers: Record<string, (event: any) => void> = {};

		constructor(public options: any) {
			geocoders.push(this);
		}

		on(event: string, fn: (event: any) => void) {
			this.handlers[event] = fn;
		}
	}

	return { maps, draws, geocoders, FakeMap, FakeControl, FakeGeolocate, FakeDraw, FakeGeocoder };
});

vi.mock('maplibre-gl', () => ({
	Map: lib.FakeMap,
	AttributionControl: lib.FakeControl,
	GeolocateControl: lib.FakeGeolocate,
	setWorkerUrl: vi.fn(),
}));
vi.mock('@mapbox/mapbox-gl-draw', () => ({ default: lib.FakeDraw }));
vi.mock('@mapbox/mapbox-gl-geocoder', () => ({ default: lib.FakeGeocoder }));

const fields = fieldsOf('bo_std');
const item = itemOf('bo_std', 1);
let pinia: Pinia;

const map = () => lib.maps.at(-1)!;
const draw = () => lib.draws.at(-1)!;

function fieldProps(name: string, value: unknown = item[name]) {
	const field = fields.find((f) => f.field === name) as FieldRaw;
	return { ...(field.meta?.options ?? {}), value, type: field.type, fieldData: field };
}

async function mountMap(props: Record<string, unknown>, a11y?: { invalid: boolean }) {
	const wrapper = mount(InterfaceMap, {
		props: props as any,
		attachTo: document.body,
		global: {
			plugins: [i18n, pinia],
			provide: a11y
				? {
						[FORM_FIELD_A11Y as symbol]: computed(() => ({
							inputId: 'f-input',
							labelId: 'f-label',
							describedBy: a11y.invalid ? 'f-error' : undefined,
							invalid: a11y.invalid,
						})),
					}
				: {},
		},
	});

	await flushPromises();
	return wrapper;
}

const control = (wrapper: Awaited<ReturnType<typeof mountMap>>, name: string) =>
	wrapper.find(`[data-control="${name}"]`);

beforeEach(() => {
	lib.maps.length = 0;
	lib.draws.length = 0;
	lib.geocoders.length = 0;
	pinia = createPinia();
	setActivePinia(pinia);
});

afterEach(() => {
	document.body.innerHTML = '';
});

describe('map', () => {
	test('is registered with the Directus config and an async component', () => {
		expect(config).toMatchObject({ id: 'map', group: 'selection', icon: 'map', recommendedDisplays: [] });
		expect((config.component as { __asyncLoader?: unknown }).__asyncLoader).toBeTypeOf('function');
		// 016: the options component of Directus, async too (D-56 lifted).
		expect((config.options as unknown as { __asyncLoader?: unknown }).__asyncLoader).toBeTypeOf('function');
	});

	test.each([
		['map_json', { type: 'Point', coordinates: [105.85, 21.03] }],
		[
			'map_text',
			{
				type: 'Polygon',
				coordinates: [
					[
						[105, 21],
						[106, 21],
						[106, 22],
						[105, 21],
					],
				],
			},
		],
		['map_csv', { type: 'Point', coordinates: [105.85, 21.03] }],
		['map_point', { type: 'Point', coordinates: [105.85, 21.03] }],
		[
			'map_polygon',
			{
				type: 'Polygon',
				coordinates: [
					[
						[105, 21],
						[106, 21],
						[106, 22],
						[105, 21],
					],
				],
			},
		],
		[
			'map_geometry',
			{
				type: 'LineString',
				coordinates: [
					[105, 21],
					[106, 22],
				],
			},
		],
	])('%s shows the seeded value and emits nothing on mount', async (name, geometry) => {
		const wrapper = await mountMap(fieldProps(name));

		expect(
			draw()
				.getAll()
				.features.map((f: { geometry: unknown }) => f.geometry),
		).toEqual([geometry]);
		// fit to the data without animation
		expect(map().fitBounds).toHaveBeenLastCalledWith(expect.any(Array), { padding: 80, maxZoom: 8, duration: 0 });
		expect(wrapper.find('[data-error]').exists()).toBe(false);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('missing options: the MapLibre default view, any geometry type, OpenStreetMap', async () => {
		await mountMap({ value: null, type: 'json' });
		const options = map().options;

		expect(options).toMatchObject({ dragRotate: false, logoPosition: 'bottom-left', attributionControl: false });
		expect(options).not.toHaveProperty('center');
		expect(options).not.toHaveProperty('transformRequest');
		expect(options.style.sources).toHaveProperty('OpenStreetMap');
		expect(draw().mode).toBe('simple_select');
		expect(map().fitBounds).not.toHaveBeenCalled();
	});

	test('option:map.defaultView', async () => {
		await mountMap(fieldProps('map_polygon', null));

		expect(map().options).toMatchObject({ center: { lng: 105.85, lat: 21.03 }, zoom: 5, bearing: 0, pitch: 0 });
	});

	test('option:map.geometryType (the subtype of the field type limits drawing, as in Directus)', async () => {
		// json field with geometryType Point: Directus reads the type from the field only, so every mode is offered
		const json = await mountMap(fieldProps('map_json'));
		expect(json.findAll('[data-control^="draw-"]').map((b) => b.attributes('data-control'))).toEqual([
			'draw-LineString',
			'draw-Polygon',
			'draw-Point',
		]);

		const point = await mountMap(fieldProps('map_point'));
		expect(point.findAll('[data-control^="draw-"]').map((b) => b.attributes('data-control'))).toEqual(['draw-Point']);
	});

	test.each([
		['map_json', { type: 'Point', coordinates: [1, 2] }],
		['map_text', 'POINT (1 2)'],
		['map_csv', [1, 2]],
		['map_point', { type: 'Point', coordinates: [1, 2] }],
	])('%s emits the Directus shape after drawing', async (name, expected) => {
		const wrapper = await mountMap(fieldProps(name, null));
		map().fire('load');

		draw().add({ type: 'Point', coordinates: [1, 2] });
		map().fire('draw.create');

		expect(wrapper.emitted('input')!.at(-1)).toEqual([expected]);
	});

	test('a Multi* field merges the drawn shapes', async () => {
		const wrapper = await mountMap({ value: null, type: 'geometry', fieldData: { type: 'geometry.MultiPoint' } });
		map().fire('load');

		draw().add({ type: 'Point', coordinates: [1, 2] });
		draw().add({ type: 'Point', coordinates: [3, 4] });
		map().fire('draw.create');

		expect(wrapper.emitted('input')!.at(-1)).toEqual([
			{
				type: 'MultiPoint',
				coordinates: [
					[1, 2],
					[3, 4],
				],
			},
		]);
	});

	test('a field without subtype emits a GeometryCollection for several shapes', async () => {
		const wrapper = await mountMap({ value: null, type: 'json', fieldData: { type: 'json' } });
		map().fire('load');

		draw().add({ type: 'Point', coordinates: [1, 2] });
		draw().add({
			type: 'LineString',
			coordinates: [
				[0, 0],
				[1, 1],
			],
		});
		map().fire('draw.update');

		expect(wrapper.emitted('input')!.at(-1)![0]).toMatchObject({ type: 'GeometryCollection' });
	});

	test('a single type field keeps one shape when a new drawing starts', async () => {
		const wrapper = await mountMap(fieldProps('map_point'));
		map().fire('load');

		await control(wrapper, 'draw-Point').trigger('click');
		draw().add({ type: 'Point', coordinates: [1, 2] });
		map().fire('draw.modechange', { mode: 'draw_point' });
		map().fire('draw.create');

		expect(draw().getAll().features).toHaveLength(1);
		expect(wrapper.emitted('input')!.at(-1)).toEqual([{ type: 'Point', coordinates: [1, 2] }]);
	});

	test('deleting every shape emits null', async () => {
		const wrapper = await mountMap(fieldProps('map_point'));
		map().fire('load');

		draw().deleteAll();
		map().fire('draw.delete');

		expect(wrapper.emitted('input')!.at(-1)).toEqual([null]);
	});

	test('a null value starts the draw mode of the field subtype', async () => {
		const wrapper = await mountMap(fieldProps('map_point', null));

		expect(draw().mode).toBe('draw_point');
		expect(control(wrapper, 'draw-Point').attributes('aria-pressed')).toBe('true');
	});

	test('a draw button toggles its mode', async () => {
		const wrapper = await mountMap(fieldProps('map_json'));
		const polygon = control(wrapper, 'draw-Polygon');

		await polygon.trigger('click');
		expect(draw().mode).toBe('draw_polygon');
		expect(polygon.attributes('aria-pressed')).toBe('true');

		await polygon.trigger('click');
		expect(draw().mode).toBe('simple_select');
		expect(polygon.attributes('aria-pressed')).toBe('false');
	});

	test('a new value from outside replaces the shapes', async () => {
		const wrapper = await mountMap(fieldProps('map_json'));

		await wrapper.setProps({ value: { type: 'Point', coordinates: [5, 6] } });

		expect(
			draw()
				.getAll()
				.features.map((f: { geometry: unknown }) => f.geometry),
		).toEqual([{ type: 'Point', coordinates: [5, 6] }]);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('an incompatible geometry shows the error; continue keeps the value, reset emits null', async () => {
		const wrapper = await mountMap(
			fieldProps('map_point', {
				type: 'LineString',
				coordinates: [
					[0, 0],
					[1, 1],
				],
			}),
		);
		const notice = wrapper.find('[data-error="geometry"]');

		expect(notice.text()).toContain('Invalid geometry');
		expect(notice.text()).toContain('Expected Point, got LineString.');
		expect(map().fitBounds).toHaveBeenLastCalledWith([0, 0, 1, 1], { padding: 0, maxZoom: 8, duration: 0 });

		await wrapper.find('[data-action="continue"]').trigger('click');
		expect(wrapper.find('[data-error]').exists()).toBe(false);
		expect(wrapper.emitted('input')).toBeUndefined();

		await wrapper.setProps({
			value: {
				type: 'Polygon',
				coordinates: [
					[
						[0, 0],
						[1, 0],
						[1, 1],
						[0, 0],
					],
				],
			},
		});
		await wrapper.find('[data-action="reset"]').trigger('click');
		expect(wrapper.emitted('input')).toEqual([[null]]);
	});

	test('a json field accepts any geometry (fixture item 3: LineString with geometryType Point, as Directus)', async () => {
		const wrapper = await mountMap(fieldProps('map_json', itemOf('bo_std', 3)['map_json']));

		expect(wrapper.find('[data-error]').exists()).toBe(false);
		expect(draw().getAll().features).toHaveLength(1);
	});

	test('a WKT value that does not parse draws nothing, without error or emit', async () => {
		const wrapper = await mountMap(fieldProps('map_text', 'POINT (1'));

		// wellknown returns null: nothing to draw, no error, like Directus
		expect(draw().getAll().features).toHaveLength(0);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('a field type without geometry format shows the invalid options error', async () => {
		const wrapper = await mountMap({ value: null, type: 'integer' });

		expect(wrapper.find('[data-error="options"]').text()).toContain('Invalid options');
		expect(wrapper.find('[data-error="options"]').text()).toContain('Invalid format');
	});

	test('disabled: static mode, no controls, no interactions, basemap select disabled', async () => {
		const wrapper = await mountMap({ ...fieldProps('map_point'), disabled: true });

		expect(draw().mode).toBe('static');
		expect(wrapper.find('[data-control]').exists()).toBe(false);
		expect(map().dragPan.disable).toHaveBeenCalled();
		expect(map().keyboard.disable).toHaveBeenCalled();
		expect(wrapper.find('[data-basemap] button').attributes('disabled')).toBeDefined();
		expect(wrapper.find('[data-disabled]').exists()).toBe(true);
	});

	test('nonEditable: zoom only, map still pans, no basemap select', async () => {
		const wrapper = await mountMap({ ...fieldProps('map_point'), disabled: true, nonEditable: true });

		expect(wrapper.findAll('[data-control]').map((b) => b.attributes('data-control'))).toEqual(['zoom-in', 'zoom-out']);
		expect(map().dragPan.disable).not.toHaveBeenCalled();
		expect(wrapper.find('[data-basemap]').exists()).toBe(false);
	});

	test('enabling again restores interactions and controls', async () => {
		const wrapper = await mountMap({ ...fieldProps('map_point'), disabled: true });

		await wrapper.setProps({ disabled: false });

		expect(map().dragPan.enable).toHaveBeenCalled();
		expect(control(wrapper, 'fit').exists()).toBe(true);
		expect(draw().mode).toBe('simple_select');
	});

	test('controls: zoom, fit, location', async () => {
		const wrapper = await mountMap(fieldProps('map_json'));
		const geolocate = [...map().controls].find((c) => c instanceof lib.FakeGeolocate) as InstanceType<
			typeof lib.FakeGeolocate
		>;

		await control(wrapper, 'zoom-in').trigger('click');
		await control(wrapper, 'zoom-out').trigger('click');
		await control(wrapper, 'fit').trigger('click');
		await control(wrapper, 'geolocate').trigger('click');

		expect(map().zoomIn).toHaveBeenCalledOnce();
		expect(map().zoomOut).toHaveBeenCalledOnce();
		expect(map().fitBounds).toHaveBeenLastCalledWith([105.85, 21.03, 105.85, 21.03], { padding: 80, maxZoom: 8 });
		expect(geolocate.trigger).toHaveBeenCalledOnce();

		for (const button of wrapper.findAll('[data-control]')) {
			expect(button.element.tagName).toBe('BUTTON');
			expect(button.attributes('aria-label')).toBeTruthy();
		}

		// the located position shows as a dot
		const onGeolocate = geolocate.on.mock.calls.find(([event]) => event === 'geolocate')![1];
		onGeolocate({ coords: { longitude: 1, latitude: 2 } });
		await flushPromises();
		expect(wrapper.find('.maplibregl-user-location-dot').attributes('style')).toContain('translate(10px, 20px)');
	});

	test('delete: the button shows with a selection; Backspace on the map canvas deletes too', async () => {
		const wrapper = await mountMap(fieldProps('map_json'));
		map().fire('load');
		expect(control(wrapper, 'trash').exists()).toBe(false);

		map().fire('draw.selectionchange', { features: [{ id: 'f1' }] });
		await flushPromises();
		await control(wrapper, 'trash').trigger('click');
		expect(draw().trash).toHaveBeenCalledOnce();

		map().canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
		map().canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
		expect(draw().trash).toHaveBeenCalledTimes(2);

		// Backspace elsewhere on the page does not delete (Directus listened on window)
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
		expect(draw().trash).toHaveBeenCalledTimes(2);
	});

	test('loading: spinner and aria-busy until the map loads', async () => {
		const wrapper = await mountMap(fieldProps('map_json'));
		expect(wrapper.find('[role="progressbar"]').exists()).toBe(true);
		expect(wrapper.find('[role="group"]').attributes('aria-busy')).toBe('true');

		map().fire('load');
		await flushPromises();

		expect(map().resize).toHaveBeenCalled();
		expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
		expect(wrapper.find('[role="group"]').attributes('aria-busy')).toBe('false');
	});

	test('hovering an inactive shape shows the select tooltip', async () => {
		vi.useFakeTimers();
		const wrapper = await mountMap(fieldProps('map_json'));
		map().fire('load');

		map().fire('mousemove', {
			point: { x: 4, y: 5 },
			features: [{ properties: { active: 'false' }, geometry: { type: 'Point' } }],
		});
		vi.advanceTimersByTime(250);
		await flushPromises();
		expect(wrapper.find('[role="tooltip"]').text()).toBe('Click to select Point');

		map().fire('mousedown');
		await flushPromises();
		expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
		vi.useRealTimers();
	});

	test('basemaps from settings: choosing one sets its style', async () => {
		useSettingsStore(pinia).settings = {
			basemaps: [{ name: 'Custom', type: 'style', url: 'https://example.com/style.json' }],
		} as unknown as Settings;
		const wrapper = await mountMap(fieldProps('map_json'));

		expect(wrapper.find('[data-basemap]').text()).toContain('OpenStreetMap');
		(wrapper.findComponent({ name: 'BoSelect' }).vm as any).$emit('update:modelValue', 'Custom');
		await flushPromises();

		expect(map().setStyle).toHaveBeenLastCalledWith('https://example.com/style.json', { diff: false });
	});

	test('no Mapbox key: no geocoder and no access token', async () => {
		await mountMap(fieldProps('map_json'));

		expect(lib.geocoders).toHaveLength(0);
		expect(map().options).not.toHaveProperty('transformRequest');
	});

	test('a Mapbox key: Mapbox style first, key in the request transform, geocoder loaded and added', async () => {
		useSettingsStore(pinia).settings = { mapbox_key: 'pk.test' } as unknown as Settings;
		const wrapper = await mountMap(fieldProps('map_json'));
		await vi.dynamicImportSettled();

		expect(map().options.style).toMatch(/^mapbox:\/\//);
		// MapLibre 6 loads mapbox:// URLs through the transform with the key
		expect(map().options.transformRequest('mapbox://styles/a/b')).toEqual({
			url: 'https://api.mapbox.com/styles/v1/a/b?access_token=pk.test',
		});
		expect(lib.geocoders).toHaveLength(1);
		const geocoder = lib.geocoders[0];
		expect(geocoder.options).toMatchObject({ accessToken: 'pk.test', collapsed: true, marker: false });
		expect(geocoder.options.placeholder).toBe('Find location...');
		expect(map().hasControl(geocoder)).toBe(true);

		geocoder.handlers['result']({ result: { center: [1, 2] } });
		await flushPromises();
		expect(wrapper.find('.maplibregl-user-location-dot').exists()).toBe(true);

		geocoder.handlers['clear']();
		await flushPromises();
		expect(wrapper.find('.maplibregl-user-location-dot').exists()).toBe(false);
	});

	test('label linking through FORM_FIELD_A11Y', async () => {
		const wrapper = await mountMap(fieldProps('map_json'), { invalid: true });
		const group = wrapper.find('[role="group"]');

		expect(group.attributes('aria-labelledby')).toBe('f-label');
		expect(group.attributes('aria-describedby')).toBe('f-error');
		expect(group.attributes('aria-invalid')).toBe('true');
		expect(map().canvas.getAttribute('aria-labelledby')).toBe('f-label');
	});

	test('Mapbox Draw uses the MapLibre control classes', () => {
		expect(lib.FakeDraw.constants.classes).toEqual({
			CONTROL_BASE: 'maplibregl-ctrl',
			CONTROL_PREFIX: 'maplibregl-ctrl-',
			CONTROL_GROUP: 'maplibregl-ctrl-group',
		});
	});

	test('unmount removes the map', async () => {
		const wrapper = await mountMap(fieldProps('map_json'));
		const instance = map();

		wrapper.unmount();

		expect(instance.remove).toHaveBeenCalledOnce();
	});
});

describe('getMapStyle', () => {
	test('uses the theme tokens, 400 shades in dark', () => {
		document.body.style.setProperty('--color-brand-500', 'BRAND500');
		document.body.style.setProperty('--color-brand-400', 'BRAND400');

		const fill = (dark: boolean) => getMapStyle(dark)[0]!.paint!['fill-color'] as string[];

		expect(fill(false).at(-1)).toBe('BRAND500');
		expect(fill(true).at(-1)).toBe('BRAND400');
		expect(getMapStyle().map((layer) => layer.id)).toContain('directus-point');
	});
});
