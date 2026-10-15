// Ported from directus/app/src/layouts/kanban/kanban.test.ts
// Backoffice: the two date format cases mount Kanban.vue with the real i18n (no $t mock, no v-menu / v-dialog stubs);
// the other cases (T059) render the layout over the fixture API as the collection screen does and drive the keyboard
// path of the drags (D-69), the group dialogs (delete confirmation D-74), permissions and the horizontal scroll.
import type { Field } from '@directus/types';
import { page, userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { type FixtureUser, loadSnapshot } from '../../test-utils/fixtures.ts';
import { createLayoutWrapper } from '../use-layout.ts';
import kanban from './index.ts';
import Kanban from './Kanban.vue';

enableAutoUnmount(afterEach);

const t = (key: string, values?: Record<string, unknown>) => i18n.global.t(key, values ?? {});

describe('Kanban layout', () => {
	function dateField(display: string | null, display_options: Record<string, any> | null): Field[] {
		return [
			{
				collection: 'test',
				field: 'date_field',
				type: 'dateTime',
				name: 'Date',
				schema: null,
				meta: {
					id: 1,
					collection: 'test',
					field: 'date_field',
					group: null,
					hidden: false,
					interface: 'datetime',
					display,
					display_options,
					options: {},
					readonly: false,
					required: false,
					sort: null,
					special: null,
					translations: null,
					width: null,
					note: null,
					conditions: null,
					validation: null,
					validation_message: null,
				} as any,
			},
		];
	}

	function mountWithDate(fieldsInCollection: Field[]) {
		setActivePinia(createPinia());
		const router = createRouter({ history: createMemoryHistory(), routes: [] });

		return mount(Kanban, {
			global: { plugins: [i18n, router] },
			props: {
				itemCount: 1,
				totalCount: 1,
				isFiltered: false,
				limit: 100,
				fieldsInCollection,
				primaryKeyField: { field: 'id' },
				groupedItems: [
					{
						id: 'group1',
						title: 'Test Group',
						sort: 0,
						items: [
							{
								id: '7b0285f0-ca18-48a2-ba41-87b0b5b6bbea',
								title: 'My Title',
								text: 'my description',
								date: '2025-03-20T12:23:00',
								dateType: 'dateTime',
								sort: 0,
								users: [],
								item: {},
							},
						],
					},
				],
				change: vi.fn(),
				changeGroupSort: vi.fn(),
				addGroup: vi.fn(),
				editGroup: vi.fn(),
				deleteGroup: vi.fn(),
				canReorderGroups: false,
				canReorderItems: false,
				canUpdateGroupTitle: false,
				canDeleteGroups: false,
				selection: [],
				onClick: vi.fn(),
				layoutOptions: {
					groupField: 'not_important',
					groupTitle: 'not_important',
					crop: false,
					showUngrouped: false,
					groupOrder: { groupField: 'not_important', sortMap: {} },
					dateField: 'date_field',
				},
				resetPresetAndRefresh: vi.fn(),
			},
		});
	}

	it('applies custom date format when date exists and format is specified', async () => {
		const wrapper = mountWithDate(dateField('datetime', { format: 'eee - MMM/dd - yyyy' }));

		await flushPromises();

		await vi.waitFor(() => expect(wrapper.html()).toContain('Thu - Mar/20 - 2025'));
	});

	it('applies default date format when no format is specified', async () => {
		const wrapper = mountWithDate(dateField(null, null));

		await flushPromises();

		await vi.waitFor(() => expect(wrapper.html()).toContain('Mar 20, 2025 12:23PM'));
	});
});

/* ------------------------------------------------------------------ the layout over the fixture API */

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

async function mountLayout(collection = 'bo_content', initial: { layoutOptions?: any } = {}) {
	const layoutOptions = ref(initial.layoutOptions ?? null);
	const layoutQuery = ref(null);
	const selection = ref<(string | number)[]>([]);
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
					resetPreset: async () => undefined,
					'onUpdate:layoutQuery': (value: any) => (layoutQuery.value = value),
					'onUpdate:layoutOptions': (value: any) => (layoutOptions.value = value),
					'onUpdate:selection': (value: any) => (selection.value = value),
				},
				{
					default: ({ layoutState }: { layoutState: Record<string, any> }) =>
						h('div', { style: 'height: 600px; display: flex; flex-direction: column' }, [
							h('header', [h(kanban.slots.actions, layoutState)]),
							h('aside', [h(kanban.slots.options, layoutState)]),
							h(kanban.component, layoutState),
						]),
				},
			),
	);

	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
	await router.push(`/content/${collection}`);
	const wrapper = mount(Harness, { global: { plugins: [router, i18n] }, attachTo: document.body });
	await vi.waitFor(() => expect(document.querySelectorAll('[data-card]').length).toBeGreaterThan(0));
	await flushPromises();

	return { wrapper, router, layoutOptions, selection };
}

