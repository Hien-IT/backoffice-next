// Feature 018 T114 (FR-108, SC-007): Insights and the notifications drawer under load, in chromium with the production
// Vue build (runs with PERF=1 only, vitest.config.ts). Budgets hold on the reference machine and scale with
// machineFactor() (test-utils/perf.ts); a case is timed to a settled frame (promises flushed, two animation frames),
// median of 3 warm runs, on the fixture API that answers at once.
// - bo_dash_all (the 11 panel types, real registry): from the route entry (stores hydrated) to every tile drawn (no
//   loading state, the 4 charts with their sr-only ChartTable) under 1500 ms; 1 POST /graphql (8 aliases), no
//   /graphql/system, no dashboard or panel request (the store), plus the comments count of the page sidebar and the
//   list and count of the relational variable's closed item drawer (as Directus);
// - a variable change on bo_dash_vars (an owner selected, so the metric and the list query): the two dependent panels
//   updated under 500 ms; 1 POST /graphql with their 2 aliases only;
// - the notifications drawer with 25 rows: open to rows drawn under 300 ms; the first open sends the list and one
//   aggregate count (useItems), both GET /notifications;
// - drag and resize with 20 tiles in edit mode: one pointermove handled and rendered (Vue flush, forced style and
//   layout) under 16 ms, median of 50 moves. Two animation frames take 16.7 ms each at 60 Hz, so this case does not
//   wait for them; it times the work one move adds to a frame, as the flows test times generateArrows.
import { page } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { h, nextTick } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import NotificationsDrawer from '../../components/NotificationsDrawer.vue';
import { resetNotices } from '../../composables/use-notices.ts';
import { useAppStore } from '../../stores/app.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useInsightsStore } from '../../stores/insights.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { mountLayout } from '../../test-utils/layout.ts';
import { machineFactor } from '../../test-utils/perf.ts';
import DashboardRoute from './routes/DashboardRoute.vue';

const RUNS = 3;
// ponytail: a frame or 250 ms, whichever comes first. bo_dash_vars hung on CI past every limit (runs 39071346091,
// 39080871586) while it takes under 1 s locally; [Inference] a paused requestAnimationFrame of a hidden test frame.
const frame = () =>
	new Promise((resolve) => {
		requestAnimationFrame(resolve);
		setTimeout(resolve, 250);
	});
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

beforeAll(async () => {
	await page.viewport(1440, 900);
});

beforeEach(async () => {
	localStorage.clear();
	resetNotices();
	await replaceQueue();
});

function report(name: string, timings: number[], budget: number) {
	const factor = machineFactor();
	// eslint-disable-next-line no-console
	console.log(
		`FR-108 ${name}: ${timings.map((v) => v.toFixed(1)).join(', ')} ms (median ${median(timings).toFixed(1)}, budget ${(budget * factor).toFixed(1)}, machine factor ${factor.toFixed(2)})`,
	);
	expect(median(timings)).toBeLessThan(budget * factor);
}

// The CI runner is several times slower (machineFactor); a fixed 10 s cap failed there (run 39058333187). Measured once:
// machineFactor() runs its own benchmark, which must not fall inside a timed case.
let settleLimit = 10_000;
beforeAll(() => {
	settleLimit = 10_000 * Math.max(1, machineFactor());
});
// The 15 s default timed out the four variable changes on CI (run 39071346091, machine factor ~5, 9 perf files in
// parallel); a case still fails on its own budget, or at `settleLimit` when a page never settles.
vi.setConfig({ testTimeout: 90_000 });

/** Waits a frame at a time until `ready`, then for a settled frame; `state` describes the page when it never is. */
async function settled(ready: () => boolean, step: string, state: () => unknown = () => null) {
	const limit = settleLimit;
	const deadline = performance.now() + limit;

	while (!ready()) {
		if (performance.now() > deadline) {
			throw new Error(`perf: ${step} did not settle in ${Math.round(limit / 1000)} s: ${JSON.stringify(state())}`);
		}
		await flushPromises();
		await frame();
	}

	await flushPromises();
	await frame();
	await frame();
}

