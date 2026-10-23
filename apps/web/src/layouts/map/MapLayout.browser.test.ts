// The map layout with the real MapLibre 6.14.0 in chromium (T061). Needs WebGL: when `canvas.getContext('webgl')` is
// null (e.g. a CI runner without GPU emulation) the map suite is skipped and the logic is covered by index.test.ts and
// controls.test.ts. Tile and glyph requests are answered locally (no request leaves the test). The keyboard list of
// MapActions (D-69) needs no WebGL and always runs.
import { userEvent } from '@vitest/browser/context';
import { flushPromises, mount } from '@vue/test-utils';
import { Map as MapLibreMap } from 'maplibre-gl';
import { createPinia } from 'pinia';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import MapActions from './MapActions.vue';
import MapLayout from './MapLayout.vue';
import { getMapStyle } from './style.ts';
import '../../styles/index.css';

const webgl = document.createElement('canvas').getContext('webgl') !== null;

// 1x1 transparent PNG for every raster tile.
const PNG = Uint8Array.from(
	atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
	(c) => c.charCodeAt(0),
);

const originalFetch = window.fetch.bind(window);

beforeAll(() => {
	vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
		const url = input instanceof Request ? input.url : String(input);
		if (url.includes('tile.openstreetmap.org'))
			return Promise.resolve(new Response(PNG, { headers: { 'Content-Type': 'image/png' } }));
		if (url.includes('fonts.openmaptiles.org')) return Promise.resolve(new Response(new ArrayBuffer(0)));
		return originalFetch(input, init);
	});
});

afterAll(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	document.body.innerHTML = '';
});

const items = [
	{ id: 1, title: 'Hanoi', location: { type: 'Point', coordinates: [105.85, 21.03] } },
	{ id: 2, title: 'Haiphong', location: { type: 'Point', coordinates: [106.68, 20.86] } },
];

const geojson = {
	type: 'FeatureCollection',
	bbox: [105.85, 20.86, 106.68, 21.03],
	features: items.map(({ location, ...properties }) => ({ type: 'Feature', properties, geometry: location })),
};

function layoutProps(overrides: Record<string, unknown> = {}) {
	return {
		collection: 'bo_content',
		geojson,
		directusSource: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: false },
		directusLayers: getMapStyle(),
		featureId: 'id',
		handleClick: vi.fn(),
		handleSelect: vi.fn(),
		resetPresetAndRefresh: vi.fn(),
		fitDataBounds: vi.fn(),
		updateItemPopup: vi.fn(),
		geojsonLoading: false,
		loading: false,
		totalCount: 2,
		totalPages: 1,
		page: 1,
		toPage: vi.fn(),
		limit: 1000,
		geometryOptions: { geometryField: 'location', geometryFormat: 'native', geometryType: 'Point' },
		template: '{{ title }}',
		itemPopup: { item: null },
		...overrides,
	};
}

/** Mounts the layout and waits until the `__directus` layers are on the loaded map; returns the MapLibre map. */
async function mountLoaded(overrides: Record<string, unknown> = {}) {
	const addLayer = vi.spyOn(MapLibreMap.prototype, 'addLayer');
	const wrapper = mount(MapLayout, {
		props: layoutProps(overrides) as any,
		attachTo: document.body,
		global: { plugins: [i18n, createPinia()] },
	});

	await vi.waitFor(() => expect(addLayer.mock.calls.some(([layer]) => layer.id === '__directus_points')).toBe(true), {
		timeout: 15000,
	});

	const map = addLayer.mock.contexts[0] as MapLibreMap;
	await vi.waitFor(() => expect(map.loaded()).toBe(true), { timeout: 15000 });
	addLayer.mockRestore();
	return { wrapper, map };
}

/**
 * A click at a coordinate as the browser sends it (pointer, mouse and click events on the canvas). Synthetic events:
 * the vitest browser iframe is scaled, so a `userEvent.click` position lands off the projected point.
 */
