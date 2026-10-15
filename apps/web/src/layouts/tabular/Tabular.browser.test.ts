// T035 in a real browser (Reka menus and popovers): the tabular layout over the fixture API, rendered as the collection
// screen does (`<component :is="layout.component" v-bind="layoutState">`, the actions and options slots likewise).
import type { Filter } from '@directus/types';
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useServerStore } from '../../stores/server.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { type FixtureUser, loadSnapshot } from '../../test-utils/fixtures.ts';
import { createLayoutWrapper } from '../use-layout.ts';
import tabular from './index.ts';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;

async function setup(user: FixtureUser = 'admin', answers = {}) {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot(), { user, answers });
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
	useServerStore().info.queryLimit = { default: 100, max: 100 };
}

beforeEach(() => setup());

async function mountTabular(
	initial: { layoutQuery?: any; layoutOptions?: any; filterUser?: Filter | null; filter?: Filter | null } = {},
	waitRows = true,
) {
	const layoutQuery = ref(initial.layoutQuery ?? null);
	const layoutOptions = ref(initial.layoutOptions ?? null);
	const selection = ref<(string | number)[]>([]);
	const Wrapper = createLayoutWrapper(tabular);

	const Harness = defineComponent(() => () =>
		h(
			Wrapper,
			{
				collection: 'bo_content',
				layoutQuery: layoutQuery.value,
				layoutOptions: layoutOptions.value,
				selection: selection.value,
				filterUser: initial.filterUser ?? null,
				filter: initial.filter ?? initial.filterUser ?? null,
				resetPreset: async () => undefined,
				'onUpdate:layoutQuery': (value: any) => (layoutQuery.value = value),
				'onUpdate:layoutOptions': (value: any) => (layoutOptions.value = value),
				'onUpdate:selection': (value: any) => (selection.value = value),
			},
			{
				default: ({ layoutState }: { layoutState: Record<string, any> }) =>
					h('div', [
						h('header', [h(tabular.slots.actions, layoutState)]),
						h('aside', [h(tabular.slots.options, layoutState)]),
						h(tabular.component, layoutState, {
							'no-items': () => h('p', { 'data-test': 'no-items' }, 'empty'),
							'no-results': () => h('p', { 'data-test': 'no-results' }, 'no results'),
							error: ({ error }: { error: any }) => h('p', { 'data-test': 'error' }, String(error?.errors?.[0]?.message)),
						}),
					]),
			},
		),
	);

	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
	await router.push('/content/bo_content');
	const wrapper = mount(Harness, { global: { plugins: [router, i18n] }, attachTo: document.body });
	if (waitRows) await vi.waitFor(() => expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
	await flushPromises();

	return { wrapper, router, layoutQuery, layoutOptions, selection };
}

const headerTexts = () =>
	[...document.querySelectorAll('thead th[scope="col"] [data-reorder-handle] button > span.truncate')].map((el) =>
		el.textContent?.trim(),
	);

/** The page size select of the footer (BoSelect: the label points at the trigger). */
function perPage() {
	const label = [...document.querySelectorAll('label')].find((el) => el.textContent?.trim() === i18n.global.t('per_page'))!;
	return document.getElementById(label.htmlFor)!;
}

async function openHeaderMenu(index: number) {
	await userEvent.click(document.querySelectorAll<HTMLElement>('[data-reorder-handle] button')[index]!);
	await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());
}

async function choose(text: string) {
	const item = [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')].find(
		(el) => el.textContent?.includes(text),
	)!;
	await userEvent.click(item);
	await flushPromises();
}

