// DR has no test for layouts/tabular/index.ts: the layout state (T033) over the fixture API, collection
// bo_content (30 items, sort field `sort`, fields status, title, body, date_published, author, cover, tags, location).
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
import tabular from './index.ts';

vi.mock('../../utils/save-as-csv.ts', () => ({ saveAsCSV: vi.fn() }));

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

/** Mounts the tabular wrapper with v-models kept in refs, like the collection screen; returns them and the state. */
async function mountTabular(initial: { layoutQuery?: any; layoutOptions?: any; filterUser?: any } = {}) {
	const layoutQuery = ref(initial.layoutQuery ?? null);
	const layoutOptions = ref(initial.layoutOptions ?? null);
	const selection = ref<(string | number)[]>([]);
	let state: Record<string, any> = {};
	const Wrapper = createLayoutWrapper(tabular);

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

test('registers as Directus: id, name, icon, slots and no header shadow', () => {
	expect(tabular.id).toBe('tabular');
	expect(tabular.name).toBe('$t:layouts.tabular.tabular');
	expect(tabular.icon).toBe('table_rows');
	expect(tabular.headerShadow).toBe(false);
	expect(Object.keys(tabular.slots)).toEqual(['options', 'sidebar', 'actions']);
});

test('defaults: four first visible fields sorted by name, sort field, 25 items of page 1 (CHK034)', async () => {
	const { state } = await mountTabular();

	expect(state()['fields']).toEqual(['body', 'date_published', 'status', 'title']);
	expect(state()['tableSort']).toEqual({ by: 'sort', desc: false });
	expect(state()['limit']).toBe(25);
	expect(state()['page']).toBe(1);
	expect(state()['items']).toHaveLength(25);
	expect(state()['totalPages']).toBe(2);
	expect(state()['showingCount']).toBe(i18n.global.t('start_end_of_count_items', { start: 1, end: 25, count: 30 }));

	const list = calls(fetch).find((call) => call.startsWith('GET /items/bo_content?') && call.includes('limit='))!;
	expect(list).toContain('limit=25');
	expect(list).toContain('sort=sort');
	expect(list).toContain('page=1');
});

test('headers: default width 144, saved widths and alignment, nested description, fields gone from the collection dropped', async () => {
	const { state } = await mountTabular({
		layoutQuery: { fields: ['title', 'author.first_name', 'gone'] },
		layoutOptions: { widths: { title: 300 }, align: { title: 'right' } },
	});

	const headers = state()['tableHeaders'];
	expect(headers.map((header: any) => header.value)).toEqual(['title', 'author.first_name']);
	expect(headers[0]).toMatchObject({ text: 'Title', width: 300, align: 'right', sortable: true, description: null });
	expect(headers[0].field).toMatchObject({ display: 'formatted-value', type: 'string', collection: 'bo_content' });
	expect(headers[1]).toMatchObject({ width: 144, align: 'left', description: 'Author -> First Name' });
});

test('spacing gives the row heights 29, 43 and 58', async () => {
	const { state, layoutOptions } = await mountTabular();

	expect(state()['tableSpacing']).toBe('cozy');
	expect(state()['tableRowHeight']).toBe(43);

	state()['onUpdate:tableSpacing']('compact');
	expect(layoutOptions.value).toEqual({ spacing: 'compact' });
	await flushPromises();
	expect(state()['tableRowHeight']).toBe(29);

	state()['onUpdate:tableSpacing']('comfortable');
	await flushPromises();
	expect(state()['tableRowHeight']).toBe(58);
});

test('sort and align changes write the preset query and options', async () => {
	const { state, layoutQuery, layoutOptions } = await mountTabular();

	state()['onSortChange']({ by: 'title', desc: true });
	expect(layoutQuery.value.sort).toEqual(['-title']);
	state()['onSortChange'](null);
	expect(layoutQuery.value.sort).toEqual([]);

	state()['onAlignChange']('title', 'center');
	expect(layoutOptions.value).toEqual({ align: { title: 'center' } });
});

test('setting the headers writes the fields at once and the widths after 350 ms', async () => {
	const { state, layoutQuery, layoutOptions } = await mountTabular();
	const headers = state()['tableHeaders'];

	state()['onUpdate:tableHeaders']([{ ...headers[3], width: 200 }, headers[0]]);
	expect(layoutQuery.value.fields).toEqual(['title', 'body']);
	expect(layoutOptions.value).toBeNull();

	await new Promise((resolve) => setTimeout(resolve, 400));
	expect(layoutOptions.value).toEqual({ widths: { title: 200, body: 144 } });
});

test('selectAll, download, toPage and refresh', async () => {
	const { state, selection } = await mountTabular();

	state()['selectAll']();
	expect(selection.value).toEqual(state()['items'].map((item: any) => item.id));

	state()['download']();
	expect(saveAsCSV).toHaveBeenCalledWith('bo_content', state()['fields'], state()['items']);

	state()['toPage'](2);
	await vi.waitFor(() => expect(state()['items']).toHaveLength(5));
	expect(state()['showingCount']).toBe(i18n.global.t('start_end_of_count_items', { start: 26, end: 30, count: 30 }));

	const before = calls(fetch).length;
	state()['refresh']();
	await flushPromises();
	expect(
		calls(fetch)
			.slice(before)
			.some((call) => call.startsWith('GET /items/bo_content?')),
	).toBe(true);
});

test('a filter shows the filtered count line', async () => {
	const filter = { status: { _eq: 'published' } };
	const { state } = await mountTabular({ filterUser: filter });

	const count = state()['itemCount'];
	expect(count).toBeGreaterThan(0);
	expect(count).toBeLessThan(30);
	expect(state()['showingCount']).toBe(i18n.global.t('filtered_item_count', { count }, count));
});