/** What a settle that never comes waits on (CI only, bo_dash_vars: runs 39071346091 to 39095641641). */
function insightsState(insights: ReturnType<typeof useInsightsStore>, fetch: ReturnType<typeof mockFixtureApi>) {
	return {
		tiles: [...document.querySelectorAll<HTMLElement>('[data-panel-id]')].map((tile) => tile.dataset['panelType']),
		loading: insights.loading,
		data: Object.keys(insights.data),
		errors: insights.errors,
		variables: insights.variables,
		route: document.querySelector('[data-insights-route]') ? 'dashboard' : document.body.innerText.slice(0, 200),
		workspace: document.querySelector('[data-insights-route]')?.innerHTML.slice(0, 300),
		requests: calls(fetch).length,
		last: calls(fetch).slice(-5),
	};
}

type Row = Record<string, unknown>;

// One aggregate/group/list row shape that every panel of the fixture reads (count.id, sum.qty, group.status, ...).
const ROWS = ['published', 'draft', 'archived', 'review', 'scheduled'].map((status, index) => ({
	id: index + 1,
	status,
	category: `category-${index}`,
	qty: 10 * (index + 1),
	group: {
		status,
		category: `category-${index}`,
		happened_at_year: 2026,
		happened_at_month: 9,
		happened_at_day: index + 1,
	},
	count: { id: index + 3, category: index + 3 },
	sum: { qty: 10 * (index + 1), amount: 12.5 * (index + 1) },
}));

const aliasesOf = (body: BodyInit | null | undefined) =>
	[...String(JSON.parse(String(body)).query).matchAll(/(query_[0-9a-f]+):/g)].map((match) => match[1]!);

/** GraphQL answered for every alias of the request. */
const graphqlAnswer = ({ init }: { init: RequestInit }) =>
	json({ data: Object.fromEntries(aliasesOf(init.body).map((alias) => [alias, ROWS])) });

const graphqlBodies = (fetch: ReturnType<typeof mockFixtureApi>) =>
	fetch.mock.calls
		.filter(([input, init]) => init?.method === 'POST' && new URL(String(input)).pathname === '/graphql')
		.map(([, init]) => init!.body);

const dashboardId = (snapshot: ReturnType<typeof loadSnapshot>, name: string) =>
	String(snapshot.dashboards.find((dashboard) => dashboard['name'] === name)!['id']);

const routes: RouteRecordRaw[] = [
	{
		path: '/insights/:primaryKey',
		name: 'insights-dashboard',
		component: DashboardRoute,
		props: true,
		// As modules/insights.ts: the route loads the panel data on entry.
		beforeEnter: (to) => void useInsightsStore().refresh(to.params['primaryKey'] as string),
		children: [{ path: ':panelKey', name: 'panel-detail', components: { detail: { render: () => null } } }],
	},
	{ path: '/insights', name: 'insights-overview', component: { render: () => null } },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

const tiles = () => document.querySelectorAll('[data-panel-id]').length;
const charts = () => document.querySelectorAll('[data-panel-id] [data-chart-table]').length;
const states = () => document.querySelectorAll('[data-panel-id] [data-panel-state]').length;
const canvases = () => document.querySelectorAll('[data-panel-id] .apexcharts-canvas').length;

async function mountDashboard(
	snapshot: ReturnType<typeof loadSnapshot>,
	dashboard: string,
	ready: (insights: ReturnType<typeof useInsightsStore>) => boolean,
	prepare: (insights: ReturnType<typeof useInsightsStore>) => void = () => undefined,
) {
	const fetch = mockFixtureApi(snapshot, { user: 'admin', answers: { 'POST /graphql': graphqlAnswer } });
	let start = 0;
	let insights!: ReturnType<typeof useInsightsStore>;
	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path: `/insights/${dashboard}`,
			// The stores of this mount's pinia: under load another pinia became active between these awaits (the app then
			// showed "Page Not Found" for a dashboard hydrated into the other store).
			async beforeMount(pinia) {
				await useUserStore(pinia).hydrate();
				await Promise.all([useCollectionsStore(pinia).hydrate(), useFieldsStore(pinia).hydrate()]);
				await usePermissionsStore(pinia).hydrate();
				insights = useInsightsStore(pinia);
				await insights.hydrate();
				prepare(insights);
				fetch.mockClear();
				start = performance.now();
			},
		},
	);
	await settled(
		() => insights.loading.length === 0 && ready(insights),
		`the mount of ${dashboard}`,
		() => insightsState(insights, fetch),
	);
	return { ...mounted, fetch, insights, time: performance.now() - start };
}

