// Feature 016 (T053, D-56 lifted): the options component of the map interface, as DR interfaces/map/options.vue:
// the geometry type (only without a native geometry type) and the default view taken from the map on `moveend`.
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { unref } from 'vue';
import BoSelect from '../../components/BoSelect.vue';
import { i18n } from '../../lang/index.ts';
import InterfaceMapOptions from './InterfaceMapOptions.vue';

const handlers: Record<string, () => void> = {};

vi.mock('maplibre-gl', () => ({
	setWorkerUrl: vi.fn(),
	Map: vi.fn(function () {
		return {
			on: (event: string, handler: () => void) => (handlers[event] = handler),
			getCenter: () => ({ lng: 105.85, lat: 21.03 }),
			getZoom: () => 6,
			getBearing: () => 0,
			getPitch: () => 0,
			remove: vi.fn(),
		};
	}),
}));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?url', () => ({ default: 'worker.js' }));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

beforeEach(() => setActivePinia(createPinia()));

const mountOptions = (props: Record<string, unknown>) =>
	mount(InterfaceMapOptions, { props: { collection: 'places', ...props }, global: { plugins: [i18n] } });

const last = (wrapper: ReturnType<typeof mountOptions>) => {
	const value = wrapper.emitted('input')!.at(-1)![0] as { defaultView: unknown; geometryType: string };
	return { geometryType: value.geometryType, defaultView: unref(value.defaultView) };
};

test('option:map.geometryType follows the native geometry type; csv fields are points', async () => {
	const wrapper = mountOptions({ field: { type: 'geometry.Polygon' } });
	expect(last(wrapper).geometryType).toBe('Polygon');
	expect(wrapper.findComponent(BoSelect).exists()).toBe(false);

	await wrapper.setProps({ field: { type: 'csv' } as never });
	await flushPromises();
	expect(last(wrapper).geometryType).toBe('Point');
});

test('option:map.defaultView is the map camera after a move', async () => {
	const wrapper = mountOptions({ field: { type: 'json' } });

	handlers['moveend']!();
	await flushPromises();

	expect(last(wrapper).defaultView).toEqual({ center: { lng: 105.85, lat: 21.03 }, zoom: 6, bearing: 0, pitch: 0 });
});
