// Directus has no test for layouts/kanban/index.ts: the layout state (T059) over the fixture API, collections bo_content
// (status choices draft/published/archived, not nullable; author m2o directus_users; tags csv; sort field `sort`) and
// bo_groups (`target` m2o to bo_rel_target, sort field `sort`, title `name`).
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h, isVNode, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import { calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { type FixtureUser, loadSnapshot } from '../../test-utils/fixtures.ts';
import { createLayoutWrapper } from '../use-layout.ts';
import kanban from './index.ts';

let fetch: ReturnType<typeof mockFixtureApi>;

async function setup(user: FixtureUser = 'admin') {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot(), { user });
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
}

beforeEach(() => setup());

async function mountKanban(
	collection = 'bo_content',
	initial: { layoutQuery?: any; layoutOptions?: any; filterUser?: any } = {},
) {
	const layoutQuery = ref(initial.layoutQuery ?? null);
	const layoutOptions = ref(initial.layoutOptions ?? null);
	const selection = ref<(string | number)[]>([]);
	let state: Record<string, any> = {};
	const Wrapper = createLayoutWrapper(kanban);

	const Harness = defineComponent(
		() => () =>
			h(
				Wrapper,
				{
					collection,
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
	await vi.waitFor(() => expect(state['items'].length).toBeGreaterThan(0));
	await flushPromises();

	return { layoutQuery, layoutOptions, selection, state: () => state };
}

const ids = (group: { items: { id: unknown }[] }) => group.items.map((item) => item.id);

test('registers as Directus: id, name, icon, slots, no shadows; components load async (bundle)', () => {
	expect(kanban.id).toBe('kanban');
	expect(kanban.name).toBe('$t:layouts.kanban.name');
	expect(kanban.icon).toBe('view_week');
	expect(kanban.headerShadow).toBe(false);
	expect(kanban.sidebarShadow).toBe(false);
	expect(Object.keys(kanban.slots)).toEqual(['options', 'sidebar', 'actions']);
	expect((kanban.component as any).__asyncLoader).toBeTypeOf('function');
	expect((kanban.slots.options as any).__asyncLoader).toBeTypeOf('function');
	expect((kanban.slots.actions as any).__asyncLoader).toBeTypeOf('function');
	expect(isVNode((kanban.slots.sidebar as () => unknown)())).toBe(false);
});

test('defaults: first field of each group, choices columns in order, items by sort field with limit 1000', async () => {
	const { state } = await mountKanban();

	expect(state()['groupField']).toBe('status');
	expect(state()['isRelational']).toBe(false);
	expect(state()['titleField']).toBe('status');
	expect(state()['dateField']).toBe('date_published');
	expect(state()['tagsField']).toBe('tags');
	expect(state()['userField']).toBe('author');
	expect(state()['imageSource']).toBe('cover');
	expect(state()['crop']).toBe(true);
	expect(state()['showUngrouped']).toBe(false);
	expect(state()['ungroupedDisabled']).toBe(true);
	expect(state()['userFieldType']).toBe('m2o');
	expect(state()['limit']).toBe(1000);
	expect(state()['fieldGroups'].group.map((field: any) => field.field)).toEqual(['status', 'author', 'cover']);
	expect(state()['fieldGroups'].file.map((field: any) => field.field)).toEqual(['cover']);

	const groups = state()['groupedItems'];
	expect(groups.map((group: any) => [group.id, group.title])).toEqual([
		['draft', 'Draft'],
		['published', 'Published'],
		['archived', 'Archived'],
	]);
	expect(ids(groups[0]).slice(0, 3)).toEqual([1, 4, 7]);
	expect(groups.reduce((sum: number, group: any) => sum + group.items.length, 0)).toBe(30);

	const card = groups[1].items[0];
	expect(card).toMatchObject({ id: 2, title: 'published', tags: ['news'], dateType: 'dateTime', sort: 1 });
	expect(card.users[0]).toMatchObject({ id: 'bo-1' });

	const list = calls(fetch).find((call) => call.startsWith('GET /items/bo_content?') && call.includes('limit='))!;
	expect(list).toContain('limit=1000');
	expect(list).toContain('sort=sort');
	expect(list).toContain('author.avatar.modified_on');
	expect(list).toContain('cover.modified_on');
	expect(state()['showingCount']).toBe(i18n.global.t('item_count', { count: '30' }, 30));
});

test('image URL: crop asks 250x150, no crop the system-medium-contain key, on the API URL', async () => {
	const { state } = await mountKanban('bo_content', { layoutOptions: { titleField: 'title' } });
	const withImage = state()
		['groupedItems'].flatMap((group: any) => group.items)
		.find((item: any) => item.image);
	expect(withImage.image).toMatch(/^http:\/\/api\.test\/assets\/[^?]+\?modified=.+&width=250&height=150$/);

	state()['onUpdate:crop'](false);
	await flushPromises();
	const again = state()
		['groupedItems'].flatMap((group: any) => group.items)
		.find((item: any) => item.image);
	expect(again.image).toMatch(/&key=system-medium-contain$/);
});

test('change(): a card dropped before a lower sort POSTs /utils/sort then PATCHes the group field', async () => {
	const { state } = await mountKanban();
	const [draft, published] = state()['groupedItems'];
	const element = published.items.find((item: any) => item.id === 8);
	const before = calls(fetch).length;

	await state()['change'](draft, { added: { element, newIndex: 1 } });

	const writes = calls(fetch)
		.slice(before)
		.filter((call) => !call.startsWith('GET'));
	expect(writes).toEqual(['POST /utils/sort/bo_content', 'PATCH /items/bo_content/8']);
	expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST').at(-1)![1]!.body).toBe(
		JSON.stringify({ item: 8, to: 4 }),
	);
	expect(fetch.mock.calls.at(-1)![1]!.body).toBe(JSON.stringify({ status: 'draft' }));

	const after = state()['groupedItems'];
	expect(ids(after[0])).toContain(8);
	expect(ids(after[1])).not.toContain(8);
});

test('change(): a move inside a column sorts, a removal does nothing', async () => {
	const { state } = await mountKanban();
	const draft = state()['groupedItems'][0];
	const before = calls(fetch).length;

	await state()['change'](draft, { removed: { element: draft.items[0], oldIndex: 0 } });
	await state()['change'](draft, { moved: { element: draft.items[0], oldIndex: 0, newIndex: 1 } });

	expect(calls(fetch).slice(before)).toEqual(['POST /utils/sort/bo_content']);
	expect(ids(state()['groupedItems'][0]).slice(0, 2)).toEqual([4, 1]);
});

test('changeGroupSort() of choices writes groupOrder.sortMap in the layout options', async () => {
	const { state, layoutOptions } = await mountKanban();

	expect(layoutOptions.value.groupOrder).toEqual({
		groupField: 'status',
		sortMap: { draft: 0, published: 1, archived: 2 },
	});

	await state()['changeGroupSort']({ moved: { element: null, oldIndex: 0, newIndex: 2 } });
	expect(layoutOptions.value.groupOrder.sortMap).toEqual({ published: 0, archived: 1, draft: 2 });
	await flushPromises();
	expect(state()['groupedItems'].map((group: any) => group.id)).toEqual(['published', 'archived', 'draft']);
});

test('relational groups: loaded from the related collection, add / edit / delete / reorder write it', async () => {
	const { state } = await mountKanban('bo_groups', { layoutOptions: { groupField: 'target', groupTitle: 'name' } });

	expect(state()['isRelational']).toBe(true);
	expect(state()['groupsCollection']).toBe('bo_rel_target');
	expect(state()['ungroupedDisabled']).toBe(false);
	await vi.waitFor(() => expect(state()['groupedItems']).toHaveLength(5));
	expect(state()['groupedItems'].map((group: any) => group.title)).toEqual([
		'Target one',
		'Target two',
		'Target three',
		'Target four',
		'Target five',
	]);
	expect(ids(state()['groupedItems'][0])).toEqual([1]);
	const groupsCall = calls(fetch).find(
		(call) => call.startsWith('GET /items/bo_rel_target?') && call.includes('limit='),
	)!;
	expect(groupsCall).toContain('sort=sort');
	expect(groupsCall).toContain('limit=100');
	expect(groupsCall).toContain('fields=id,name');

	expect(state()['canReorderGroups']).toBe(true);
	expect(state()['canDeleteGroups']).toBe(true);
	expect(state()['canCreateGroups']).toBe(true);

	let before = calls(fetch).length;
	await state()['addGroup']('Target six');
	expect(calls(fetch).slice(before)[0]).toBe('POST /items/bo_rel_target');
	expect(fetch.mock.calls[before]![1]!.body).toBe(JSON.stringify({ name: 'Target six' }));

	before = calls(fetch).length;
	await state()['editGroup'](1, 'Renamed');
	expect(calls(fetch).slice(before)[0]).toBe('PATCH /items/bo_rel_target/1');
	await vi.waitFor(() => expect(state()['groupedItems'][0].title).toBe('Renamed'));

	before = calls(fetch).length;
	await state()['changeGroupSort']({ moved: { element: null, oldIndex: 0, newIndex: 1 } });
	expect(calls(fetch).slice(before)).toEqual(['POST /utils/sort/bo_rel_target']);

	before = calls(fetch).length;
	await state()['deleteGroup'](5);
	expect(calls(fetch).slice(before)[0]).toBe('DELETE /items/bo_rel_target/5');

	state()['onUpdate:showUngrouped'](true);
	await flushPromises();
	expect(state()['groupedItems'][0]).toMatchObject({ id: null, title: '_ungrouped' });
	expect(ids(state()['groupedItems'][0])).toContain(2);
});

test('changing the group field clears the group title', async () => {
	const { state, layoutOptions } = await mountKanban('bo_groups', {
		layoutOptions: { groupField: 'target', groupTitle: 'name' },
	});

	state()['onUpdate:groupField']('author');
	await flushPromises();
	expect(layoutOptions.value).toMatchObject({ groupField: 'author', groupTitle: null });
});

test('permissions: an editor may move cards of bo_content, a viewer may not; no group writes without update', async () => {
	await setup('bo-editor');
	let { state } = await mountKanban();
	expect(state()['canReorderItems']).toBe(true);
	expect(state()['canReorderGroups']).toBe(true);

	({ state } = await mountKanban('bo_groups', { layoutOptions: { groupField: 'target', groupTitle: 'name' } }));
	expect(state()['canReorderItems']).toBe(false);
	expect(state()['canUpdateGroupTitle']).toBe(false);
	expect(state()['canDeleteGroups']).toBe(false);
	expect(state()['canCreateGroups']).toBe(false);

	await setup('bo-viewer');
	({ state } = await mountKanban());
	expect(state()['canReorderItems']).toBe(false);
	expect(state()['canReorderGroups']).toBe(false);
});

test('a filter gives the relative count line and isFiltered', async () => {
	const filter = { status: { _eq: 'published' } };
	const { state } = await mountKanban('bo_content', { filterUser: filter });

	expect(state()['isFiltered']).toBe(true);
	expect(state()['showingCount']).toBe(i18n.global.t('filtered_item_count', { count: '10', total: '30' }, 10));
});