test('bo_dash_all: 11 panel types drawn under 1500 ms after the route entry, 1 POST /graphql', async () => {
	const snapshot = loadSnapshot();
	const id = dashboardId(snapshot, 'bo_dash_all');
	// Drawn: the 4 ApexCharts canvases too, not only their sr-only tables (rendered first; under load the canvas came later).
	const ready = () => tiles() === 11 && charts() === 4 && canvases() === 4 && states() === 0;
	(await mountDashboard(snapshot, id, ready)).wrapper.unmount(); // warm-up: the lazy chunks load on the first mount
	const timings: number[] = [];

	for (let index = 0; index < RUNS; index++) {
		const { time, wrapper, fetch } = await mountDashboard(loadSnapshot(), id, ready);
		expect(canvases()).toBe(4);
		// 8 panels query bo_insights_data in one POST /graphql (no /graphql/system: no system collection); label and
		// variable send nothing. The relational variable loads its closed item drawer (list and count of directus_users) as
		// Directus does (owner 2026-10-18). No comments count: the page sidebar is a closed popover since D-128.
		expect(
			calls(fetch)
				.map((call) => call.split('?')[0])
				.sort(),
		).toEqual(['GET /users', 'GET /users', 'POST /graphql']);
		expect(aliasesOf(graphqlBodies(fetch)[0])).toHaveLength(8);
		timings.push(time);
		wrapper.unmount();
	}

	report('dashboard 11 panel types', timings, 1500);
});

test('bo_dash_vars: a variable change updates the dependent panels under 500 ms, 1 POST /graphql', async () => {
	const snapshot = loadSnapshot();
	const id = dashboardId(snapshot, 'bo_dash_vars');
	const panelId = (type: string) =>
		String(snapshot.panels.find((panel) => panel['dashboard'] === id && panel['type'] === type)!['id']);
	const dependent = [panelId('metric'), panelId('list')];
	const { insights, fetch } = await mountDashboard(
		snapshot,
		id,
		(store) => tiles() === 4 && dependent.every((panel) => panel in store.data),
		(store) => (store.variables = { ...store.variables, vars_author: ['bo-1'] }),
	);
	const timings: number[] = [];

	// The first change is the warm-up; vars_status starts at its default `published`.
	for (const [index, status] of ['draft', 'published', 'draft', 'published'].entries()) {
		const before = dependent.map((panel) => insights.data[panel]);
		fetch.mockClear();
		const start = performance.now();
		insights.setVariable('vars_status', status);
		await settled(
			() => insights.loading.length === 0 && dependent.every((panel, i) => insights.data[panel] !== before[i]),
			`the variable change ${index} (${status})`,
			() => insightsState(insights, fetch),
		);
		const time = performance.now() - start;
		expect(calls(fetch)).toEqual(['POST /graphql']);
		expect(aliasesOf(graphqlBodies(fetch)[0])).toHaveLength(dependent.length);
		if (index > 0) timings.push(time);
	}

	report('variable change', timings, 500);
});

