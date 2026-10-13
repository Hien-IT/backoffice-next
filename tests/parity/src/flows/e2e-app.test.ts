// Feature 009 (T044; spec FR-063, contracts/parity.md §5): the requests the Directus app sends for the Flows screens, in
// the order it sends them, compared at both apps (the Playwright file flows.spec.ts drives the screens themselves):
// stores/flows.ts hydrate, flow-drawer.vue save, flow.vue saveChanges, use-flows.ts run, logs-sidebar-detail.vue
// (use-revisions.ts with action run), overview.vue toggle and delete. Writes run as a scenario on a flow of each app.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { admin, call, snap } from '../files/helpers.js';
import { cleanup, createUserCollection, uniqueName } from '../permissions/fixtures.js';
import { cleanupFlows, RELOAD_WAIT, same, sleep } from './helpers.js';

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const HYDRATE = '/flows?fields[]=*&fields[]=operations.*&limit=-1';
const created: Record<string, string> = {};
const opAliases: Record<string, Record<string, string>> = {};
let posts: string;
let keys: number[];

beforeAll(async () => {
	posts = await createUserCollection(uniqueName('flows_e2e_posts').replace(/-/g, '_'), [
		{ field: 'title', type: 'string' },
	]);
	keys = [];
	for (const title of ['one', 'two'])
		keys.push((await appRequest('directus', 'POST', `/items/${posts}`, { title })).data.id);
}, 120_000);

afterAll(async () => {
	await cleanupFlows(Object.values(created));
	await cleanup();
});

/** The operation keys of a flow come back in the order of their random uuids at both apps: sorted once aliased. */
const sortedOperations = <T>(snapshot: T): T => {
	const data = (snapshot as any)?.body?.data;
	if (Array.isArray(data?.operations)) data.operations.sort();
	return snapshot;
};

/** The panel the operation drawer stages (flow.vue stageOperation), as saveChanges sends it. */
const panel = (key: string, type: string, options: Record<string, unknown>, flow: string, x: number) => ({
	name: key,
	key,
	type,
	position_x: x,
	position_y: 1,
	options,
	flow,
});

describe('the Flows module of the Directus app', () => {
	test('hydrate, create, save the editor twice, run from an item and a selection, toggle, delete', async () => {
		await same({ path: HYDRATE, headers: await admin() });

		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();

			// flow-drawer.vue save(): POST /flows?fields=id, then the store hydrates.
			const create = await call(ctx, {
				method: 'POST',
				path: '/flows?fields[]=id',
				headers,
				body: {
					name: 'e2e flows module',
					icon: 'bolt',
					color: null,
					description: null,
					status: 'active',
					accountability: 'all',
					trigger: 'manual',
					options: { collections: [posts], location: 'both', requireConfirmation: false, async: false },
				},
			});
			const id = (create.json as any).data.id as string;
			created[ctx.app] = id;

			// flow.vue saveChanges(): the trigger tree as `operation`, nothing in create, update or delete.
			const first = await call(ctx, {
				method: 'PATCH',
				path: `/flows/${id}`,
				headers,
				body: {
					operations: { create: [], update: [], delete: [] },
					operation: panel('shape', 'transform', { json: { keys: '{{ $trigger.body.keys }}' } }, id, 19),
				},
			});
			const shape = (
				await appRequest('directus', 'GET', `/operations?filter[flow][_eq]=${id}&filter[key][_eq]=shape&fields=id`)
			).data[0].id as string;

			// A log panel attached after `shape`: no link to reset; the trigger tree nests it under `shape` (update stays empty).
			const second = await call(ctx, {
				method: 'PATCH',
				path: `/flows/${id}`,
				headers,
				body: {
					operations: { create: [], update: [], delete: [] },
					operation: { id: shape, flow: id, resolve: panel('note', 'log', { message: 'ran' }, id, 37) },
				},
			});
			await sleep(RELOAD_WAIT);

			// use-flows.ts runManualFlow(): from an item (keys: [pk]) and from a selection.
			const fromItem = await call(ctx, {
				method: 'POST',
				path: `/flows/trigger/${id}`,
				headers,
				body: { collection: posts, keys: [keys[0]] },
			});
			const fromSelection = await call(ctx, {
				method: 'POST',
				path: `/flows/trigger/${id}`,
				headers,
				body: { collection: posts, keys },
			});

			const operations = await appRequest(
				'directus',
				'GET',
				`/operations?filter[flow][_eq]=${id}&fields=key,type,resolve.key,reject&sort=key`,
			);
			const note = (
				await appRequest('directus', 'GET', `/operations?filter[flow][_eq]=${id}&filter[key][_eq]=note&fields=id`)
			).data[0].id as string;
			const aliases = { flow: id, shape, note };
			opAliases[ctx.app] = aliases;

			return {
				create: create.status,
				first: sortedOperations(snap(first, '/flows', aliases)),
				second: sortedOperations(snap(second, '/flows', aliases)),
				fromItem: snap(fromItem, '/flows/trigger', aliases),
				fromSelection: snap(fromSelection, '/flows/trigger', aliases),
				operations: operations.data,
			};
		});

		assertSameTranscripts(transcripts, 'flows module');
		expect(transcripts.directus.create).toBe(200);
		expect([(transcripts.directus.fromItem as any).status, (transcripts.directus.fromSelection as any).status]).toEqual(
			[204, 204],
		);
		expect(transcripts.directus.operations).toEqual([
			{ key: 'note', type: 'log', resolve: null, reject: null },
			{ key: 'shape', type: 'transform', resolve: { key: 'note' }, reject: null },
		]);

		await same({ path: HYDRATE, headers: await admin() });
	});

	test('logs-sidebar-detail.vue: count, page and created of use-revisions.ts with action run', async () => {
		const headers = await admin();
		const id = created['directus']!;
		const filter = {
			_and: [
				{ collection: { _eq: 'directus_flows' } },
				{ item: { _eq: id } },
				{ version: { _null: true } },
				{ activity: { action: { _eq: 'run' } } },
			],
		};
		const fields = [
			'id',
			'collection',
			'item',
			'activity.action',
			'activity.timestamp',
			'activity.user.id',
			'activity.user.email',
			'activity.user.first_name',
			'activity.user.last_name',
			'activity.ip',
			'activity.user_agent',
			'activity.origin',
			'data',
			'delta',
		];

		const count = await same({ path: `/revisions?filter=${json(filter)}&aggregate[count]=id`, headers });
		expect(Number((count.directus.json as any).data[0].count.id)).toBe(2);
		await same({
			path: `/revisions?filter=${json(filter)}&sort=-id&limit=10&page=1&fields=${fields.join(',')}`,
			headers,
		});
		await same({
			path: `/revisions?filter=${json({ collection: { _eq: 'directus_flows' }, item: { _eq: id }, version: { _null: true }, activity: { action: { _eq: 'create' } } })}&sort=-id&limit=1&fields=id`,
			headers,
		});
	});

	test('overview.vue: toggle the status, then delete', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const id = created[ctx.app]!;
			const toggle = await call(ctx, { method: 'PATCH', path: `/flows/${id}`, headers, body: { status: 'inactive' } });
			const deleted = await call(ctx, { method: 'DELETE', path: `/flows/${id}`, headers });
			delete created[ctx.app];
			return { toggle: sortedOperations(snap(toggle, '/flows', opAliases[ctx.app])), deleted: deleted.status };
		});

		assertSameTranscripts(transcripts, 'overview');
		expect(transcripts.directus.deleted).toBe(204);
		await same({ path: HYDRATE, headers: await admin() });
	});
});
