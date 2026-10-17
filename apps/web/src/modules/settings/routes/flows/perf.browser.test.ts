// Feature 017 T093 (FR-108, SC-007): the Flows editor under load, in chromium with the production Vue build (runs with
// PERF=1 only, vitest.config.ts). Budgets hold on the reference machine and scale with machineFactor()
// (test-utils/perf.ts); a case is timed to a settled frame (promises flushed, two animation frames), median of 3 warm runs.
// - the canvas of a flow with 50 operations and 50 arrows under 500 ms after the store is loaded (an operation has one
//   parent, `resolve` and `reject` are unique: 50 operations draw at most 50 arrows, not the 60 of FR-108, T095);
// - `generateArrows` for those 50 panels under 8 ms (one pointer move of a drag), median of 50 calls;
// - an operation drawer under 200 ms after the route changes;
// - the Logs list of 10 runs under 300 ms after its GET /revisions;
// - requests: the flow page sends 1 GET /revisions (the log count, the Logs section closed); Save of a moved panel
//   1 PATCH /flows/:id then 1 GET /flows, no PATCH /operations (no link removed).
import { page } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { RouterView, type RouteRecordRaw, useRoute } from 'vue-router';
import { replaceQueue } from '../../../../api/sdk.ts';
import { i18n } from '../../../../lang/index.ts';
import { useSidebarStore } from '../../../../layout/stores/sidebar.ts';
import { useFlowsStore } from '../../../../stores/flows.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';
import { useServerStore } from '../../../../stores/server.ts';
import { useUserStore } from '../../../../stores/user.ts';
import '../../../../styles/index.css';
import { calls, mockFixtureApi } from '../../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../../test-utils/fixtures.ts';
import { mountLayout, press } from '../../../../test-utils/layout.ts';
import { machineFactor } from '../../../../test-utils/perf.ts';
import { generateArrows } from './components/arrows/lib/generate-arrows.ts';
import type { Panel } from './components/arrows/types.ts';
import LogsSidebarDetail from './components/LogsSidebarDetail.vue';
import FlowRoute from './FlowRoute.vue';
import OperationDetail from './OperationDetail.vue';

const RUNS = 3;
const OPERATIONS = 50;
const FLOW = 'perf-flow';
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const t = (key: string) => (i18n.global.t as (k: string) => string)(key);

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

