// Store of the Insights module (spec 018 FR-006, FR-028, FR-041, FR-053..FR-056, R-55, R-56): hydrate, the merged
// GraphQL document, partial errors and the 400 retry, variables, staging and Save.
import type { Panel } from '@directus/types';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetNotices, useNotices } from '../composables/use-notices.ts';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import { useCollectionsStore } from './collections.ts';
import { useFieldsStore } from './fields.ts';
import { useInsightsStore } from './insights.ts';
import { usePermissionsStore } from './permissions.ts';

const DASHBOARD = 'd1';

const panel = (id: string, type: string, options: Record<string, unknown>, extra: Partial<Panel> = {}): Panel =>
	({
		id,
		dashboard: DASHBOARD,
		type,
		options,
		position_x: 1,
		position_y: 1,
		width: 6,
		height: 6,
		show_header: true,
		name: id,
		icon: null,
		color: null,
		note: null,
		...extra,
	}) as unknown as Panel;

const metric = (id: string, filter?: unknown) =>
	panel(id, 'metric', { collection: 'bo_insights_data', field: 'id', function: 'count', filter });

/** Body (`query`) of every POST to a GraphQL endpoint. */
function graphqlBodies(fetch: ReturnType<typeof mockApi>, endpoint = '/graphql'): string[] {
	return fetch.mock.calls
		.filter(([input, init]) => init?.method === 'POST' && new URL(String(input)).pathname === endpoint)
		.map(([, init]) => JSON.parse(String(init!.body)).query);
}

/** Answers a GraphQL POST with `count: { id: 1 }` for every alias in the document. */
function graphqlAnswer(extra: Record<string, unknown> = {}) {
	return ({ init }: { init: RequestInit }) => {
		const query: string = JSON.parse(String(init.body)).query;
		const aliases = [...query.matchAll(/(query_[0-9a-f]+):/g)].map((match) => match[1]!);
		return json({ data: Object.fromEntries(aliases.map((alias) => [alias, [{ count: { id: 1 } }]])), ...extra });
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
	resetNotices();
	vi.spyOn(usePermissionsStore(), 'hasPermission').mockReturnValue(true);
	useCollectionsStore().collections = [
		{ collection: 'bo_insights_data', meta: { singleton: false } },
		{ collection: 'directus_users', meta: { singleton: false } },
	] as never;
	useFieldsStore().fields = ['bo_insights_data', 'directus_users'].map((collection) => ({
		collection,
		field: 'id',
		schema: { is_primary_key: true },
	})) as never;
});

// Staging a create or a duplicate loads its data without awaiting it (as Directus); let that request settle on this
// test's fetch mock, or its error dialog lands in the next test.
afterEach(async () => {
	await vi.waitFor(() => expect(useInsightsStore().loading).toEqual([]));
	await flushPromises();
	vi.unstubAllGlobals();
});

describe('hydrate', () => {
	test('loads dashboards sorted by name and panels sorted by dashboard; variable defaults', async () => {
		const fetch = mockApi({
			'GET /dashboards': [{ id: DASHBOARD, name: 'A' }],
			'GET /panels': [panel('v1', 'variable', { field: 'status', defaultValue: 'published' })],
		});
		const store = useInsightsStore();

		await store.hydrate();

		expect(calls(fetch)).toEqual([
			'GET /dashboards?fields=*&sort=name&limit=-1',
			'GET /panels?fields=*&sort=dashboard&limit=-1',
		]);
		expect(store.dashboards).toHaveLength(1);
		expect(store.getVariable('status')).toBe('published');
	});

	test('without read permission on both collections nothing is requested', async () => {
		vi.mocked(usePermissionsStore().hasPermission).mockImplementation((collection) => collection !== 'directus_panels');
		const fetch = mockApi({});

		await useInsightsStore().hydrate();

		expect(fetch).not.toHaveBeenCalled();
	});

	test('a failed request leaves both lists empty', async () => {
		mockApi({ 'GET /dashboards': () => json({ errors: [{ message: 'x' }] }, 500), 'GET /panels': [] });
		const store = useInsightsStore();

		await store.hydrate();

		expect(store.dashboards).toEqual([]);
		expect(store.panels).toEqual([]);
	});

	test('two dashboards with the same variable field share one value; the later panel default wins (R-55)', async () => {
		mockApi({
			'GET /dashboards': [],
			'GET /panels': [
				panel('v1', 'variable', { field: 'status', defaultValue: 'a' }),
				panel('v2', 'variable', { field: 'status', defaultValue: 'b' }, { dashboard: 'd2' }),
			],
		});
		const store = useInsightsStore();

		await store.hydrate();

		expect(store.variables).toEqual({ status: 'b' });
	});
});