function clickAt(map: MapLibreMap, lngLat: [number, number], init: MouseEventInit = {}) {
	const canvas = map.getCanvas();
	const rect = canvas.getBoundingClientRect();
	const { x, y } = map.project(lngLat);
	const event = { bubbles: true, cancelable: true, clientX: rect.left + x, clientY: rect.top + y, button: 0, ...init };
	canvas.dispatchEvent(new PointerEvent('pointerdown', event));
	canvas.dispatchEvent(new MouseEvent('mousedown', event));
	canvas.dispatchEvent(new PointerEvent('pointerup', event));
	canvas.dispatchEvent(new MouseEvent('mouseup', event));
	canvas.dispatchEvent(new MouseEvent('click', event));
}

const SUITE = webgl
	? 'map layout in chromium (WebGL)'
	: 'map layout in chromium: SKIPPED because canvas.getContext("webgl") is null (index.test.ts covers the logic)';

describe.skipIf(!webgl)(SUITE, () => {
	test('draws the items as points with the theme colors and OpenStreetMap tiles', async () => {
		const { wrapper, map } = await mountLoaded();

		const color = map.getPaintProperty('__directus_points', 'circle-color') as unknown[];
		expect(color.at(-1)).not.toBe('');
		expect(map.getSource('__directus')).toBeDefined();
		await vi.waitFor(() => expect(wrapper.text()).toContain('© OpenStreetMap contributors'));
		expect(wrapper.find('[data-control="zoom-in"]').exists()).toBe(true);
		expect(wrapper.find('[data-empty="geometry"]').exists()).toBe(false);
		wrapper.unmount();
	});

	test('a click on a point calls handleClick with its key; Shift + click selects it (adds)', async () => {
		const handleClick = vi.fn();
		const handleSelect = vi.fn();
		const { wrapper, map } = await mountLoaded({ handleClick, handleSelect });

		map.jumpTo({ center: [105.85, 21.03], zoom: 10 });
		// the point is drawn where it projects (after the resize observer and the next frame)
		await vi.waitFor(() =>
			expect(
				map.queryRenderedFeatures(map.project([105.85, 21.03]), { layers: ['__directus_points'] }).map((f) => f.id),
			).toEqual([1]),
		);

		clickAt(map, [105.85, 21.03]);
		await vi.waitFor(() => expect(handleClick).toHaveBeenCalledWith({ id: 1, replace: false }));

		await userEvent.keyboard('{Shift>}');
		expect(wrapper.get('[data-control="select"]').attributes('aria-pressed')).toBe('true');
		clickAt(map, [105.85, 21.03], { shiftKey: true });
		await userEvent.keyboard('{/Shift}');
		// the feature click in box select mode adds the item (the zero-size box before it selects nothing, as DR)
		await vi.waitFor(() => expect(handleSelect).toHaveBeenCalledWith({ ids: [1], replace: false }));
		expect(handleClick).toHaveBeenCalledTimes(1);
		// Outside a flex page (here, the test body) the map keeps the 20rem minimum of the layout box.
		expect(map.getContainer().getBoundingClientRect().height).toBeGreaterThanOrEqual(300);
		wrapper.unmount();
	});

	test('moveend writes cameraOptions (center, zoom, bbox); new bounds fit the data', async () => {
		const { wrapper, map } = await mountLoaded();
		const fitBounds = vi.spyOn(map, 'fitBounds');

		map.jumpTo({ center: [106, 21], zoom: 7 });
		await vi.waitFor(() => expect(wrapper.emitted('update:cameraOptions')).toBeDefined());
		const [camera] = wrapper.emitted('update:cameraOptions')!.at(-1) as [any];
		expect(camera.zoom).toBe(7);
		expect(camera.bbox).toHaveLength(4);

		await wrapper.setProps({ geojsonBounds: [...geojson.bbox] } as any);
		await flushPromises();
		expect(fitBounds).toHaveBeenCalledWith(geojson.bbox, { padding: 100, speed: 1.3, maxZoom: 14 });
		wrapper.unmount();
	});

	test('a container resize (MapLibre 6 ResizeObserver) does not write cameraOptions; the next move does', async () => {
		const { wrapper, map } = await mountLoaded();
		const before = wrapper.emitted('update:cameraOptions')?.length ?? 0;

		map.resize();
		await flushPromises();
		expect(wrapper.emitted('update:cameraOptions')?.length ?? 0).toBe(before);

		map.jumpTo({ center: [106, 21], zoom: 6 });
		await vi.waitFor(() => expect(wrapper.emitted('update:cameraOptions')?.length).toBe(before + 1));
		wrapper.unmount();
	});

	test('controls are keyboard buttons: zoom, fit data, box select toggle', async () => {
		const fitDataBounds = vi.fn();
		const { wrapper, map } = await mountLoaded({ fitDataBounds });
		const zoom = map.getZoom();

		(wrapper.get('[data-control="zoom-in"]').element as HTMLButtonElement).focus();
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(map.getZoom()).toBeGreaterThan(zoom));

		(wrapper.get('[data-control="fit"]').element as HTMLButtonElement).focus();
		await userEvent.keyboard(' ');
		expect(fitDataBounds).toHaveBeenCalled();

		const select = wrapper.get('[data-control="select"]');
		expect(select.attributes('aria-pressed')).toBe('false');
		(select.element as HTMLButtonElement).focus();
		await userEvent.keyboard('{Enter}');
		expect(select.attributes('aria-pressed')).toBe('true');
		wrapper.unmount();
	});

	test('the geometry error is an alert over the map; no geometry field shows no_compatible_fields', async () => {
		const { wrapper } = await mountLoaded({ geojsonError: 'Bad geometry' });
		expect(wrapper.get('[role="alert"]').text()).toContain('Invalid geometry');
		expect(wrapper.get('[role="alert"]').text()).toContain('Bad geometry');
		wrapper.unmount();

		const none = await mountLoaded({ geometryOptions: undefined });
		expect(none.wrapper.get('[data-empty="geometry"]').text()).toContain('No compatible fields');
		none.wrapper.unmount();
	});
});