const columns = () => [...document.querySelectorAll('section h3')].map((el) => el.textContent?.trim());
const cardsOf = (column: number) =>
	[...document.querySelectorAll('section')[column]!.querySelectorAll<HTMLElement>('[data-card]')].map(
		(el) => el.dataset['card'],
	);
const card = (id: number | string) => document.querySelector<HTMLElement>(`[data-card="${id}"]`)!;

async function choose(text: string) {
	await vi.waitFor(() =>
		expect(
			[...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].some((el) => el.textContent?.includes(text)),
		).toBe(true),
	);
	const item = [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')].findLast((el) =>
		el.textContent?.includes(text),
	)!;
	await userEvent.click(item);
	await flushPromises();
}

test('renders the choices columns with counts, cards with title, tags, date and avatar, and the count line', async () => {
	await mountLayout('bo_content', { layoutOptions: { titleField: 'title' } });

	expect(columns()).toEqual(['Draft', 'Published', 'Archived']);
	expect(document.querySelectorAll('section')[0]!.textContent).toContain('10');
	expect(cardsOf(0).slice(0, 3)).toEqual(['1', '4', '7']);
	expect(card(2).textContent).toContain('Content 02');
	expect(card(2).textContent).toContain('News');
	expect(card(2).querySelector('[title]')).not.toBeNull();
	// The actions slot is a lazy component of the layout registry.
	await vi.waitFor(() => expect(document.querySelector('header [role="status"]')).not.toBeNull(), { timeout: 5000 });
	expect(document.querySelector('header [role="status"]')!.textContent).toContain(
		i18n.global.t('item_count', { count: '30' }, 30),
	);
	// options slot: group by status, advanced options collapsed.
	expect(document.querySelector('aside')!.textContent).toContain(t('layouts.kanban.group_field'));

	assertOnlyKnownRequests(calls(fetch));
});

test('a card opens its item on click and on Enter', async () => {
	const { router } = await mountLayout();

	await userEvent.click(card(4));
	await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/content/bo_content/4'));

	await router.push('/content/bo_content');
	card(7).focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/content/bo_content/7'));
});

test('card menu: "Move to group…" PATCHes the group field, "Move down" sorts (D-69)', async () => {
	await mountLayout();

	await userEvent.click(card(1).querySelector<HTMLElement>('.card-menu')!);
	await choose(t('move_down'));
	await vi.waitFor(() => expect(cardsOf(0).slice(0, 2)).toEqual(['4', '1']));
	expect(calls(fetch).at(-1)).toBe('POST /utils/sort/bo_content');
	expect(document.querySelector('[aria-live="polite"][aria-atomic="true"]')!.textContent).toContain(
		t('moved_to_position', { item: 'draft', position: 2, total: 10 }),
	);

	await userEvent.click(card(1).querySelector<HTMLElement>('.card-menu')!);
	const subTrigger = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
		el.textContent?.includes(t('move_to_group')),
	)!;
	subTrigger.focus();
	await userEvent.keyboard('{ArrowRight}');
	await choose('Published');
	await vi.waitFor(() => expect(cardsOf(1)).toContain('1'));
	expect(cardsOf(0)).not.toContain('1');
	expect(calls(fetch).at(-1)).toBe('PATCH /items/bo_content/1');
	expect(fetch.mock.calls.at(-1)![1]!.body).toBe(JSON.stringify({ status: 'published' }));
	await vi.waitFor(() => expect(document.activeElement).toBe(card(1)));
});

