// DR has no test for drawer-collection.vue: the drawer on bo_rel_target of the fixture snapshot, in the layout
// of the preset (014 FR-029; tabular here): columns from the preset or the first 4 visible fields, search, pagination,
// selection, interface filter and the empty/error states (FR-046 of 013, contracts/api-calls.md #34, #35).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePresetsStore } from '../../stores/presets.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { createMemoryHistory, createRouter } from 'vue-router';
import SearchInput from '../SearchInput.vue';
import DrawerCollection from './DrawerCollection.vue';

enableAutoUnmount(afterEach);

const snapshot = loadSnapshot();
let fetch: ReturnType<typeof mockFixtureApi>;
let hydrateCalls = 0;

async function setup(answers: Parameters<typeof mockFixtureApi>[1] = {}) {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(snapshot, answers);
	await useUserStore().hydrate();
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
	hydrateCalls = fetch.mock.calls.length;
}

beforeEach(() => setup());

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	vi.useRealTimers();
});

const drawerCalls = () => calls(fetch).slice(hydrateCalls);
const listCalls = () => drawerCalls().filter((call) => !call.includes('aggregate'));

async function mountDrawer(props: Record<string, unknown> = {}) {
	const wrapper = mount(DrawerCollection, {
		props: {
			collection: 'bo_rel_target',
			active: true,
			'onUpdate:active': (active: boolean) => wrapper.setProps({ active }),
			...props,
		},
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await vi.waitFor(() => expect(document.querySelector('[role="dialog"] tbody')).not.toBeNull());
	await flushPromises();
	return wrapper;
}

const panel = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const headers = () =>
	[...panel().querySelectorAll('thead th[scope="col"] .truncate')].map((th) => th.textContent?.trim());
const rows = () => [...panel().querySelectorAll('tbody tr')].map((tr) => tr.textContent?.trim());
const rowCheckbox = (index: number) => panel().querySelectorAll<HTMLElement>('tbody [role="checkbox"]')[index]!;
const saveButton = () => panel().querySelector<HTMLButtonElement>('header button[aria-label="Save"]')!;

function expectQuery(call: string, parts: string[]) {
	expect(call.startsWith('GET /items/bo_rel_target?')).toBe(true);
	for (const part of parts) expect(call.split(/[?&]/)).toContain(part);
}

async function settle() {
	// useItems throttles its requests by 500 ms.
	await new Promise((resolve) => setTimeout(resolve, 550));
	await flushPromises();
}

describe('DrawerCollection', () => {
	test('nothing is fetched while closed', async () => {
		mount(DrawerCollection, { props: { collection: 'bo_rel_target' }, global: { plugins: [i18n] } });
		await flushPromises();
		expect(drawerCalls()).toEqual([]);
	});

	// Spec 023 (D-187): the drawer filter offers the JSON path entry, like the Content page.
	test('the search bar of the drawer turns on the JSON path entry', async () => {
		const wrapper = await mountDrawer();
		expect(wrapper.findComponent(SearchInput).props('includeJsonPath')).toBe(true);
	});

	test('default columns: first 4 visible fields (sorted), sort field, limit 25, page 1; title and subtitle', async () => {
		await mountDrawer();

		expect(headers()).toEqual(['Name', 'Status']);
		expect(listCalls()).toHaveLength(1);
		expectQuery(listCalls()[0]!, ['fields=name,status,id', 'sort=sort', 'limit=25', 'page=1']);
		expect(drawerCalls().some((call) => call.includes('aggregate={"countDistinct":"id"}'))).toBe(true);
		expect(rows()[0]).toContain('Target one');
		expect(rows()).toHaveLength(5);
		expect(panel().querySelector('h2')!.textContent).toContain('Select Item');
	});

	test('columns, sort and limit from the preset layout_query.tabular; pagination', async () => {
		usePresetsStore().collectionPresets = [
			{
				id: 1,
				bookmark: null,
				user: null,
				role: null,
				collection: 'bo_rel_target',
				search: null,
				filter: null,
				layout: 'tabular',
				layout_query: { tabular: { fields: ['id', 'name', 'unknown'], sort: ['-id'], limit: 2 } },
				layout_options: { tabular: { widths: { name: 300 } } },
				refresh_interval: null,
				icon: 'bookmark',
				color: null,
			},
		] as any;

		await mountDrawer();

		expect(headers()).toEqual(['ID', 'Name']);
		expect(listCalls()).toHaveLength(1);
		expectQuery(listCalls()[0]!, ['fields=id,name', 'sort=-id', 'limit=2', 'page=1']);
		expect(rows()[0]).toContain('Target five');
		expect(panel().querySelector('[role="status"]')!.textContent).toContain('1-2 of 5 Items');

		[...panel().querySelectorAll<HTMLButtonElement>('nav button')].find((b) => b.textContent?.trim() === '2')!.click();
		await settle();

		expectQuery(listCalls().at(-1)!, ['fields=id,name', 'sort=-id', 'limit=2', 'page=2']);
		expect(rows()).toHaveLength(2);
		expect(panel().querySelector('[role="status"]')!.textContent).toContain('3-4 of 5 Items');
	});

	test('search input sends `search` and the count follows', async () => {
		await mountDrawer();

		const input = panel().querySelector<HTMLInputElement>('input[type="search"]')!;
		expect(input.getAttribute('aria-label')).toBe('Search Items...');
		input.value = 'two';
		input.dispatchEvent(new Event('input'));
		await settle();

		expect(listCalls().at(-1)).toContain('search=two');
		expect(rows()).toHaveLength(1);
		expect(rows()[0]).toContain('Target two');
	});

	test('the interface filter is applied; an empty result shows no_items', async () => {
		await mountDrawer({ filter: { status: { _eq: 'published' } } });

		expect(listCalls()[0]).toContain('filter={"status":{"_eq":"published"}}');
		expect(rows()).toHaveLength(3);

		await mountDrawer({ filter: { status: { _eq: 'none' } } });
		await vi.waitFor(() => expect(document.querySelectorAll('[role="dialog"]')[1]!.textContent).toContain('No Items'));
	});

	test('single selection keeps the last row; save emits the keys and closes', async () => {
		const wrapper = await mountDrawer();

		rowCheckbox(0).click();
		await flushPromises();
		rowCheckbox(1).click();
		await flushPromises();
		saveButton().click();
		await flushPromises();

		expect(wrapper.emitted('input')).toEqual([[[2]]]);
		expect(wrapper.emitted('update:active')).toEqual([[false]]);
	});

	test('multiple selection', async () => {
		const wrapper = await mountDrawer({ multiple: true });

		rowCheckbox(0).click();
		await flushPromises();
		rowCheckbox(2).click();
		await flushPromises();
		saveButton().click();
		await flushPromises();

		expect(wrapper.emitted('input')).toEqual([[[1, 3]]]);
	});

	test('save is disabled until the selection changes from the one at opening; cancel closes', async () => {
		const wrapper = mount(DrawerCollection, {
			props: {
				collection: 'bo_rel_target',
				active: false,
				selection: [1],
				'onUpdate:active': (active: boolean) => wrapper.setProps({ active }),
			},
			global: { plugins: [i18n] },
			attachTo: document.body,
		});

		await wrapper.setProps({ active: true });
		await vi.waitFor(() => expect(document.querySelector('[role="dialog"] tbody')).not.toBeNull());
		await flushPromises();

		expect(saveButton().disabled).toBe(true);
		expect(rowCheckbox(0).getAttribute('aria-checked')).toBe('true');

		panel().querySelector<HTMLButtonElement>('header button[aria-label="Cancel"]')!.click();
		await flushPromises();

		expect(wrapper.emitted('update:active')).toEqual([[false]]);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('a failed request shows the translated API error', async () => {
		await setup({
			answers: {
				'GET /items/bo_rel_target': ({ url }: { url: URL }) =>
					url.searchParams.has('aggregate')
						? json({ data: [{ countDistinct: { id: '0' } }] })
						: json({ errors: [{ message: 'boom', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }, 500),
			},
		});

		mount(DrawerCollection, {
			props: { collection: 'bo_rel_target', active: true },
			global: { plugins: [i18n] },
			attachTo: document.body,
		});

		await vi.waitFor(() => expect(document.querySelector('[role="dialog"] [role="alert"]')).not.toBeNull());
		expect(panel().querySelector('table')).toBeNull();
	});
});

describe('DrawerCollection layouts (014 FR-029)', () => {
	test('the layout of the preset, no layout options sidebar as Directus; the preset is not written (FR-019)', async () => {
		usePresetsStore().collectionPresets = [
			{ id: 1, bookmark: null, user: null, role: null, collection: 'bo_rel_target', layout: 'tabular' },
		] as any;

		await mountDrawer();

		expect(panel().querySelector('aside[aria-label="Sidebar"]')).toBeNull();
		expect(panel().textContent).not.toContain('Layout Options');
		expect(drawerCalls().some((call) => call.includes('/presets'))).toBe(false);
	});

	test('a preset in cards opens the drawer in cards; selecting a card emits its key', async () => {
		usePresetsStore().collectionPresets = [
			{ id: 1, bookmark: null, user: null, role: null, collection: 'bo_rel_target', layout: 'cards' },
		] as any;

		const wrapper = mount(DrawerCollection, {
			props: {
				collection: 'bo_rel_target',
				active: true,
				'onUpdate:active': (active: boolean) => wrapper.setProps({ active }),
			},
			// Cards are links to the items.
			global: {
				plugins: [
					i18n,
					createRouter({
						history: createMemoryHistory(),
						routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
					}),
				],
			},
			attachTo: document.body,
		});

		// Five cards (no title template on bo_rel_target: the fallback icon), no table.
		await vi.waitFor(() => expect(panel().textContent).toContain('5 Items'), { timeout: 4000 });
		expect(panel().querySelector('table')).toBeNull();

		await vi.waitFor(() => expect(panel().querySelector('[aria-label="Select 1"]')).not.toBeNull());
		const first = panel().querySelector<HTMLElement>('[aria-label="Select 1"]')!;
		first.click();
		await flushPromises();
		saveButton().click();
		await flushPromises();

		expect(wrapper.emitted('input')?.[0]?.[0]).toHaveLength(1);
	});
});
