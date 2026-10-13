// Feature 009 (T036; spec FR-001 to FR-004, US5 ca 1, 3, 4, R-22; contracts/flows-api.md §1, §2): /flows and
// /operations CRUD at both apps, including the nested writes of the flow editor of the Directus app (flow.vue
// saveChanges). Writes run as scenarios (Directus, then Backoffice) on flows of their own; reads go to both at once.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { admin, call, snap } from '../files/helpers.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { cleanupFlows, same, seedFlow } from './helpers.js';

const seeded: string[] = [];
let reader: TestUser;
let noDelete: TestUser;
let readable: string;

const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

beforeAll(async () => {
	const seededFlow = await seedFlow({
		name: 'parity-crud-readable',
		trigger: 'manual',
		options: { collections: ['directus_users'] },
		operations: [
			{ key: 'first', type: 'transform', options: { json: { a: 1 } }, resolve: 'second' },
			{ key: 'second', type: 'log', options: { message: 'x' } },
		],
	});

	readable = seededFlow.id;
	seeded.push(readable);

	reader = await createUser('directus', 'flows-crud-reader');
	await attachPolicy(
		'directus',
		await createPolicy('directus', 'flows-crud-reader', {
			permissions: [
				{ collection: 'directus_flows', action: 'read', fields: ['*'] },
				{ collection: 'directus_operations', action: 'read', fields: ['*'] },
			],
		}),
		{ user: reader.id },
	);

	noDelete = await createUser('directus', 'flows-crud-no-delete');
	await attachPolicy(
		'directus',
		await createPolicy('directus', 'flows-crud-no-delete', {
			permissions: [
				{ collection: 'directus_flows', action: 'read', fields: ['*'] },
				{ collection: 'directus_operations', action: 'read', fields: ['*'] },
				{ collection: 'directus_flows', action: 'update', fields: ['*'] },
			],
		}),
		{ user: noDelete.id },
	);
}, 120_000);

afterAll(async () => {
	await cleanupFlows(seeded);
	await cleanup();
});

describe('reads', () => {
	test.each([
		['the store of the Directus app', '/flows?fields[]=*&fields[]=operations.*&limit=-1'],
		['one flow with nested operations', ''],
		['operations of a flow with their flow', ''],
		['meta and a filter', '/flows?filter[trigger][_eq]=manual&meta=*&limit=1'],
	])('GET %s', async (label, path) => {
		const resolved =
			label === 'one flow with nested operations'
				? `/flows/${readable}?fields=*,operations.key,operations.resolve.key`
				: label === 'operations of a flow with their flow'
					? `/operations?filter[flow][_eq]=${readable}&fields=key,flow.name&sort=key`
					: path;

		const result = await same({ path: resolved, headers: await admin() });
		expect(result.directus.status).toBe(200);
	});

	test('SEARCH with a query, OPTIONS, HEAD', async () => {
		await same({
			method: 'SEARCH',
			path: '/flows',
			headers: await admin(),
			body: { query: { filter: { id: { _eq: readable } } } },
		});
		await same({ method: 'OPTIONS', path: `/operations/${readable}` });
		await same({ method: 'HEAD', path: '/flows', headers: await admin() });
	});

	test('the public and a user without permissions get 403; a reader reads', async () => {
		expect((await same({ path: '/flows' })).directus.status).toBe(403);
		expect((await same({ path: `/flows/${readable}`, headers: bearer(reader) })).directus.status).toBe(200);
		expect(
			(await same({ path: `/operations?filter[flow][_eq]=${readable}`, headers: bearer(reader) })).directus.status,
		).toBe(200);
		expect(
			(await same({ method: 'POST', path: '/flows', headers: bearer(reader), body: { name: 'x' } })).directus.status,
		).toBe(403);
	});
});

