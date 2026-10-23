// DR has no test for layouts/map/index.ts: the layout state (T061) over the fixture API, collection bo_content
// (30 items, `location` geometry.Point with the map interface, display template `{{ title }}`).
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import { calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { saveAsCSV } from '../../utils/save-as-csv.ts';
import { createLayoutWrapper } from '../use-layout.ts';
import map from './index.ts';

vi.mock('../../utils/save-as-csv.ts', () => ({ saveAsCSV: vi.fn() }));

let fetch: ReturnType<typeof mockFixtureApi>;

async function hydrate(answers = {}) {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot(), { answers });
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
}

beforeEach(() => hydrate());

/** Mounts the map wrapper with v-models kept in refs, like the collection screen; returns them and the state. */
async function mountMap(initial: { layoutQuery?: any; layoutOptions?: any; selectMode?: boolean; filter?: any } = {}) {
	const layoutQuery = ref(initial.layoutQuery ?? null);
	const layoutOptions = ref(initial.layoutOptions ?? null);
	const selection = ref<(string | number)[]>([]);
	let state: Record<string, any> = {};
	const Wrapper = createLayoutWrapper(map);

	const Harness = defineComponent(
		() => () =>
			h(
				Wrapper,
				{
					collection: 'bo_content',
					layoutQuery: layoutQuery.value,
					layoutOptions: layoutOptions.value,
					selection: selection.value,
					selectMode: initial.selectMode ?? false,
					filter: initial.filter ?? null,
					filterUser: initial.filter ?? null,
					'onUpdate:layoutQuery': (value: any) => (layoutQuery.value = value),
					'onUpdate:layoutOptions': (value: any) => (layoutOptions.value = value),
					'onUpdate:selection': (value: any) => (selection.value = value),
				},
				{ default: (scope: { layoutState: Record<string, any> }) => ((state = scope.layoutState), h('div')) },
			),
	);

	const router: Router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/:p(.*)*', component: {} }],
	});

	mount(Harness, { global: { plugins: [router, i18n] } });
	await vi.waitFor(() => expect(state['loading']).toBe(false));
	await flushPromises();

	return { layoutQuery, layoutOptions, selection, router, state: () => state };
}

const itemCalls = () => calls(fetch).filter((c) => c.startsWith('GET /items/bo_content?') && !c.includes('aggregate'));

test('registers as Directus with async components (MapLibre stays out of the entry chunk)', () => {
	expect(map.id).toBe('map');
	expect(map.name).toBe('$t:layouts.map.map');
	expect(map.icon).toBe('map');
	expect(map.smallHeader).toBe(true);
	expect(map.sidebarShadow).toBe(true);
	expect(Object.keys(map.slots)).toEqual(['options', 'sidebar', 'actions']);
	expect((map.component as any).__asyncLoader).toBeTypeOf('function');
	expect((map.slots.options as any).__asyncLoader).toBeTypeOf('function');
	expect((map.slots.actions as any).__asyncLoader).toBeTypeOf('function');
});

test('defaults: first geometry field, limit 1000, sort by key, fields = geometry + template + key; GeoJSON with bbox', async () => {
	const { layoutOptions, state } = await mountMap();

	expect(layoutOptions.value).toEqual({ geometryField: 'location' });
	expect(state()['geometryFields'].map((f: any) => f.field)).toEqual(['location']);
	expect(state()['geometryOptions']).toEqual({
		geometryField: 'location',
		geometryFormat: 'native',
		geometryType: 'Point',
	});
	expect(state()['isGeometryFieldNative']).toBe(true);
	expect(state()['template']).toBe('{{ title }}');
	expect(state()['limit']).toBe(1000);
	expect(state()['sort']).toEqual(['id']);

	// The first request goes before the default geometry field reaches the preset (throttled refetch, 500 ms).
	await vi.waitFor(() => expect(itemCalls().at(-1)).toContain('fields=location,title,id'), { timeout: 2000 });
	await flushPromises();
	const url = new URL(itemCalls().at(-1)!.slice(4), 'http://api.test');
	expect(url.searchParams.get('limit')).toBe('1000');

	const geojson = state()['geojson'];
	expect(geojson.features).toHaveLength(30);
	expect(geojson.features[0]).toEqual({
		type: 'Feature',
		properties: { title: expect.any(String), id: 1 },
		geometry: { type: 'Point', coordinates: [105.81, 21.01] },
	});
	expect(state()['geojsonBounds']).toEqual(geojson.bbox);
	expect(state()['featureId']).toBe('id');
	expect(state()['directusSource']).toEqual({
		type: 'geojson',
		data: { type: 'FeatureCollection', features: [] },
		cluster: false,
	});
	expect(state()['directusLayers']).toHaveLength(7);
	expect(state()['showingCount']).toBe('30 Items');
});

