// Spec 018 US2, US3 (T040, T061; FR-020 to FR-029): the dashboard page with the panel registry stubbed (the panel
// components have their own browser tests). View mode: one tile per panel at its cell and size, corners that touch
// another tile are square, loading / error / no-data states, an unknown type renders its header only, one POST /graphql;
// zoom toggles; edit mode stages moves, duplicates and deletes, Save sends the batch requests and leaves edit mode (even
// on an error, R-56), Clear Changes asks first.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../api/sdk.ts';
import { resetNotices, useNotices } from '../../../composables/use-notices.ts';
import { i18n } from '../../../lang/index.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useInsightsStore } from '../../../stores/insights.ts';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { useUserStore } from '../../../stores/user.ts';
import { calls, json, mockFixtureApi } from '../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import DashboardRoute from './DashboardRoute.vue';

const StubPanel = defineComponent({
	props: ['data'],
	setup: (props) => () => h('output', { 'data-stub': '' }, JSON.stringify(props.data ?? null)),
});

vi.mock('../../../panels/index.ts', () => {
	const config = (id: string, extra: Record<string, unknown> = {}) => ({
		id,
		name: id,
		icon: 'functions',
		component: StubPanel,
		options: [],
		minWidth: 2,
		minHeight: 2,
		query: (options: Record<string, any>) =>
			options['collection']
				? {
						collection: options['collection'],
						query: { aggregate: { count: ['id'] }, filter: options['filter'], limit: 1 },
					}
				: undefined,
		...extra,
	});
	const panels = ['metric', 'label'].map((id) => config(id));
	return { getPanels: () => panels, getPanel: (id: string) => panels.find((panel) => panel.id === id) };
});

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);
const SLOW = 15_000;
const DASHBOARD = 'dash-1';

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	resetNotices();
	await replaceQueue();
});

const panel = (id: string, type: string, [x, y, width, height]: number[], options: Record<string, unknown> = {}) => ({
	id,
	dashboard: DASHBOARD,
	type,
	name: id,
	icon: null,
	color: null,
	note: id === 'p1' ? 'A note' : null,
	show_header: true,
	position_x: x,
	position_y: y,
	width,
	height,
	options,
});

const PANELS = [
	panel('p1', 'metric', [1, 1, 6, 4], { collection: 'bo_insights_data' }),
	panel('p2', 'metric', [7, 1, 6, 4], { collection: 'bo_insights_data' }),
	panel('p3', 'label', [1, 5, 12, 2], { text: 'x' }),
	panel('p4', 'bo-unknown', [13, 1, 4, 4]),
];

const graphqlAnswer = ({ init }: { init: RequestInit }) => {
	const query: string = JSON.parse(String(init.body)).query;
	const aliases = [...query.matchAll(/(query_[0-9a-f]+):/g)].map((match) => match[1]!);
	return json({ data: Object.fromEntries(aliases.map((alias) => [alias, [{ count: { id: 12 } }]])) });
};

async function setup(answers: Record<string, unknown> = {}) {
	const routes: RouteRecordRaw[] = [
		{
			path: '/insights/:primaryKey',
			name: 'insights-dashboard',
			component: DashboardRoute,
			props: true,
			children: [{ path: ':panelKey', name: 'panel-detail', components: { detail: { render: () => null } } }],
		},
		{ path: '/insights', name: 'insights-overview', component: { render: () => null } },
		{ path: '/:p(.*)*', component: { render: () => null } },
	];

	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path: `/insights/${DASHBOARD}`,
			async beforeMount() {
				fetch = mockFixtureApi(loadSnapshot(), {
					user: 'admin',
					answers: {
						'GET /dashboards': [{ id: DASHBOARD, name: 'Sales', icon: 'dashboard' }],
						'GET /panels': PANELS,
						'POST /graphql': graphqlAnswer,
						'POST /panels': [],
						'PATCH /panels': [],
						'DELETE /panels': () => new Response(null, { status: 204 }),
						...answers,
					},
				});
				await useUserStore().hydrate();
				await Promise.all([useCollectionsStore().hydrate(), useFieldsStore().hydrate()]);
				await usePermissionsStore().hydrate();
				await useInsightsStore().hydrate();
				await useInsightsStore().refresh(DASHBOARD);
			},
		},
	);

	await flushPromises();
	await flushPromises();
	return mounted;
}

const openMenu = (id: string) => {
	const trigger = tile(id).querySelector<HTMLButtonElement>('button[aria-label^="Options"]')!;
	trigger.focus();
	trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
};
const menuItem = (text: string) =>
	[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) => el.textContent?.includes(text))!;
const tile = (id: string) => document.querySelector<HTMLElement>(`[data-panel-id="${id}"]`)!;
const button = (label: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.getAttribute('aria-label') === label);