describe('writes', () => {
	test('POST one and an array, PATCH by keys, DELETE by keys', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const one = await call(ctx, {
				method: 'POST',
				path: '/flows?fields=id,name,status,trigger',
				headers,
				body: { name: `one ${ctx.app}`, trigger: 'manual' },
			});
			const id = (one.json as any).data.id as string;

			const many = await call(ctx, {
				method: 'POST',
				path: '/flows?fields=id,name',
				headers,
				body: [
					{ name: 'two', trigger: 'webhook' },
					{ name: 'three', trigger: 'webhook' },
				],
			});

			// The rows come back in the order of their random uuids at both apps: compared by name.
			((many.json as any).data as { name: string }[]).sort((x, y) => x.name.localeCompare(y.name));
			const ids = ((many.json as any).data as { id: string }[]).map((f) => f.id);
			const patched = await call(ctx, {
				method: 'PATCH',
				path: '/flows?fields=id,status',
				headers,
				body: { keys: ids, data: { status: 'inactive' } },
			});
			((patched.json as any).data as { id: string }[]).sort((x, y) => ids.indexOf(x.id) - ids.indexOf(y.id));
			const deleted = await call(ctx, { method: 'DELETE', path: '/flows', headers, body: [id, ...ids] });

			const aliases = { one: id, two: ids[0]!, three: ids[1]!, app: ctx.app };
			return {
				one: snap(one, '/flows', aliases),
				many: snap(many, '/flows', aliases),
				patched: snap(patched, '/flows', aliases),
				deleted: deleted.status,
			};
		});

		assertSameTranscripts(transcripts, 'flows writes');
		expect(transcripts.directus.deleted).toBe(204);
	});

	test('the flow editor: PATCH /operations to unlink, then PATCH /flows/:pk with nested operations', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const { id, ids } = await seedFlow(
				{
					trigger: 'webhook',
					operations: [
						{ key: 'a', type: 'transform', options: { json: { v: 1 } }, resolve: 'b' },
						{ key: 'b', type: 'log', options: { message: 'b' } },
					],
				},
				ctx.app,
			);
			seeded.push(id);

			// flow.vue: unlink the resolve of `a` first, then create `c` after `a`, update `a`, delete `b`.
			const unlink = await call(ctx, {
				method: 'PATCH',
				path: '/operations',
				headers,
				body: [{ id: ids['a'], resolve: null }],
			});

			const save = await call(ctx, {
				method: 'PATCH',
				path: `/flows/${id}?fields=id,operation,operations.key,operations.resolve`,
				headers,
				body: {
					operations: {
						create: [
							{ key: 'c', name: 'c', type: 'log', options: { message: 'c' }, position_x: 1, position_y: 1, flow: id },
						],
						update: [{ id: ids['a'], options: { json: { v: 2 } } }],
						delete: [ids['b']],
					},
				},
			});

			const operations = await appRequest(
				'directus',
				'GET',
				`/operations?filter[flow][_eq]=${id}&fields=key,options&sort=key`,
			);
			const aliases = { flow: id, a: ids['a']!, b: ids['b']! };

			return {
				unlink: snap(unlink, '/operations', aliases),
				save: {
					status: save.status,
					keys: ((save.json as any).data.operations as { key: string }[]).map((o) => o.key).sort(),
				},
				operations: operations.data,
			};
		});

		assertSameTranscripts(transcripts, 'flow editor');
		expect(transcripts.directus.operations).toEqual([
			{ key: 'a', options: { json: { v: 2 } } },
			{ key: 'c', options: { message: 'c' } },
		]);
	});

	test('POST /operations (copy of a panel) and DELETE /operations/:pk', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const { id } = await seedFlow({ trigger: 'webhook' }, ctx.app);
			seeded.push(id);
			const opId = randomUUID();

			const created = await call(ctx, {
				method: 'POST',
				path: '/operations?fields=id,key,type,flow',
				headers,
				body: { id: opId, key: 'copy', name: 'copy', type: 'log', options: {}, position_x: 3, position_y: 3, flow: id },
			});

			const deleted = await call(ctx, { method: 'DELETE', path: `/operations/${opId}`, headers });
			return { created: snap(created, '/operations', { op: opId, flow: id }), deleted: deleted.status };
		});

		assertSameTranscripts(transcripts, 'operations writes');
	});

	test('DELETE /flows/:pk deletes its operations (cascade)', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const { id } = await seedFlow(
				{
					trigger: 'webhook',
					operations: [
						{ key: 'a', type: 'log', options: { message: 'a' }, resolve: 'b' },
						{ key: 'b', type: 'log', options: { message: 'b' } },
					],
				},
				ctx.app,
			);

			const deleted = await call(ctx, { method: 'DELETE', path: `/flows/${id}`, headers: await admin() });
			const left = await appRequest('directus', 'GET', `/operations?filter[flow][_eq]=${id}&aggregate[count]=*`);
			return { deleted: deleted.status, left: left.data };
		});

		assertSameTranscripts(transcripts, 'flow delete');
		expect(Number((transcripts.directus.left as { count: number | string }[])[0]!.count)).toBe(0);
	});

	test('R-22: without delete permission the request is 403, but the operations of the flow are already unlinked', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const { id, ids } = await seedFlow(
				{
					trigger: 'webhook',
					operations: [
						{ key: 'a', type: 'log', options: { message: 'a' }, resolve: 'b' },
						{ key: 'b', type: 'log', options: { message: 'b' } },
					],
				},
				ctx.app,
			);
			seeded.push(id);

			const deleted = await call(ctx, { method: 'DELETE', path: `/flows/${id}`, headers: bearer(noDelete) });
			const a = await appRequest('directus', 'GET', `/operations/${ids['a']}?fields=resolve`);
			return { status: deleted.status, resolveOfA: a.data.resolve };
		});

		assertSameTranscripts(transcripts, 'R-22');
		expect(transcripts.directus).toEqual({ status: 403, resolveOfA: null });
	});
});