beforeEach(async () => {
	localStorage.clear();
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

/**
 * The fixture snapshot with `perf-flow`: a chain of 40 operations under the trigger (40 resolve arrows) and 10 more,
 * each the reject of one of the first 10 (10 reject arrows); and 10 runs of bo_all_ops for the Logs list.
 */
function snapshotWithPerfFlow() {
	const snapshot = loadSnapshot();
	const id = 'perf-flow-id';
	const op = (index: number) => `perf-op-${index}`;
	const operations = Array.from({ length: OPERATIONS }, (_, index) => {
		const chain = index < 40;
		return {
			id: op(index),
			flow: id,
			name: `Step ${index}`,
			key: `step_${index}`,
			type: index % 2 ? 'log' : 'transform',
			position_x: chain ? 19 + 18 * index : 19 + 18 * (index - 40),
			position_y: chain ? 1 : 17,
			options: index % 2 ? { message: `step ${index}` } : { json: { index } },
			resolve: chain && index < 39 ? op(index + 1) : null,
			reject: index < 10 ? op(40 + index) : null,
		};
	});
	snapshot.editorFlows.push({
		id,
		name: FLOW,
		icon: 'bolt',
		color: null,
		description: null,
		status: 'active',
		trigger: 'manual',
		options: { collections: ['bo_content'] },
		accountability: 'all',
		operation: op(0),
	} as never);
	snapshot.operations.push(...operations);
	while (snapshot.flowRuns.length < 10) snapshot.flowRuns.push(structuredClone(snapshot.flowRuns[0]!));
	return { snapshot, id, operations };
}

const routes: RouteRecordRaw[] = [
	{ path: '/settings/flows', name: 'settings-flows-collection', component: { render: () => null } },
	{
		path: '/settings/flows/:primaryKey',
		name: 'settings-flows-item',
		component: FlowRoute,
		props: true,
		children: [{ path: ':operationId', name: 'settings-flows-operation', component: OperationDetail, props: true }],
	},
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function mountFlow(path: string, beforeMount: () => void = () => undefined) {
	const { snapshot, id, operations } = snapshotWithPerfFlow();
	const fetch = mockFixtureApi(snapshot, { user: 'admin', answers: { [`PATCH /flows/${id}`]: { id } } });
	let start = 0;
	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path: path.replace(':id', id),
			async beforeMount() {
				await useUserStore().hydrate();
				await usePermissionsStore().hydrate();
				await useFlowsStore().hydrate();
				useServerStore().info.queryLimit = { default: 100, max: -1 };
				beforeMount();
				fetch.mockClear();
				start = performance.now();
			},
		},
	);
	await flushPromises();
	await frame();
	await frame();
	return { ...mounted, fetch, id, operations, time: performance.now() - start };
}

const arrows = () => document.querySelectorAll('[data-flow-arrows] path[data-arrow]:not([data-hint])').length;

test('the canvas: 50 operations and 50 arrows under 500 ms after the store is loaded', async () => {
	(await mountFlow('/settings/flows/:id')).wrapper.unmount(); // warm-up: the lazy chunks load on the first mount
	const timings: number[] = [];

	for (let index = 0; index < RUNS; index++) {
		const { time, wrapper } = await mountFlow('/settings/flows/:id');
		expect(document.querySelectorAll('[data-panel-key]').length).toBe(OPERATIONS + 1);
		expect(arrows()).toBe(OPERATIONS);
		timings.push(time);
		wrapper.unmount();
	}

	report('canvas 50 operations', timings, 500);
});

test('generateArrows: 50 panels under 8 ms per pointer move', async () => {
	const { operations } = snapshotWithPerfFlow();
	const panels: Panel[] = [
		{ id: '$trigger', x: 1, y: 1, resolve: operations[0]!.id, reject: '' },
		...operations.map((o) => ({
			id: o.id,
			x: o.position_x,
			y: o.position_y,
			resolve: o.resolve ?? '',
			reject: o.reject ?? '',
		})),
	];
	const context = {
		editMode: true,
		parentPanels: {},
		arrowInfo: undefined,
		hoveredPanel: null,
		size: { width: 60 * 18 * 18, height: 40 * 18 },
	};
	generateArrows(panels, context);
	const timings: number[] = [];

	for (let index = 0; index < 50; index++) {
		// A drag moves one panel by a cell each pointer move.
		panels[20]!.x = 380 + (index % 3);
		const start = performance.now();
		const result = generateArrows(panels, context);
		timings.push(performance.now() - start);
		expect(result.filter((arrow) => !arrow.isHint)).toHaveLength(OPERATIONS);
	}

	report('generateArrows 50 panels', timings, 8);
});

test('the operation drawer opens under 200 ms after the route changes', async () => {
	(await mountFlow('/settings/flows/:id')).wrapper.unmount();
	const timings: number[] = [];

	for (let index = 0; index < RUNS; index++) {
		const { router, wrapper, id, operations } = await mountFlow('/settings/flows/:id');
		const start = performance.now();
		await router.push(`/settings/flows/${id}/${operations[index]!.id}`);
		await flushPromises();
		await frame();
		await frame();
		timings.push(performance.now() - start);
		expect(document.querySelector('[role="dialog"]')?.textContent).toContain(t('edit_operation'));
		wrapper.unmount();
	}

	report('operation drawer', timings, 200);
});

test('the Logs list: 10 runs under 300 ms after its GET /revisions', async () => {
	const { snapshot } = snapshotWithPerfFlow();
	const all = snapshot.editorFlows.find((flow) => flow.name === 'bo_all_ops')!.id;
	const logRoutes: RouteRecordRaw[] = [
		{
			path: '/settings/flows/:primaryKey',
			component: defineComponent({
				setup() {
					const route = useRoute();
					return () =>
						h(LogsSidebarDetail, {
							flow: useFlowsStore().flows.find((flow) => flow.id === route.params['primaryKey'])!,
						});
				},
			}),
		},
		{ path: '/:p(.*)*', component: { render: () => null } },
	];

	const run = async () => {
		const fetch = mockFixtureApi(snapshot, { user: 'admin' });
		let start = 0;
		const mounted = await mountLayout(
			{ render: () => h(RouterView) },
			{
				routes: logRoutes,
				path: `/settings/flows/${all}`,
				async beforeMount() {
					await useUserStore().hydrate();
					await usePermissionsStore().hydrate();
					await useFlowsStore().hydrate();
					useServerStore().info.queryLimit = { default: 100, max: -1 };
					useSidebarStore().activeAccordionItem = 'logs';
					start = performance.now();
				},
			},
		);
		await flushPromises();
		await frame();
		await frame();
		return { time: performance.now() - start, wrapper: mounted.wrapper, fetch };
	};

	(await run()).wrapper.unmount();
	const timings: number[] = [];

	for (let index = 0; index < RUNS; index++) {
		const { time, wrapper } = await run();
		expect(document.querySelectorAll('[data-flow-log] button').length).toBe(10);
		timings.push(time);
		wrapper.unmount();
	}

	report('logs list 10 runs', timings, 300);
});

test('requests: the flow page reads the log count only; Save sends one PATCH /flows/:id then GET /flows', async () => {
	// At xl the detail panel (with the Logs section) is part of the page; below it is a closed drawer.
	await page.viewport(1280, 900);
	const { fetch, id } = await mountFlow('/settings/flows/:id');
	const sent = () => calls(fetch).map((call) => call.split('?')[0]);
	expect(sent()).toEqual(['GET /revisions']);

	fetch.mockClear();
	const button = (label: string) =>
		[...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.getAttribute('aria-label') === label)!;
	button(t('edit_flow')).click();
	await flushPromises();
	// Duplicate stages a new operation without a link: no PATCH /operations on Save.
	const trigger = document.querySelector<HTMLButtonElement>(
		'[data-panel-key="step_5"] button[aria-label^="Options for"]',
	)!;
	trigger.focus();
	await press(trigger, 'Enter');
	[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
		.find((el) => el.textContent?.includes(t('duplicate')))!
		.click();
	await flushPromises();
	button(t('save')).click();
	await flushPromises();
	await flushPromises();

	expect(sent()).toEqual([`PATCH /flows/${id}`, 'GET /flows']);
});
