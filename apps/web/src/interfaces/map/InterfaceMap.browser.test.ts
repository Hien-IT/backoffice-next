// The map interface with the real MapLibre 1.15.3 and Mapbox Draw 1.5.1 in chromium (T005). Needs WebGL: when
// `canvas.getContext('webgl')` is null (e.g. a CI runner without GPU emulation) the suite is skipped and the logic is
// covered by InterfaceMap.test.ts with fakes. Tile requests are answered locally (no request leaves the test).
import type { FieldRaw } from '@directus/types';
import { userEvent } from '@vitest/browser/context';
import { mount } from '@vue/test-utils';
import { Map as MapLibreMap } from 'maplibre-gl';
import { createPinia } from 'pinia';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import InterfaceMap from './InterfaceMap.vue';
import '../../styles/index.css';

const webgl = document.createElement('canvas').getContext('webgl') !== null;

// 1x1 transparent PNG for every raster tile.
const PNG = Uint8Array.from(
	atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
	(c) => c.charCodeAt(0),
);

// MapLibre reads `(prefers-reduced-motion: reduce)` once and keeps the MediaQueryList: this one can be switched.
let reduceMotion = false;
const originalMatchMedia = window.matchMedia.bind(window);
const originalFetch = window.fetch.bind(window);

beforeAll(() => {
	window.matchMedia = (query: string) =>
		query.includes('prefers-reduced-motion')
			? ({
					media: query,
					get matches() {
						return reduceMotion;
					},
					addEventListener() {},
					removeEventListener() {},
					addListener() {},
					removeListener() {},
				} as unknown as MediaQueryList)
			: originalMatchMedia(query);

	vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
		const url = input instanceof Request ? input.url : String(input);
		if (url.includes('tile.openstreetmap.org'))
			return Promise.resolve(new Response(PNG, { headers: { 'Content-Type': 'image/png' } }));
		return originalFetch(input, init);
	});
});

afterAll(() => {
	window.matchMedia = originalMatchMedia;
	vi.restoreAllMocks();
});

afterEach(() => {
	document.body.innerHTML = '';
});

const fields = fieldsOf('bo_std');
const item = itemOf('bo_std', 1);

function fieldProps(name: string, value: unknown = item[name]) {
	const field = fields.find((f) => f.field === name) as FieldRaw;
	return { ...(field.meta?.options ?? {}), value, type: field.type, fieldData: field };
}

async function mountLoaded(props: Record<string, unknown>) {
	const wrapper = mount(InterfaceMap, {
		props: props as any,
		attachTo: document.body,
		global: { plugins: [i18n, createPinia()] },
	});

	await vi.waitFor(() => expect(wrapper.get('[role="group"]').attributes('aria-busy')).toBe('false'), {
		timeout: 15000,
	});

	return wrapper;
}

const SUITE = webgl
	? 'map in chromium (WebGL)'
	: 'map in chromium: SKIPPED because canvas.getContext("webgl") is null (InterfaceMap.test.ts covers the logic)';

describe.skipIf(!webgl)(SUITE, () => {
	test('loads the seeded value and draws a point with a click', async () => {
		const wrapper = await mountLoaded(fieldProps('map_point', null));
		const canvas = wrapper.get('canvas.maplibregl-canvas').element as HTMLCanvasElement;

		expect(canvas.getBoundingClientRect().height).toBeGreaterThan(0);
		// null value of a Point field: point mode is on
		expect(wrapper.get('[data-control="draw-Point"]').attributes('aria-pressed')).toBe('true');

		await userEvent.click(canvas);

		await vi.waitFor(() => expect(wrapper.emitted('input')).toBeDefined());
		const [value] = wrapper.emitted('input')!.at(-1) as [{ type: string; coordinates: number[] }];
		expect(value.type).toBe('Point');
		expect(value.coordinates.every((n) => typeof n === 'number')).toBe(true);
		wrapper.unmount();
	});

	test('OpenStreetMap tiles and attribution by default', async () => {
		const wrapper = await mountLoaded(fieldProps('map_json'));

		await vi.waitFor(() => expect(wrapper.text()).toContain('© OpenStreetMap contributors'));
		// the tiles were requested through fetch and answered locally
		const tileRequests = vi
			.mocked(window.fetch)
			.mock.calls.filter(([input]) =>
				(input instanceof Request ? input.url : String(input)).includes('tile.openstreetmap'),
			);
		expect(tileRequests.length).toBeGreaterThan(0);
		expect(wrapper.emitted('input')).toBeUndefined();
		wrapper.unmount();
	});

	test('keyboard: the controls are buttons reached by Tab and used with Enter and Space', async () => {
		const zoomIn = vi.spyOn(MapLibreMap.prototype, 'zoomIn');
		const wrapper = await mountLoaded(fieldProps('map_json'));
		const button = wrapper.get('[data-control="zoom-in"]').element as HTMLButtonElement;

		button.focus();
		await userEvent.keyboard('{Enter}');
		expect(zoomIn).toHaveBeenCalled();

		const polygon = wrapper.get('[data-control="draw-Polygon"]').element as HTMLButtonElement;
		polygon.focus();
		await userEvent.keyboard(' ');
		expect(polygon.getAttribute('aria-pressed')).toBe('true');

		// no focus trap: Tab leaves the map frame
		const frame = wrapper.get('[role="group"]').element;
		let left = false;

		for (let i = 0; i < 10 && !left; i++) {
			await userEvent.tab();
			left = !frame.contains(document.activeElement);
		}

		expect(left).toBe(true);
		wrapper.unmount();
	});

	test('reduced motion: camera moves are instant like jumpTo (FR-094)', async () => {
		const fitBounds = vi.spyOn(MapLibreMap.prototype, 'fitBounds');
		const wrapper = await mountLoaded(fieldProps('map_json'));
		const instance = fitBounds.mock.contexts[0] as MapLibreMap;
		const fit = wrapper.get('[data-control="fit"]').element as HTMLButtonElement;
		let ended = false;
		instance.on('moveend', () => (ended = true));

		// animated: the move is still running right after the click
		reduceMotion = false;
		fit.click();
		expect(ended).toBe(false);
		expect(instance.isMoving()).toBe(true);
		instance.stop();

		// reduced motion: the move ends inside the click
		ended = false;
		reduceMotion = true;
		fit.click();
		expect(ended).toBe(true);
		expect(instance.isMoving()).toBe(false);
		reduceMotion = false;
		wrapper.unmount();
	});
});
