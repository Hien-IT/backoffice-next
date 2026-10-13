// Feature 009 (T025; spec US3, FR-010, FR-022, FR-023): event flows run at the app that receives the request, with
// the same event names, payload and meta as Directus. Each case runs as a scenario (Directus, then Backoffice) and
// compares what each app did: the response, the rows the flow wrote, and the run log rows of that app only.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, type ScenarioContext, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { call, snap } from '../files/helpers.js';
import { cleanup, createUser, createUserCollection, uniqueName } from '../permissions/fixtures.js';
import { cleanupFlows, runRows, seedFlow, until } from './helpers.js';

const seeded: string[] = [];
const collections: Record<'blocked' | 'changed' | 'rollback' | 'action' | 'log', string> = {} as any;
const flows: Record<string, string> = {};

const admin = async () => ({
	authorization: `Bearer ${await import('../directus-api.js').then((m) => m.adminToken('directus'))}`,
});

async function flow(name: string, def: Parameters<typeof seedFlow>[0]) {
	const { id } = await seedFlow(def);
	seeded.push(id);
	flows[name] = id;
}

const logRows = async (note: string) =>
	(await appRequest('directus', 'GET', `/items/${collections.log}?filter[note][_eq]=${encodeURIComponent(note)}`)).data
		.length as number;

const lastRunId = async (flow: string) => Number((await runRows(flow)).at(-1)?.['id'] ?? 0);

beforeAll(async () => {
	for (const name of ['blocked', 'changed', 'rollback', 'action', 'log'] as const) {
		collections[name] = await createUserCollection(
			uniqueName(`flows_ev_${name}`).replace(/-/g, '_'),
			name === 'log' ? [{ field: 'note', type: 'string' }] : [{ field: 'title', type: 'string' }],
			{ primaryKey: 'uuid' },
		);
	}

	const scope = (event: string, collection: string) => ({ scope: [event], collections: [collection] });

	await flow('blocked', {
		trigger: 'event',
		options: { type: 'filter', ...scope('items.create', collections.blocked) },
		operations: [
			{
				key: 'check',
				type: 'condition',
				options: { filter: { $trigger: { payload: { title: { _neq: 'blocked' } } } } },
				reject: 'stop',
			},
			{ key: 'stop', type: 'throw-error', options: { code: 'BLOCKED', status: '422', message: 'Blocked by a flow' } },
		],
	});

	await flow('changed', {
		trigger: 'event',
		options: { type: 'filter', return: '$last', ...scope('items.update', collections.changed) },
		operations: [
			{ key: 'change', type: 'transform', options: { json: '{"title":"{{ $trigger.payload.title }} (changed)"}' } },
		],
	});

	await flow('rollback', {
		trigger: 'event',
		options: { type: 'filter', ...scope('items.create', collections.rollback) },
		operations: [
			{
				key: 'write',
				type: 'item-create',
				options: {
					collection: collections.log,
					payload: { note: 'rolled back {{ $trigger.payload.title }}' },
					permissions: '$full',
				},
				resolve: 'stop',
			},
			{ key: 'stop', type: 'throw-error', options: { code: 'STOP', status: '400', message: 'stop' } },
		],
	});

	await flow('action', {
		trigger: 'event',
		options: { type: 'action', ...scope('items.create', collections.action) },
		operations: [
			{
				key: 'write',
				type: 'item-create',
				options: {
					collection: collections.log,
					payload: { note: 'action {{ $trigger.event }} {{ $trigger.payload.title }} by {{ $accountability.admin }}' },
					permissions: '$full',
				},
			},
		],
	});

	await flow('actionReject', {
		trigger: 'event',
		options: { type: 'action', ...scope('items.update', collections.action) },
		operations: [
			{ key: 'stop', type: 'throw-error', options: { code: 'IN_ACTION', status: '500', message: 'in action' } },
		],
	});

	await flow('folders', {
		trigger: 'event',
		options: { type: 'action', ...scope('items.create', 'directus_folders') },
		operations: [
			{
				key: 'write',
				type: 'item-create',
				options: {
					collection: collections.log,
					payload: { note: 'folder {{ $trigger.event }} {{ $trigger.payload.name }}' },
					permissions: '$full',
				},
			},
		],
	});

	await flow('login', {
		trigger: 'event',
		options: { type: 'action', scope: ['auth.login'] },
		operations: [
			{
				key: 'write',
				type: 'item-create',
				options: {
					collection: collections.log,
					payload: { note: 'login {{ $trigger.payload.email }} {{ $trigger.status }} {{ $trigger.provider }}' },
					permissions: '$full',
				},
			},
		],
	});
}, 120_000);

afterAll(async () => {
	await cleanupFlows(seeded);
	await cleanup();
});