describe('panel data', () => {
	async function setup(panels: Panel[], answers: Record<string, unknown> = {}) {
		const fetch = mockApi({ 'GET /dashboards': [{ id: DASHBOARD }], 'GET /panels': panels, ...answers });
		const store = useInsightsStore();
		await store.hydrate();
		return { fetch, store };
	}

	test('one merged document per endpoint: user collections to /graphql, system ones to /graphql/system', async () => {
		const users = panel('u', 'metric', { collection: 'directus_users', field: 'id', function: 'count' });
		const { fetch, store } = await setup([metric('m1'), metric('m2'), users], {
			'POST /graphql': graphqlAnswer(),
			'POST /graphql/system': graphqlAnswer(),
		});

		await store.refresh(DASHBOARD);

		const [document] = graphqlBodies(fetch);
		expect(graphqlBodies(fetch)).toHaveLength(1);
		expect(document!.match(/query_[0-9a-f]+: bo_insights_data_aggregated/g)).toHaveLength(2);
		expect(graphqlBodies(fetch, '/graphql/system')[0]).toMatch(/query_[0-9a-f]+: users_aggregated/);
		expect(store.data['m1']).toEqual([{ count: { id: 1 } }]);
		expect(store.data['u']).toEqual([{ count: { id: 1 } }]);
		expect(store.loading).toEqual([]);
	});

	// The failing alias has no data key (a key with data, even null, counts as succeeded and clears the error, as Directus).
	test('a panel on a collection the viewer cannot read gets its own FORBIDDEN error; the others load (D-111)', async () => {
		const hidden = panel('h', 'metric', { collection: 'bo_secret', field: 'id', function: 'count' });
		const { fetch, store } = await setup([metric('m1'), hidden], { 'POST /graphql': graphqlAnswer() });

		await store.refresh(DASHBOARD);

		expect(graphqlBodies(fetch)).toHaveLength(1);
		expect(graphqlBodies(fetch)[0]!.match(/query_/g)).toHaveLength(1);
		expect(store.data['m1']).toEqual([{ count: { id: 1 } }]);
		expect(store.errors['h']).toMatchObject({ errors: [{ extensions: { code: 'FORBIDDEN' } }] });
		expect(store.loading).toEqual([]);
	});

	test('a partial GraphQL error is stored for its panel only', async () => {
		const { store } = await setup([metric('m1'), metric('m2')], {
			'POST /graphql': ({ init }: { init: RequestInit }) => {
				const query: string = JSON.parse(String(init.body)).query;
				const [failing, other] = [...query.matchAll(/(query_[0-9a-f]+):/g)].map((match) => match[1]!);
				return json({
					data: { [other!]: [{ count: { id: 1 } }] },
					errors: [{ extensions: { graphqlErrors: [{ path: [failing] }] } }],
				});
			},
		});

		await store.refresh(DASHBOARD);

		expect(Object.keys(store.errors)).toEqual(['m1']);
	});

	test('a 400 answer retries without the failing panels', async () => {
		let attempt = 0;
		const { fetch, store } = await setup([metric('m1'), metric('m2')], {
			'POST /graphql': ({ init }: { init: RequestInit }) => {
				attempt++;
				const query: string = JSON.parse(String(init.body)).query;
				const first = query.match(/(query_[0-9a-f]+):/)![1]!;
				if (attempt === 1) return json({ errors: [{ extensions: { graphqlErrors: [{ path: [first] }] } }] }, 400);
				return graphqlAnswer()({ init });
			},
		});

		await store.refresh(DASHBOARD);

		expect(graphqlBodies(fetch)).toHaveLength(2);
		expect(graphqlBodies(fetch)[1]!.match(/query_/g)).toHaveLength(1);
		expect(Object.keys(store.errors)).toEqual(['m1']);
		expect(store.data['m2']).toBeDefined();
	});

	test('a failed request opens the error dialog', async () => {
		const { store } = await setup([metric('m1')], { 'POST /graphql': () => json({ errors: [] }, 500) });

		await store.refresh(DASHBOARD);

		expect(useNotices().dialogs.value).toHaveLength(1);
	});

	test('setVariable reloads only the panels whose query uses the variable (FR-054)', async () => {
		const filtered = metric('m1', { status: { _eq: '{{ status }}' } });
		const { fetch, store } = await setup([filtered, metric('m2')], { 'POST /graphql': graphqlAnswer() });
		await store.refresh(DASHBOARD);
		fetch.mockClear();

		store.setVariable('status', 'draft');
		await vi.waitFor(() => expect(graphqlBodies(fetch)).toHaveLength(1));

		expect(graphqlBodies(fetch)[0]!.match(/query_/g)).toHaveLength(1);
		expect(graphqlBodies(fetch)[0]).toContain('draft');

		fetch.mockClear();
		store.setVariable('unused', 1);
		await Promise.resolve();
		expect(fetch).not.toHaveBeenCalled();
	});

	test('an empty relational variable gives its panels {} without a request (FR-056)', async () => {
		const relational = panel('r', 'relational-variable', { field: 'author', collection: 'directus_users' });
		const byAuthor = metric('m1', { owner: { _in: '{{ author }}' } });
		const { fetch, store } = await setup([relational, byAuthor], { 'POST /graphql': graphqlAnswer() });

		await store.refresh(DASHBOARD);

		expect(store.data['m1']).toEqual({});
		expect(graphqlBodies(fetch)).toHaveLength(0);
	});

	test('keeps the data of the last 3 dashboards only', async () => {
		const panels = ['a', 'b', 'c', 'd'].map((dashboard) => metric(`m-${dashboard}`, undefined));
		panels.forEach((item, index) => (item.dashboard = ['a', 'b', 'c', 'd'][index]!));
		const { store } = await setup(panels, { 'POST /graphql': graphqlAnswer() });

		for (const dashboard of ['a', 'b', 'c', 'd']) await store.refresh(dashboard);

		expect(Object.keys(store.data).sort()).toEqual(['m-b', 'm-c', 'm-d']);
	});
});