describe('map actions: items in view (D-69)', () => {
	function mountActions(props: Record<string, unknown> = {}) {
		return mount(MapActions, {
			props: {
				showingCount: '2 Items',
				collection: 'bo_content',
				items,
				template: '{{ title }}',
				primaryKeyField: { field: 'id' },
				handleClick: vi.fn(),
				...props,
			} as any,
			attachTo: document.body,
			global: { plugins: [i18n, createPinia()] },
		});
	}

	test('the count is a status region; the list opens items with the keyboard', async () => {
		const handleClick = vi.fn();
		const wrapper = mountActions({ handleClick });

		expect(wrapper.get('[role="status"]').text()).toBe('2 Items');

		const trigger = wrapper.get('[data-action="items-in-view"]');
		expect(trigger.attributes('aria-label')).toBe('Items in view');
		(trigger.element as HTMLButtonElement).focus();
		await userEvent.keyboard('{Enter}');

		await vi.waitFor(() => expect(document.querySelectorAll('[data-item]')).toHaveLength(2));
		const second = document.querySelector('[data-item="2"]') as HTMLButtonElement;
		expect(second.textContent).toContain('Haiphong');
		expect(second.hasAttribute('aria-pressed')).toBe(false);
		second.focus();
		await userEvent.keyboard('{Enter}');
		expect(handleClick).toHaveBeenCalledWith({ id: 2, replace: false });
		wrapper.unmount();
	});

	test('select mode: buttons are toggles showing the selection; a single select replaces', async () => {
		const handleClick = vi.fn();
		const wrapper = mountActions({ handleClick, selectMode: true, showSelect: 'one', selection: [1] });

		await userEvent.click(wrapper.get('[data-action="items-in-view"]').element);
		await vi.waitFor(() => expect(document.querySelectorAll('[data-item]')).toHaveLength(2));
		expect(document.querySelector('[data-item="1"]')!.getAttribute('aria-pressed')).toBe('true');
		expect(document.querySelector('[data-item="2"]')!.getAttribute('aria-pressed')).toBe('false');

		(document.querySelector('[data-item="2"]') as HTMLButtonElement).focus();
		await userEvent.keyboard(' ');
		expect(handleClick).toHaveBeenCalledWith({ id: 2, replace: true });
		wrapper.unmount();
	});

	test('no list without items', () => {
		const wrapper = mountActions({ items: [] });
		expect(wrapper.find('[data-action="items-in-view"]').exists()).toBe(false);
		wrapper.unmount();
	});
});