/** A request of the scenario as the admin, its snapshot without the generated keys. */
async function send(ctx: ScenarioContext, method: string, path: string, body?: Record<string, unknown>) {
	const captured = await call(ctx, { method, path, headers: await admin(), ...(body ? { body } : {}) });
	const key = (captured.json as any)?.data?.id as string | undefined;
	return { snapshot: snap(captured, path, key ? { key } : {}), key };
}

describe('filter flows run inside the request', () => {
	test('a rejected filter fails the request with the error of the flow and writes nothing', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const blocked = await send(ctx, 'POST', `/items/${collections.blocked}`, { title: 'blocked' });
			const allowed = await send(ctx, 'POST', `/items/${collections.blocked}`, { title: `allowed ${ctx.app}` });
			return { blocked: blocked.snapshot, allowedStatus: allowed.snapshot.status };
		});

		assertSameTranscripts(transcripts, 'blocked');
		expect((transcripts.directus.blocked as any).status).toBe(422);
		expect(transcripts.directus.allowedStatus).toBe(200);
	});

	test('`return` replaces the payload', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const { key } = await send(ctx, 'POST', `/items/${collections.changed}`, { title: 'one' });
			const patched = await send(ctx, 'PATCH', `/items/${collections.changed}/${key}`, { title: 'two' });
			return (patched.snapshot as any).body;
		});

		assertSameTranscripts(transcripts, 'changed');
		expect((transcripts.directus as any).data.title).toBe('two (changed)');
	});

	test('the writes of item-create in a filter flow roll back with the failed request, run log included', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const before = await lastRunId(flows['rollback']!);
			const result = await send(ctx, 'POST', `/items/${collections.rollback}`, { title: ctx.app });
			return {
				response: result.snapshot,
				logRows: await logRows(`rolled back ${ctx.app}`),
				runRows: (await runRows(flows['rollback']!, before)).length,
			};
		});

		assertSameTranscripts(transcripts, 'rollback');
		expect(transcripts.directus).toMatchObject({ logRows: 0, runRows: 0 });
	});
});

describe('action flows run after the response, at the app that got the request only', () => {
	test('items.create of a user collection: one run and one log row per request', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const before = await lastRunId(flows['action']!);
			const title = `created at ${ctx.app}`;
			const result = await send(ctx, 'POST', `/items/${collections.action}`, { title });
			const note = `action ${collections.action}.items.create ${title} by true`;
			await until(async () => (await logRows(note)) > 0);
			const runs = await runRows(flows['action']!, before);

			return {
				status: result.snapshot.status,
				logRows: await logRows(note),
				runs: runs.length,
				user: runs[0]?.['user'] != null,
			};
		});

		assertSameTranscripts(transcripts, 'action');
		expect(transcripts.directus).toEqual({ status: 200, logRows: 1, runs: 1, user: true });
	});

	test('a rejected action flow does not change the response; its run log is written', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const { key } = await send(ctx, 'POST', `/items/${collections.action}`, { title: 'to update' });
			const before = await lastRunId(flows['actionReject']!);
			const patched = await send(ctx, 'PATCH', `/items/${collections.action}/${key}`, { title: 'updated' });
			await until(async () => (await runRows(flows['actionReject']!, before)).length > 0);

			return { status: patched.snapshot.status, runs: (await runRows(flows['actionReject']!, before)).length };
		});

		assertSameTranscripts(transcripts, 'action reject');
		expect(transcripts.directus).toEqual({ status: 200, runs: 1 });
	});

	test('a system collection: folders.create', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const name = uniqueName(`flows-folder-${ctx.app}`);
			const result = await send(ctx, 'POST', '/folders', { name });
			const note = `folder folders.create ${name}`;
			await until(async () => (await logRows(note)) > 0);
			if (result.key) await appRequest('directus', 'DELETE', `/folders/${result.key}`);
			return { status: result.snapshot.status, logRows: await logRows(note) };
		});

		assertSameTranscripts(transcripts, 'folders');
		expect(transcripts.directus).toEqual({ status: 200, logRows: 1 });
	});

	test('auth.login (feature 003 event, D-26): one run per login at the app that logged in', async () => {
		const user = await createUser('directus', 'flows-login');

		const transcripts = await scenario(urls(), async (ctx) => {
			const before = await lastRunId(flows['login']!);
			const note = `login ${user.email} success default`;
			const notesBefore = await logRows(note);
			const login = await call(ctx, {
				method: 'POST',
				path: '/auth/login',
				body: { email: user.email, password: user.password },
			});
			await until(async () => (await runRows(flows['login']!, before)).length > 0);
			return {
				status: login.status,
				runs: (await runRows(flows['login']!, before)).length,
				notes: (await logRows(note)) - notesBefore,
			};
		});

		assertSameTranscripts(transcripts, 'login');
		expect(transcripts.directus.status).toBe(200);
		expect(transcripts.directus.runs).toBe(1);
	});
});