describe('DashboardRoute view mode', () => {
	test(
		'tiles at their cell and size, square touching corners, header and note, data and one GraphQL request',
		async () => {
			await setup();

			expect(document.querySelector('main h1')!.textContent).toContain('Sales');
			expect([...document.querySelectorAll('[data-panel-id]')].map((el) => el.getAttribute('data-panel-id'))).toEqual([
				'p1',
				'p2',
				'p3',
				'p4',
			]);
			expect(tile('p2').dataset).toMatchObject({ posX: '7', posY: '1', width: '6', height: '4' });
			// p1's top-right corner sits on p2's left border, its bottom corners on p3's top border.
			expect(tile('p1').className).toContain('rounded-tl-xl');
			expect(tile('p1').className).toContain('rounded-tr-none');
			expect(tile('p1').className).toContain('rounded-bl-none');
			expect(tile('p1').getAttribute('role')).toBe('region');
			expect(tile('p1').getAttribute('aria-label')).toBe('p1');
			expect(button('A note')).toBeDefined();
			expect(tile('p1').querySelector('[data-stub]')!.textContent).toContain('12');
			expect(tile('p4').querySelector('[data-stub]')).toBeNull();
			expect(calls(fetch).filter((call) => call.startsWith('POST /graphql'))).toHaveLength(1);
		},
		SLOW,
	);

	test(
		'a partial GraphQL error shows on its tile only; empty data shows no_data',
		async () => {
			await setup({
				'POST /graphql': ({ init }: { init: RequestInit }) => {
					const aliases = [...JSON.parse(String(init.body)).query.matchAll(/(query_[0-9a-f]+):/g)].map(
						(match: RegExpMatchArray) => match[1]!,
					);
					return json({
						data: { [aliases[1]!]: [] },
						errors: [
							{ message: 'Bad', extensions: { code: 'INVALID_QUERY', graphqlErrors: [{ path: [aliases[0]] }] } },
						],
					});
				},
			});

			const states = ['p1', 'p2'].map((id) =>
				tile(id).querySelector('[data-panel-state]')?.getAttribute('data-panel-state'),
			);
			expect(states.sort()).toEqual(['error', 'no-data']);
		},
		SLOW,
	);

	test(
		'zoom to fit is a pressed toggle',
		async () => {
			await setup();
			const zoom = button(t('fit_to_screen'))!;
			zoom.click();
			await flushPromises();
			expect(zoom.getAttribute('aria-pressed')).toBe('true');
			expect(document.querySelector('[data-workspace]')!.hasAttribute('data-zoom')).toBe(true);
		},
		SLOW,
	);
});

// Spec 018 US4 (T070, FR-053, FR-054): a variable change reloads only the panels whose options use it, in one request,
// with the value applied to their query (applyOptionsData).
test(
	'a variable change asks the data of the panels that use it only',
	async () => {
		await setup({
			'GET /panels': [
				panel('p1', 'metric', [1, 1, 6, 4], {
					collection: 'bo_insights_data',
					filter: { status: { _eq: '{{ status }}' } },
				}),
				panel('p2', 'metric', [7, 1, 6, 4], { collection: 'bo_insights_data' }),
			],
		});
		const bodies = () =>
			fetch.mock.calls
				.filter(([input, init]) => init?.method === 'POST' && new URL(String(input)).pathname === '/graphql')
				.map(([, init]) => JSON.parse(String(init!.body)).query as string);
		const before = bodies().length;

		useInsightsStore().setVariable('status', 'draft');
		await vi.waitFor(() => expect(bodies().length).toBe(before + 1));
		await flushPromises();

		expect(
			bodies()
				.at(-1)!
				.match(/query_[0-9a-f]+:/g),
		).toHaveLength(1);
		expect(bodies().at(-1)).toContain('draft');
		expect(tile('p1').querySelector('[data-stub]')!.textContent).toContain('12');
	},
	SLOW,
);

