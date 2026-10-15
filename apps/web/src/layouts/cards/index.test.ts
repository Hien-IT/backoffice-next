// Directus has no test for layouts/cards/index.ts: the layout state (T057) over the fixture API, collection bo_content
// (30 items, file field `cover` related to directus_files, title, status).
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import { calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { saveAsCSV } from '../../utils/save-as-csv.ts';
import { createLayoutWrapper } from '../use-layout.ts';
import cards from './index.ts';

vi.mock('../../utils/save-as-csv.ts', () => ({ saveAsCSV: vi.fn() }));
// The registry imports every layout eagerly; this test needs only the cards wrapper.
vi.mock('../index.ts', () => ({ getLayouts: () => [] }));

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot());
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
});

async function mountCards(initial: { layoutQuery?: any; layoutOptions?: any; filterUser?: any } = {}) {
	const layoutQuery = ref(initial.layoutQuery ?? null);
	const layoutOptions = ref(initial.layoutOptions ?? null);
	const selection = ref<(string | number)[]>([]);
	let state: Record<string, any> = {};
	const Wrapper = createLayoutWrapper(cards);

	const Harness = defineComponent(
		() => () =>
			h(
				Wrapper,
				{
					collection: 'bo_content',
					layoutQuery: layoutQuery.value,
					layoutOptions: layoutOptions.value,
					selection: selection.value,
					filterUser: initial.filterUser ?? null,
					filter: initial.filterUser ?? null,
					'onUpdate:layoutQuery': (value: any) => (layoutQuery.value = value),
					'onUpdate:layoutOptions': (value: any) => (layoutOptions.value = value),
					'onUpdate:selection': (value: any) => (selection.value = value),
				},
				{ default: (scope: { layoutState: Record<string, any> }) => ((state = scope.layoutState), h('div')) },
			),
	);

	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
	mount(Harness, { global: { plugins: [router, i18n] } });
	await vi.waitFor(() => expect(state['loading']).toBe(false));
	await flushPromises();

	return { layoutQuery, layoutOptions, selection, state: () => state };
}

/** The query of the last list request (`GET /items/bo_content` with a limit). */
function listQuery() {
	const call = calls(fetch)
		.filter((call) => call.startsWith('GET /items/bo_content?') && call.includes('limit='))
		.at(-1)!;
	return new URLSearchParams(call.slice(call.indexOf('?') + 1));
}

test('registers as Directus: id, name, icon, slots (async chunks) and no header shadow', () => {
	expect(cards.id).toBe('cards');
	expect(cards.name).toBe('$t:layouts.cards.cards');
	expect(cards.icon).toBe('grid_view');
	expect(cards.headerShadow).toBe(false);
	expect(Object.keys(cards.slots)).toEqual(['options', 'sidebar', 'actions']);
	expect((cards.component as { __asyncLoader?: unknown }).__asyncLoader).toBeTypeOf('function');
});

test('defaults: size 4, icon box, first file field as image source, crop, sort by primary key, 25 items', async () => {
	const { state } = await mountCards();

	expect(state()['size']).toBe(4);
	expect(state()['icon']).toBe('box');
	expect(state()['fileFields'].map((field: any) => field.field)).toEqual(['cover']);
	expect(state()['imageSource']).toBe('cover');
	expect(state()['imageFit']).toBe('crop');
	expect(state()['title']).toBeNull();
	expect(state()['sort']).toEqual(['id']);
	expect(state()['items']).toHaveLength(25);
	expect(state()['totalPages']).toBe(2);
	expect(state()['showingCount']).toBe(i18n.global.t('start_end_of_count_items', { start: 1, end: 25, count: 30 }));
	expect(state()['getLinkForItem']({ id: 7 })).toBe('/content/bo_content/7');

	// Same fields and query as Directus cards/index.ts: pk + image source file fields, sort pk, page 1, limit 25.
	const query = listQuery();
	expect(query.get('fields')).toBe('id,cover.modified_on,cover.type,cover.filename_disk,cover.storage,cover.id');
	expect(query.get('limit')).toBe('25');
	expect(query.get('sort')).toBe('id');
	expect(query.get('page')).toBe('1');
	expect(state()['items'][0].cover).toMatchObject({ id: 'bo-4', type: 'image/png' });
});

test('title and subtitle templates add their fields to the request', async () => {
	const { state } = await mountCards({
		layoutOptions: { title: '{{ title }}', subtitle: '{{ status }} · {{ author.first_name }}', imageSource: null },
	});

	expect(state()['imageSource']).toBeNull();
	expect(listQuery().get('fields')).toBe('id,title,status,author.first_name');
	expect(state()['items'][0]).toMatchObject({ id: 1, title: 'Content 01 (edited)', status: 'draft' });
});

test('option and query writes go to layout_options and layout_query', async () => {
	const { state, layoutOptions, layoutQuery } = await mountCards();

	state()['onUpdate:size'](5);
	expect(layoutOptions.value).toEqual({ size: 5 });
	// One write per render, as the screen does (each write spreads the current options).
	for (const [key, value] of [
		['icon', 'image'],
		['imageFit', 'contain'],
		['title', '{{ title }}'],
		['subtitle', null],
		['imageSource', null],
	]) {
		await flushPromises();
		state()[`onUpdate:${key}`](value);
	}
	await flushPromises();
	expect(layoutOptions.value).toEqual({
		size: 5,
		icon: 'image',
		imageFit: 'contain',
		title: '{{ title }}',
		subtitle: null,
		imageSource: null,
	});

	state()['onUpdate:sort'](['-title']);
	await flushPromises();
	state()['onUpdate:limit'](50);
	// useItems goes back to page 1 on a sort change (Directus use-items).
	expect(layoutQuery.value).toEqual({ sort: ['-title'], page: 1, limit: 50 });
	await vi.waitFor(() => expect(state()['items']).toHaveLength(30));
	expect(listQuery().get('sort')).toBe('-title');
	expect(listQuery().get('fields')).toBe('id,title');
});

test('isSingleRow follows the width: n × size × 40 + (n − 1) × 24', async () => {
	const { state } = await mountCards({ layoutQuery: { limit: 2 } });

	expect(state()['items']).toHaveLength(2);
	state()['onUpdate:width'](2 * 160 + 24 - 1);
	await flushPromises();
	expect(state()['isSingleRow']).toBe(false);
	state()['onUpdate:width'](2 * 160 + 24);
	await flushPromises();
	expect(state()['isSingleRow']).toBe(true);
});

test('selectAll, download, toPage and a filtered count line', async () => {
	const { state, selection, layoutQuery } = await mountCards();

	state()['selectAll']();
	expect(selection.value).toEqual(state()['items'].map((item: any) => item.id));

	state()['download']();
	expect(saveAsCSV).toHaveBeenCalledWith(
		'bo_content',
		['id', 'cover.modified_on', 'cover.type', 'cover.filename_disk', 'cover.storage', 'cover.id'],
		state()['items'],
	);

	state()['toPage'](2);
	expect(layoutQuery.value).toEqual({ page: 2 });
	await vi.waitFor(() => expect(state()['items']).toHaveLength(5));

	const filter = { status: { _eq: 'published' } };
	const filtered = await mountCards({ filterUser: filter });
	const count = filtered.state()['itemCount'];
	expect(count).toBeGreaterThan(0);
	expect(filtered.state()['showingCount']).toBe(i18n.global.t('filtered_item_count', { count }, count));
});