test('renders the default columns with displays, the count line, pagination and the page size select', async () => {
	await mountTabular();

	expect(headerTexts()).toEqual(['Body', 'Date Published', 'Status', 'Title']);
	expect(document.querySelectorAll('tbody tr')).toHaveLength(25);
	expect(document.querySelector('caption')?.textContent).toBe('Bo Content');

	const status = document.querySelector('[role="status"]')!;
	expect(status.getAttribute('aria-live')).toBe('polite');
	expect(status.textContent).toContain(i18n.global.t('start_end_of_count_items', { start: 1, end: 25, count: 30 }));
	expect(status.textContent).toContain('Sorted by sort, ascending');

	const nav = document.querySelector('nav[aria-label="Bo Content"]')!;
	expect(nav.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('1');

	// queryLimit.max 100: 250, 500 and 1000 are not offered (FR-033).
	await userEvent.click(perPage());
	await vi.waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(3));
	expect([...document.querySelectorAll('[role="option"]')].map((el) => el.textContent?.replace('check', '').trim())).toEqual([
		'25',
		'50',
		'100',
	]);
	await userEvent.keyboard('{Escape}');

	assertOnlyKnownRequests(calls(fetch));
});

test('page size and page change write the preset query; the size select hides on a short last page', async () => {
	const { layoutQuery } = await mountTabular();

	await userEvent.click(perPage());
	await userEvent.click([...document.querySelectorAll<HTMLElement>('[role="option"]')].find((el) => el.textContent?.includes('50'))!);
	await vi.waitFor(() => expect(layoutQuery.value.limit).toBe(50));
	await vi.waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(30));
	expect(document.querySelector('nav')).toBeNull();

	await userEvent.click(perPage());
	await userEvent.click([...document.querySelectorAll<HTMLElement>('[role="option"]')].find((el) => el.textContent?.includes('25'))!);
	await vi.waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(25));

	const page2 = [...document.querySelectorAll<HTMLElement>('nav button')].find((b) => b.textContent?.trim() === '2')!;
	await userEvent.click(page2);
	await vi.waitFor(() => expect(layoutQuery.value.page).toBe(2));
	await vi.waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(5));
	expect(document.querySelector('[role="status"]')!.textContent).toContain(
		i18n.global.t('start_end_of_count_items', { start: 26, end: 30, count: 30 }),
	);
	// Directus shows the size select when items >= 25 or limit < 25.
	expect([...document.querySelectorAll('label')].map((el) => el.textContent?.trim())).not.toContain(i18n.global.t('per_page'));
});

test('header menu: sort, align, move left/right, width and hide', async () => {
	const { layoutQuery, layoutOptions } = await mountTabular();

	await openHeaderMenu(3);
	await choose(i18n.global.t('sort_desc'));
	expect(layoutQuery.value.sort).toEqual(['-title']);
	await vi.waitFor(() => expect(document.querySelector('th[aria-sort="descending"]')?.textContent).toContain('Title'));
	expect(document.querySelector('[role="status"]')!.textContent).toContain('Sorted by Title, descending');

	await openHeaderMenu(3);
	expect(document.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent).toContain(i18n.global.t('sort_desc'));
	await choose(i18n.global.t('right_align'));
	expect(layoutOptions.value.align).toEqual({ title: 'right' });

	await openHeaderMenu(3);
	expect(document.querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]')[1]!.getAttribute('data-disabled')).toBe('');
	await choose(i18n.global.t('move_left'));
	expect(layoutQuery.value.fields).toEqual(['body', 'date_published', 'title', 'status']);
	await vi.waitFor(() => expect(headerTexts()).toEqual(['Body', 'Date Published', 'Title', 'Status']));

	await openHeaderMenu(0);
	const width = document.querySelector<HTMLInputElement>('[role="menu"] input[type="number"]')!;
	expect(width.value).toBe('144');
	await userEvent.fill(width, '20');
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(layoutOptions.value.widths).toEqual({ body: 32, date_published: 144, title: 144, status: 144 }), {
		timeout: 1000,
	});
	await userEvent.keyboard('{Escape}');

	await openHeaderMenu(0);
	await choose(i18n.global.t('hide_field'));
	expect(layoutQuery.value.fields).toEqual(['date_published', 'title', 'status']);
});