describe('DashboardRoute edit mode', () => {
	test(
		'duplicate and delete stage edits; Save sends POST and DELETE /panels, then leaves edit mode',
		async () => {
			await setup();
			button(t('edit_panels'))!.click();
			await flushPromises();
			expect(button(t('save'))!.disabled).toBe(true);

			const menu = (id: string) => tile(id).querySelector<HTMLButtonElement>('button[aria-label^="Options"]')!;
			menu('p3').focus();
			menu('p3').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
			await flushPromises();
			[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
				.find((el) => el.textContent?.includes(t('duplicate')))!
				.click();
			await flushPromises();

			useInsightsStore().stagePanelDelete('p4');
			await flushPromises();
			expect(document.querySelectorAll('[data-panel-id]')).toHaveLength(4);

			button(t('save'))!.click();
			await flushPromises();
			await flushPromises();

			const writes = fetch.mock.calls
				.filter(
					([input, init]) =>
						['POST', 'DELETE'].includes(init?.method ?? '') && new URL(String(input)).pathname === '/panels',
				)
				.map(([, init]) => [init!.method, JSON.parse(String(init!.body))]);
			expect(writes).toEqual([
				['POST', [expect.objectContaining({ type: 'label', position_x: 3, position_y: 7 })]],
				['DELETE', ['p4']],
			]);
			expect(button(t('edit_panels'))).toBeDefined();
		},
		SLOW,
	);

	test(
		'Save error: the error dialog, the edits stay, edit mode ends (R-56)',
		async () => {
			await setup({
				'DELETE /panels': () => json({ errors: [{ message: 'No', extensions: { code: 'FORBIDDEN' } }] }, 403),
			});
			button(t('edit_panels'))!.click();
			await flushPromises();
			useInsightsStore().stagePanelDelete('p4');
			await flushPromises();

			button(t('save'))!.click();
			await flushPromises();
			await flushPromises();

			expect(useNotices().dialogs.value).toHaveLength(1);
			expect(useInsightsStore().hasEdits).toBe(true);
			expect(button(t('edit_panels'))).toBeDefined();
		},
		SLOW,
	);

	test(
		'Clear Changes with edits asks first; discarding empties the staging',
		async () => {
			await setup();
			button(t('edit_panels'))!.click();
			await flushPromises();
			useInsightsStore().stagePanelDelete('p4');
			await flushPromises();

			button(t('clear_changes'))!.click();
			await flushPromises();
			const dialog = document.querySelector('[role="dialog"]')!;
			expect(dialog.textContent).toContain(t('discard_changes_copy'));
			[...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('discard_changes'))!.click();
			await flushPromises();

			expect(useInsightsStore().hasEdits).toBe(false);
			expect(document.querySelectorAll('[data-panel-id]')).toHaveLength(4);
		},
		SLOW,
	);

	test(
		'entering edit mode turns zoom off and focuses "+" (Save is disabled); deleting a tile focuses the previous one',
		async () => {
			await setup();
			button(t('fit_to_screen'))!.click();
			await flushPromises();
			button(t('edit_panels'))!.click();
			await flushPromises();

			expect(button(t('fit_to_screen'))).toBeUndefined();
			expect(document.querySelector('[data-workspace]')!.hasAttribute('data-zoom')).toBe(false);
			// Save is disabled without edits: "+" gets the focus.
			expect(document.activeElement).toBe(document.querySelector('[data-action="create"]'));

			openMenu('p2');
			await flushPromises();
			menuItem(t('delete')).click();
			await flushPromises();
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(document.querySelector('[data-panel-id="p2"]')).toBeNull();
			expect(document.activeElement?.closest('[data-tile-id]')?.getAttribute('data-tile-id')).toBe('p1');
		},
		SLOW,
	);

	test(
		'Copy To stages a duplicate on the other dashboard; Save posts it there',
		async () => {
			await setup({
				'GET /dashboards': [
					{ id: DASHBOARD, name: 'Sales', icon: 'dashboard' },
					{ id: 'dash-2', name: 'Ops', icon: 'dashboard' },
				],
			});
			button(t('edit_panels'))!.click();
			await flushPromises();

			openMenu('p3');
			await flushPromises();
			menuItem(t('copy_to')).click();
			await flushPromises();
			const dialog = document.querySelector('[role="dialog"]')!;
			[...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('copy'))!.click();
			await flushPromises();

			expect(useInsightsStore().edits.create).toEqual([
				expect.objectContaining({ dashboard: 'dash-2', type: 'label', position_x: 3, position_y: 7 }),
			]);
			// The copy is on the other dashboard: this one still shows 4 tiles.
			expect(document.querySelectorAll('[data-panel-id]')).toHaveLength(4);

			button(t('save'))!.click();
			await flushPromises();
			await flushPromises();
			const posts = fetch.mock.calls.filter(
				([input, init]) => init?.method === 'POST' && new URL(String(input)).pathname === '/panels',
			);
			expect(JSON.parse(String(posts[0]![1]!.body))).toEqual([expect.objectContaining({ dashboard: 'dash-2' })]);
		},
		SLOW,
	);

	test(
		'leaving with edits asks first (unsaved_changes); opening the panel drawer does not',
		async () => {
			const { router } = await setup();
			button(t('edit_panels'))!.click();
			await flushPromises();
			useInsightsStore().stagePanelDelete('p4');
			await flushPromises();

			await router.push(`/insights/${DASHBOARD}/p1`);
			await flushPromises();
			expect(router.currentRoute.value.params['panelKey']).toBe('p1');
			expect(document.body.textContent).not.toContain(t('unsaved_changes'));

			await router.push('/insights');
			await flushPromises();
			expect(router.currentRoute.value.name).toBe('panel-detail');
			expect(document.querySelector('[role="dialog"]')!.textContent).toContain(t('unsaved_changes'));
		},
		SLOW,
	);

	test(
		'meta+s without changes sends nothing, even outside edit mode',
		async () => {
			await setup();
			fetch.mockClear();

			document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }));
			await flushPromises();

			expect(fetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') !== 'GET')).toEqual([]);
		},
		SLOW,
	);
});
