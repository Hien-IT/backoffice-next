// Feature 016 T115 (FR-108, SC-007): Settings under load, in chromium with the production Vue build (runs with PERF=1
// only, vitest.config.ts). Budgets hold on the reference machine and scale with machineFactor() (test-utils/perf.ts);
// each case is timed from mount to a settled frame (promises flushed, two animation frames), median of 3 warm runs.
// - the collection tree with 300 collections in 30 open folders under 500 ms;
// - the field grid with 200 fields in 10 groups under 500 ms;
// - the permissions matrix with 60 collections × 5 actions under 500 ms, 300 × 5 under 1 s;
// - an existing field opens in the field drawer (store loaded, Schema tab drawn) under 300 ms after its request;
// - requests: the collection page sends GET /collections/:c and GET /fields twice (guard and fields-management, as
//   Directus); the policy page GET /policies/:id and
//   GET /permissions; opening an existing field GET /fields/:c/:f only.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import SystemPermissions from '../../interfaces/_system/system-permissions/SystemPermissions.vue';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useServerStore } from '../../stores/server.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { calls, mockApi } from '../../test-utils/fetch.ts';
import { mountLayout } from '../../test-utils/layout.ts';
import { machineFactor } from '../../test-utils/perf.ts';
import settings from '../settings.ts';
import CollectionsRoute from './routes/data-model/CollectionsRoute.vue';
import FieldsManagement from './routes/data-model/fields/FieldsManagement.vue';

const RUNS = 3;
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

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
		`FR-108 ${name}: ${timings.map((t) => t.toFixed(0)).join(', ')} ms (median ${median(timings).toFixed(0)}, budget ${(budget * factor).toFixed(0)}, machine factor ${factor.toFixed(2)})`,
	);
	expect(median(timings)).toBeLessThan(budget * factor);
}

const collection = (name: string, meta: Record<string, unknown> | null, table = true) =>
	({ collection: name, schema: table ? { name } : null, meta: meta && { collection: name, ...meta } }) as never;

/** Mounts `component` with the app plugins and times it to a settled frame; returns the time and the mounted page. */
async function timeMount(
	component: object,
	setup: () => void,
	options: { props?: Record<string, unknown>; path?: string; routes?: RouteRecordRaw[] } = {},
) {
	const start = performance.now();
	const mounted = await mountLayout(component, { ...options, beforeMount: setup });
	await frame();
	await frame();
	return { time: performance.now() - start, ...mounted };
}

type Run = { time: number; check: () => void; wrapper: { unmount: () => void } };

async function measure(name: string, budget: number, run: () => Promise<Run>) {
	(await run()).wrapper.unmount(); // warm-up: the lazy chunks load on the first mount
	const timings: number[] = [];

	for (let index = 0; index < RUNS; index++) {
		const { time, check, wrapper } = await run();
		check();
		timings.push(time);
		wrapper.unmount();
	}

	report(name, timings, budget);
}