test('"+" adds a column from the field list', async () => {
	const { layoutQuery } = await mountTabular();

	await userEvent.click(document.querySelector<HTMLElement>(`[aria-label="${i18n.global.t('add_field')}"]`)!);
	await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
	const tags = [...document.querySelectorAll<HTMLElement>('[role="dialog"] [role="treeitem"], [role="dialog"] button')].find(
		(el) => el.textContent?.trim() === 'Tags',
	)!;
	await userEvent.click(tags);
	await vi.waitFor(() => expect(layoutQuery.value.fields).toEqual(['body', 'date_published', 'status', 'title', 'tags']));
});

test('manual sort: the row menu moves a row down with POST /utils/sort while sorted by the sort field (D-69)', async () => {
	await mountTabular();

	const first = document.querySelector('tbody tr')!;
	const menu = first.querySelector<HTMLElement>('.row-menu')!;
	await userEvent.click(menu);
	await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());
	expect(
		[...document.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent?.includes('Move up'))!.getAttribute('data-disabled'),
	).toBe('');
	await choose('Move down');

	const sort = fetch.mock.calls.find(([input, init]) => String(input).includes('/utils/sort/bo_content') && init?.method === 'POST')!;
	expect(JSON.parse(String(sort[1]!.body))).toEqual({ item: 1, to: 2 });
	expect(document.querySelector('[aria-live="polite"][aria-atomic="true"]')?.textContent).toContain('moved to position 2');
});

test('manual sort is hidden without permission to update the sort field, and off when sorted by another field', async () => {
	await setup('bo-viewer');
	const viewer = await mountTabular();
	expect(document.querySelector('.row-menu')).toBeNull();
	expect(document.querySelector('.drag-handle')).toBeNull();
	viewer.wrapper.unmount();

	await setup();
	await mountTabular({ layoutQuery: { sort: ['title'] } });
	expect(document.querySelector('.row-menu')).toBeNull();
	expect(document.querySelector('.drag-handle')?.classList).toContain('cursor-not-allowed');
});

test('row click opens the item; with a selection it toggles the row', async () => {
	const { router, selection } = await mountTabular();

	await userEvent.click(document.querySelectorAll<HTMLElement>('tbody tr td')[3]!);
	await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/content/bo_content/1'));

	selection.value = [2];
	await flushPromises();
	await userEvent.click(document.querySelectorAll<HTMLElement>('tbody tr')[2]!.querySelectorAll('td')[3]!);
	await vi.waitFor(() => expect(selection.value).toEqual([2, 3]));
});

test('options: the spacing select changes the row height', async () => {
	const { layoutOptions } = await mountTabular();

	expect(document.querySelector<HTMLElement>('tbody tr')!.getBoundingClientRect().height).toBe(43);
	await userEvent.click(document.querySelector<HTMLElement>('aside button[role="combobox"]')!);
	await userEvent.click(
		[...document.querySelectorAll<HTMLElement>('[role="option"]')].find((el) => el.textContent?.trim() === 'Compact')!,
	);
	await vi.waitFor(() => expect(layoutOptions.value).toEqual({ spacing: 'compact' }));
	await vi.waitFor(() => expect(document.querySelector<HTMLElement>('tbody tr')!.getBoundingClientRect().height).toBe(29));
});

test('state slots: no-results with a user filter, no-items without, error with the API error', async () => {
	const noMatch = { title: { _eq: 'nothing matches' } };

	const results = await mountTabular({ filterUser: noMatch }, false);
	await vi.waitFor(() => expect(document.querySelector('[data-test="no-results"]')).not.toBeNull());
	expect(document.querySelector('table')).toBeNull();
	results.wrapper.unmount();

	const items = await mountTabular({ filter: noMatch }, false);
	await vi.waitFor(() => expect(document.querySelector('[data-test="no-items"]')).not.toBeNull());
	items.wrapper.unmount();

	await setup('admin', {
		'GET /items/bo_content': ({ url }: { url: URL }) =>
			url.searchParams.has('aggregate')
				? json({ data: [{ countDistinct: { id: 30 } }] })
				: json({ errors: [{ message: 'No access', extensions: { code: 'FORBIDDEN' } }] }, 403),
	});
	await mountTabular({}, false);
	await vi.waitFor(() => expect(document.querySelector('[data-test="error"]')?.textContent).toBe('No access'));
});