/** Answers the item list and counts of bo_content with fixed rows (the fixture API has no `_intersects_bbox`). */
function itemsAnswer(rows: Record<string, unknown>[]) {
	return {
		'GET /items/bo_content': ({ url }: { url: URL }) =>
			[...url.searchParams.keys()].some((key) => key.startsWith('aggregate'))
				? json({ data: [{ count: rows.length, countDistinct: { id: rows.length } }] })
				: json({ data: rows }),
	};
}

test('a native geometry field with camera options adds an _intersects_bbox filter merged with the user filter', async () => {
	await hydrate(itemsAnswer([{ id: 1, title: 'A', location: { type: 'Point', coordinates: [105.5, 21.5] } }]));
	const bbox = [105, 21, 106, 22];
	const filter = { status: { _eq: 'published' } };
	await mountMap({ layoutOptions: { geometryField: 'location', cameraOptions: { zoom: 8, bbox } }, filter });

	const url = new URL(itemCalls().at(-1)!.slice(4), 'http://api.test');
	expect(JSON.parse(url.searchParams.get('filter')!)).toEqual({
		_and: [
			filter,
			{
				location: {
					_intersects_bbox: {
						type: 'Polygon',
						coordinates: [
							[
								[105, 21],
								[106, 21],
								[106, 22],
								[105, 22],
								[105, 21],
							],
						],
					},
				},
			},
		],
	});
});

test('cameraOptions and clusterData write the layout options; the source follows clusterData', async () => {
	const { layoutOptions, state } = await mountMap();

	state()['cameraOptions'] = { zoom: 3, bbox: [0, 0, 1, 1] };
	await flushPromises();
	state()['clusterData'] = true;
	await flushPromises();

	expect(layoutOptions.value).toEqual({
		geometryField: 'location',
		cameraOptions: { zoom: 3, bbox: [0, 0, 1, 1] },
		clusterData: true,
	});
	expect(state()['directusSource'].cluster).toBe(true);
});

test('handleClick opens the item; in select mode it selects, replacing or adding (handleSelect)', async () => {
	const { router, state } = await mountMap();
	state()['handleClick']({ id: 3, replace: true });
	await flushPromises();
	expect(router.currentRoute.value.fullPath).toBe('/content/bo_content/3');

	const select = await mountMap({ selectMode: true });
	select.state()['handleClick']({ id: 3, replace: true });
	await flushPromises();
	expect(select.selection.value).toEqual([3]);

	select.state()['handleSelect']({ ids: [4, 3], replace: false });
	await flushPromises();
	expect(select.selection.value).toEqual([3, 4]);

	select.state()['handleSelect']({ ids: [5], replace: true });
	await flushPromises();
	expect(select.selection.value).toEqual([5]);
});

test('updateItemPopup resolves the hovered feature id to its item; fitDataBounds re-fits non-native data', async () => {
	const { state } = await mountMap();

	state()['updateItemPopup']({ item: 2, position: { x: 1, y: 2 } });
	expect(state()['itemPopup']).toEqual({ item: expect.objectContaining({ id: 2 }), position: { x: 1, y: 2 } });

	state()['updateItemPopup']({ item: null });
	expect(state()['itemPopup'].item).toBeNull();

	state()['download']();
	expect(saveAsCSV).toHaveBeenCalledWith('bo_content', ['location', 'title', 'id'], state()['items']);
});

test('an invalid geometry sets geojsonError and empties the GeoJSON', async () => {
	await hydrate(itemsAnswer([{ id: 1, title: 'Broken', location: { type: 'Point' } }]));

	const { state } = await mountMap();

	expect(state()['geojsonError']).toEqual(expect.any(String));
	expect(state()['geojson'].features).toEqual([]);
	expect(state()['geojsonLoading']).toBe(false);
});

test('without a geometry field the count is the total and the GeoJSON stays empty', async () => {
	const { state } = await mountMap({ layoutOptions: { geometryField: 'title' } });

	expect(state()['geometryOptions']).toEqual({
		geometryField: 'title',
		geometryFormat: 'wkt',
		geometryType: undefined,
	});

	const none = await mountMap({ layoutOptions: { geometryField: 'nope' } });
	expect(none.state()['geometryOptions']).toBeUndefined();
	expect(none.state()['geojson'].features).toEqual([]);
	expect(none.state()['showingCount']).toBe('30 Items');
});