test('column menu "Move right" reorders the choices columns (groupOrder, D-69)', async () => {
	const { layoutOptions } = await mountLayout();

	await userEvent.click(document.querySelectorAll<HTMLElement>('.group-menu')[0]!);
	expect(
		[...document.querySelectorAll('[role="menuitem"]')]
			.find((el) => el.textContent?.includes(t('move_left')))!
			.hasAttribute('data-disabled'),
	).toBe(true);
	expect(document.querySelector('[role="menu"]')!.textContent).not.toContain(t('layouts.kanban.delete_group'));
	await choose(t('move_right'));

	await vi.waitFor(() => expect(columns()).toEqual(['Published', 'Draft', 'Archived']));
	expect(layoutOptions.value.groupOrder.sortMap).toEqual({ published: 0, draft: 1, archived: 2 });
});

test('relational groups: rename, add and delete with a confirmation that focuses Cancel (D-74)', async () => {
	await mountLayout('bo_groups', { layoutOptions: { groupField: 'target', groupTitle: 'name' } });
	await vi.waitFor(() => expect(columns()).toHaveLength(5));

	await userEvent.click(document.querySelectorAll<HTMLElement>('.group-menu')[0]!);
	await choose(t('layouts.kanban.edit_group'));
	const input = await vi.waitFor(() => document.querySelector<HTMLInputElement>('[role="dialog"] input')!);
	expect(input.value).toBe('Target one');
	await userEvent.clear(input);
	await userEvent.type(input, 'Renamed{Enter}');
	await vi.waitFor(() => expect(columns()[0]).toBe('Renamed'));
	expect(calls(fetch)).toContain('PATCH /items/bo_rel_target/1');

	await userEvent.click(
		[...document.querySelectorAll<HTMLElement>('button')].find((b) =>
			b.textContent?.includes(t('layouts.kanban.add_group')),
		)!,
	);
	await userEvent.type(
		await vi.waitFor(() => document.querySelector<HTMLInputElement>('[role="dialog"] input')!),
		'New',
	);
	await userEvent.click(
		[...document.querySelectorAll<HTMLElement>('[role="dialog"] button')].find((b) =>
			b.textContent?.includes(t('create')),
		)!,
	);
	await vi.waitFor(() => expect(columns()).toContain('New'));
	expect(calls(fetch)).toContain('POST /items/bo_rel_target');

	await userEvent.click(document.querySelectorAll<HTMLElement>('.group-menu')[4]!);
	await choose(t('layouts.kanban.delete_group'));
	const dialog = await vi.waitFor(() => document.querySelector<HTMLElement>('[role="dialog"]')!);
	expect(dialog.textContent).toContain(t('delete_are_you_sure'));
	await vi.waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe(t('cancel')));
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
	expect(calls(fetch).some((call) => call.startsWith('DELETE'))).toBe(false);

	await userEvent.click(document.querySelectorAll<HTMLElement>('.group-menu')[4]!);
	await choose(t('layouts.kanban.delete_group'));
	await userEvent.click(
		await vi.waitFor(
			() =>
				[...document.querySelectorAll<HTMLElement>('[role="dialog"] button')].find((b) =>
					b.textContent?.includes(t('delete_label')),
				)!,
		),
	);
	await vi.waitFor(() => expect(calls(fetch)).toContain('DELETE /items/bo_rel_target/5'));
	await vi.waitFor(() => expect(columns()).not.toContain('Target five'));
});

test('a viewer gets no card or column menus and no add column', async () => {
	await setup('bo-viewer');
	await mountLayout('bo_groups', { layoutOptions: { groupField: 'target', groupTitle: 'name' } });

	expect(document.querySelector('.card-menu')).toBeNull();
	expect(
		[...document.querySelectorAll('button')].some((b) => b.textContent?.includes(t('layouts.kanban.add_group'))),
	).toBe(false);
	// The column menu stays (Directus shows it with disabled items).
	await userEvent.click(document.querySelectorAll<HTMLElement>('.group-menu')[0]!);
	await vi.waitFor(() => expect(document.querySelectorAll('[role="menuitem"][data-disabled]')).toHaveLength(2));
});

test('at 768 px the board scrolls horizontally inside the layout, the page does not (FR-116)', async () => {
	await page.viewport(768, 1024);
	try {
		await mountLayout('bo_groups', { layoutOptions: { groupField: 'target', groupTitle: 'name' } });
		await vi.waitFor(() => expect(columns()).toHaveLength(5));

		const board = document.querySelector<HTMLElement>('.overflow-x-auto')!;
		expect(board.scrollWidth).toBeGreaterThan(board.clientWidth);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	} finally {
		await page.viewport(1280, 720);
	}
});