test('the notifications drawer: 25 rows drawn under 300 ms after opening', async () => {
	const rows: Row[] = Array.from({ length: 22 }, (_, index) => ({
		id: 1000 + index,
		recipient: 'bo-1',
		timestamp: '2026-09-01T00:00:00.000Z',
		subject: `bo_perf_${index}`,
		message: `Message **${index}**`,
		collection: null,
		item: null,
		status: 'inbox',
	}));

	const run = async () => {
		const fetch = mockFixtureApi(loadSnapshot(), { user: 'admin' });
		fetch.db['directus_notifications']!.push(...structuredClone(rows));
		let app!: ReturnType<typeof useAppStore>;
		const { wrapper } = await mountLayout(
			{ render: () => h(NotificationsDrawer) },
			{
				async beforeMount() {
					app = useAppStore();
					await useUserStore().hydrate();
					await Promise.all([useFieldsStore().hydrate(), useCollectionsStore().hydrate()]);
				},
			},
		);
		fetch.mockClear();
		const start = performance.now();
		app.notificationsDrawerOpen = true;
		await settled(() => document.querySelectorAll('[data-notification]').length === 25, 'the notifications drawer');
		return { time: performance.now() - start, wrapper, fetch };
	};

	(await run()).wrapper.unmount();
	const timings: number[] = [];

	for (let index = 0; index < RUNS; index++) {
		const { time, wrapper, fetch } = await run();
		const sent = calls(fetch);
		// useItems on the first open: the list (fields=) and the count (aggregate=).
		expect(sent.map((call) => call.split('?')[0])).toEqual(['GET /notifications', 'GET /notifications']);
		expect(sent.filter((call) => call.includes('fields='))).toHaveLength(1);
		expect(sent.filter((call) => call.includes('aggregate='))).toHaveLength(1);
		timings.push(time);
		wrapper.unmount();
	}

	report('notifications drawer 25 rows', timings, 300);
});

test('drag and resize with 20 tiles in edit mode: one pointermove under 16 ms', async () => {
	const snapshot = loadSnapshot();
	const all = dashboardId(snapshot, 'bo_dash_all');
	const source = snapshot.panels.filter((panel) => panel['dashboard'] === all);
	const id = 'perf-dash';
	snapshot.dashboards.push({ ...snapshot.dashboards[0]!, id, name: 'perf' });
	// The 11 panels of bo_dash_all, then 9 of them again under them: 20 tiles.
	snapshot.panels.push(
		...[...source, ...source.slice(0, 9)].map((panel, index) => ({
			...structuredClone(panel),
			id: `perf-panel-${index}`,
			dashboard: id,
			position_y: Number(panel['position_y']) + (index < 11 ? 0 : 30),
		})),
	);
	await mountDashboard(snapshot, id, () => tiles() === 20 && charts() === 8);
	document.querySelector<HTMLButtonElement>('[data-action="edit"]')!.click();
	await settled(() => document.querySelectorAll('[data-resize]').length === 20 * 8, 'the edit mode tiles');

	const gesture = async (handle: HTMLElement, attribute: 'posX' | 'width') => {
		const tile = handle.closest<HTMLElement>('[data-tile-id]')!;
		const box = handle.getBoundingClientRect();
		const x = box.left + box.width / 2;
		const y = box.top + box.height / 2;
		const initial = Number(tile.dataset[attribute]);
		handle.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: x, clientY: y, bubbles: true }));
		const timings: number[] = [];

		for (let index = 0; index < 50; index++) {
			const cells = 1 + (index % 2); // one or two cells right: every move changes the tile
			// Outside the 20 ms throttle window of the tile, so each move is handled at once (leading call).
			await new Promise((resolve) => setTimeout(resolve, 25));
			const start = performance.now();
			window.dispatchEvent(new PointerEvent('pointermove', { clientX: x + cells * 18, clientY: y }));
			await nextTick();
			void document.body.offsetHeight;
			timings.push(performance.now() - start);
			expect(Number(tile.dataset[attribute])).toBe(initial + cells);
		}

		window.dispatchEvent(new PointerEvent('pointerup', {}));
		await flushPromises();
		return timings;
	};

	const tile = document.querySelector<HTMLElement>('[data-tile-id="perf-panel-14"]')!;
	report('drag 20 tiles', await gesture(tile, 'posX'), 16);
	report('resize 20 tiles', await gesture(tile.querySelector<HTMLElement>('[data-resize="right"]')!, 'width'), 16);
});