describe('staging and Save (FR-028, R-56)', () => {
	async function setup(answers: Record<string, unknown> = {}) {
		const fetch = mockApi({
			'GET /dashboards': [{ id: DASHBOARD }],
			'GET /panels': [metric('m1'), metric('m2')],
			'POST /graphql': graphqlAnswer(),
			'POST /panels': [],
			'PATCH /panels': [],
			'DELETE /panels': () => new Response(null, { status: 204 }),
			...answers,
		});
		const store = useInsightsStore();
		await store.hydrate();
		fetch.mockClear();
		return { fetch, store };
	}

	const writes = (fetch: ReturnType<typeof mockApi>) =>
		fetch.mock.calls
			.filter(([, init]) => ['POST', 'PATCH', 'DELETE'].includes(init?.method ?? 'GET'))
			.filter(([input]) => new URL(String(input)).pathname === '/panels')
			.map(([, init]) => ({ method: init!.method, body: JSON.parse(String(init!.body)) }));

	test('Save sends create without temporary ids, update and delete, then hydrates and clears the edits', async () => {
		const { fetch, store } = await setup();

		store.stagePanelCreate(metric('_new') as never);
		store.stagePanelUpdate({ id: 'm1', edits: { position_x: 13, width: 8 } });
		store.stagePanelDuplicate('m1');
		store.stagePanelDelete('m2');
		expect(store.hasEdits).toBe(true);

		await store.saveChanges();

		const sent = writes(fetch);
		expect(sent.map(({ method }) => method)).toEqual(['POST', 'PATCH', 'DELETE']);
		expect(sent[0]!.body).toHaveLength(2);
		expect(sent[0]!.body.every((item: Record<string, unknown>) => !('id' in item))).toBe(true);
		expect(sent[0]!.body[1]).toMatchObject({ position_x: 15, position_y: 3, width: 8 });
		expect(sent[1]!.body).toEqual([{ id: 'm1', position_x: 13, width: 8 }]);
		expect(sent[2]!.body).toEqual(['m2']);
		expect(calls(fetch).filter((call) => call.startsWith('GET /panels'))).toHaveLength(1);
		expect(store.hasEdits).toBe(false);
	});

	// Directus clears the edits after loadPanelData, so the temporary created panel loads once more with the real one.
	test('after Save the created panel loads twice, temporary and saved, like Directus', async () => {
		let hydrated = 0;
		const { fetch, store } = await setup({
			'GET /panels': () =>
				json({ data: hydrated++ === 0 ? [metric('m1'), metric('m2')] : [metric('m1'), metric('m2'), metric('m3')] }),
		});

		await store.refresh(DASHBOARD);
		await vi.waitFor(() => expect(Object.keys(store.data)).toEqual(['m1', 'm2']), { timeout: 5000 });
		fetch.mockClear();
		store.stagePanelCreate(metric('_new') as never);
		await vi.waitFor(() => expect(graphqlBodies(fetch)).toHaveLength(1), { timeout: 5000 });
		await store.saveChanges();

		await vi.waitFor(() => expect(graphqlBodies(fetch)).toHaveLength(2), { timeout: 5000 });
		expect(graphqlBodies(fetch)[1]!.match(/query_[0-9a-f]+: bo_insights_data_aggregated/g)).toHaveLength(2);
		expect(store.hasEdits).toBe(false);
	});

	test('Save without edits sends nothing', async () => {
		const { fetch, store } = await setup();

		await store.saveChanges();

		expect(writes(fetch)).toEqual([]);
	});

	test('Copy To is a staged duplicate on the target dashboard', async () => {
		const { fetch, store } = await setup();

		store.stagePanelDuplicate('m1', { dashboard: 'd2' });
		await store.saveChanges();

		expect(writes(fetch)[0]!.body[0]).toMatchObject({ dashboard: 'd2', position_x: 3, position_y: 3 });
	});

	test('a failing request keeps only its own edits; the parts that succeeded are saved and reloaded (D-112)', async () => {
		const { fetch, store } = await setup({ 'PATCH /panels': () => json({ errors: [{ message: 'no' }] }, 403) });

		store.stagePanelCreate(metric('_new') as never);
		store.stagePanelUpdate({ id: 'm1', edits: { width: 9 } });
		await store.saveChanges();

		expect(store.edits.create).toEqual([]);
		expect(store.edits.update).toEqual([{ id: 'm1', width: 9 }]);
		expect(store.hasEdits).toBe(true);
		expect(store.saving).toBe(false);
		expect(calls(fetch).some((call) => call.startsWith('GET /panels'))).toBe(true);
		expect(useNotices().dialogs.value).toHaveLength(1);

		// A second Save sends the update only: the panel created the first time is not created again.
		fetch.mockClear();
		await store.saveChanges();
		expect(writes(fetch).map(({ method }) => method)).toEqual(['PATCH']);
	});

	test('when every request fails nothing is reloaded and all edits stay', async () => {
		const { fetch, store } = await setup({ 'PATCH /panels': () => json({ errors: [{ message: 'no' }] }, 403) });

		store.stagePanelUpdate({ id: 'm1', edits: { width: 9 } });
		await store.saveChanges();

		expect(store.edits.update).toEqual([{ id: 'm1', width: 9 }]);
		expect(calls(fetch).some((call) => call.startsWith('GET /panels'))).toBe(false);
	});

	test('an update for an id that is not in the store is ignored', async () => {
		const { store } = await setup();

		store.stagePanelUpdate({ id: 'missing', edits: { options: {} } });

		expect(store.hasEdits).toBe(false);
	});

	test('deleting a staged panel only drops it from the creates', async () => {
		const { store } = await setup();

		store.stagePanelCreate(metric('_new') as never);
		store.stagePanelDelete('_new');

		expect(store.edits).toEqual({ create: [], update: [], delete: [] });
	});
});