const shell = { render: () => h(RouterView) };
const routes: RouteRecordRaw[] = [
	{ path: '/settings', component: shell, children: settings.routes as RouteRecordRaw[] },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

function hydrateShell() {
	useUserStore().currentUser = { id: 'u1', admin_access: true, app_access: true, role: null } as never;
	useSettingsStore().settings = { id: 1, module_bar: null } as never;
	useServerStore().info.queryLimit = { default: 100, max: -1 };
}

test('the collection tree: 300 collections in 30 open folders under 500 ms', async () => {
	const rows = Array.from({ length: 30 }, (_, f) => [
		collection(`folder_${f}`, { group: null, collapse: 'open', sort: f }, false),
		...Array.from({ length: 9 }, (_, c) => collection(`perf_${f}_${c}`, { group: `folder_${f}`, sort: c })),
	]).flat();
	expect(rows).toHaveLength(300);

	await measure('collection tree 300', 500, async () => {
		mockApi({ 'GET /collections': rows });
		const { time, wrapper } = await timeMount(
			CollectionsRoute,
			() => {
				hydrateShell();
				const store = useCollectionsStore();
				store.collections = rows.map((row) => store.prepareCollectionForApp(row));
			},
			{ path: '/settings/data-model', routes },
		);
		return {
			time,
			wrapper,
			check: () => expect(document.querySelectorAll('li[data-row-key^="perf_"]').length).toBe(270),
		};
	});
});

test('the field grid: 200 fields in 10 groups under 500 ms', async () => {
	const fields = [
		{ collection: 'bo_perf', field: 'id', type: 'integer', schema: { is_primary_key: true }, meta: { sort: 0 } },
		...Array.from({ length: 10 }, (_, g) => [
			{
				collection: 'bo_perf',
				field: `group_${g}`,
				type: 'alias',
				schema: null,
				meta: { sort: g + 1, special: ['alias', 'no-data', 'group'], interface: 'group-detail', group: null },
			},
			...Array.from({ length: 19 }, (_, f) => ({
				collection: 'bo_perf',
				field: `field_${g}_${f}`,
				type: 'string',
				schema: {},
				meta: { sort: f, interface: 'input', group: `group_${g}`, width: f % 2 ? 'half' : 'full' },
			})),
		]).flat(),
	].map((field) => ({
		name: field.field,
		...field,
		meta: { collection: 'bo_perf', field: field.field, ...field.meta },
	}));
	expect(fields).toHaveLength(201);

	await measure('field grid 200', 500, async () => {
		// fields-management hydrates the fields store on mount, as Directus: the same 200 fields.
		mockApi({ 'GET /fields': fields });
		const { time, wrapper } = await timeMount(
			FieldsManagement,
			() => {
				hydrateShell();
				const store = useCollectionsStore();
				store.collections = [store.prepareCollectionForApp(collection('bo_perf', {}))];
				useFieldsStore().fields = fields as never;
			},
			{ props: { collection: 'bo_perf' }, path: '/settings/data-model/bo_perf', routes },
		);
		return {
			time,
			wrapper,
			check: () => expect(document.querySelectorAll('li[data-row-key^="field_"]').length).toBe(190),
		};
	});
});

function matrixSetup(count: number) {
	const names = Array.from({ length: count }, (_, c) => `perf_${String(c).padStart(3, '0')}`);
	const permissions = names.flatMap((name, c) =>
		['create', 'read', 'update', 'delete', 'share'].map((action, a) => ({
			id: c * 5 + a + 1,
			policy: 'p1',
			collection: name,
			action,
			fields: ['*'],
			permissions: a === 1 ? { status: { _eq: 'published' } } : null,
			validation: null,
			presets: null,
		})),
	);

	return {
		names,
		permissions,
		setup() {
			hydrateShell();
			const store = useCollectionsStore();
			store.collections = [...names, 'directus_policies', 'directus_permissions'].map((name) =>
				store.prepareCollectionForApp(collection(name, {})),
			);
			useFieldsStore().fields = [
				{ collection: 'directus_policies', field: 'id', type: 'uuid', schema: { is_primary_key: true }, meta: null },
				{
					collection: 'directus_policies',
					field: 'permissions',
					type: 'alias',
					schema: null,
					meta: { special: ['o2m'], interface: 'system-permissions' },
				},
				{
					collection: 'directus_permissions',
					field: 'id',
					type: 'integer',
					schema: { is_primary_key: true },
					meta: null,
				},
				{ collection: 'directus_permissions', field: 'policy', type: 'uuid', schema: {}, meta: null },
			] as never;
			useRelationsStore().relations = [
				{
					collection: 'directus_permissions',
					field: 'policy',
					related_collection: 'directus_policies',
					schema: null,
					meta: { one_field: 'permissions', junction_field: null, many_field: 'policy', sort_field: null },
				},
			] as never;
		},
	};
}

test.each([
	[60, 500],
	[300, 1000],
])('the permissions matrix: %i collections × 5 actions under %i ms', async (count, budget) => {
	const { names, permissions, setup } = matrixSetup(count);

	await measure(`matrix ${count} × 5`, budget, async () => {
		mockApi({ 'GET /permissions': permissions, 'GET /policies/p1': { id: 'p1', name: 'Perf', app_access: false } });
		const { time, wrapper } = await timeMount(SystemPermissions, setup, {
			props: {
				primaryKey: 'p1',
				value: permissions.map((p) => p.id),
				collection: 'directus_policies',
				field: 'permissions',
			},
		});
		return {
			time,
			wrapper,
			check: () =>
				expect(document.querySelectorAll('[data-permissions-matrix] tr[data-collection]').length).toBe(names.length),
		};
	});
});

const PERF_FIELDS = [
	{
		collection: 'bo_perf',
		field: 'id',
		name: 'ID',
		type: 'integer',
		schema: { is_primary_key: true },
		meta: { id: 1, interface: 'input', hidden: true },
	},
	{
		collection: 'bo_perf',
		field: 'title',
		name: 'Title',
		type: 'string',
		schema: { is_primary_key: false },
		meta: { id: 2, interface: 'input' },
	},
];

function dataModelSetup() {
	hydrateShell();
	const store = useCollectionsStore();
	store.collections = [store.prepareCollectionForApp(collection('bo_perf', {}))];
	useFieldsStore().fields = PERF_FIELDS as never;
}

test('an existing field opens in the field drawer under 300 ms; the only request is GET /fields/:c/:f', async () => {
	await measure('field drawer (existing field)', 300, async () => {
		const fetch = mockApi({
			'GET /fields/bo_perf/title': PERF_FIELDS[1],
			'GET /fields': PERF_FIELDS,
			'GET /collections/bo_perf': { collection: 'bo_perf', meta: {}, schema: { name: 'bo_perf' } },
		});
		const { time, wrapper } = await timeMount(shell, dataModelSetup, {
			path: '/settings/data-model/bo_perf/title',
			routes,
		});
		return {
			time,
			wrapper,
			check: () => {
				expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Schema');
				expect(calls(fetch).filter((call) => call.startsWith('GET /fields/'))).toEqual(['GET /fields/bo_perf/title']);
			},
		};
	});
});

test('requests: the collection page and the policy page', async () => {
	const collectionFetch = mockApi({
		'GET /fields': PERF_FIELDS,
		'GET /collections/bo_perf': { collection: 'bo_perf', meta: {}, schema: { name: 'bo_perf' } },
	});
	const page = await mountLayout(shell, { path: '/settings/data-model/bo_perf', routes, beforeMount: dataModelSetup });
	await flushPromises();
	// Two GET /fields as Directus: the route guard and fields-management.vue onBeforeMount both hydrate the store.
	expect(
		calls(collectionFetch)
			.map((call) => call.split('?')[0])
			.sort(),
	).toEqual(['GET /collections/bo_perf', 'GET /fields', 'GET /fields']);
	page.wrapper.unmount();

	const { permissions, setup } = matrixSetup(5);
	const policyFetch = mockApi({
		'GET /policies/p1': { id: 'p1', name: 'Perf', app_access: false, admin_access: false, users: [], roles: [] },
		'GET /permissions': permissions,
	});
	await mountLayout(shell, { path: '/settings/policies/p1', routes, beforeMount: setup });
	// The matrix is an async interface component: let it load and fetch.
	await vi.waitFor(() => expect(calls(policyFetch).some((call) => call.startsWith('GET /permissions'))).toBe(true), {
		timeout: 5000,
	});
	await flushPromises();
	const policyCalls = calls(policyFetch).map((call) => call.split('?')[0]);
	expect(policyCalls.filter((call) => call === 'GET /policies/p1').length).toBeGreaterThanOrEqual(1);
	expect(policyCalls.filter((call) => call === 'GET /permissions')).toHaveLength(1);
});
