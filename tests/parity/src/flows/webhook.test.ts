// Feature 009 (T019; spec US1 ca 1–4, 7, FR-001, FR-012, FR-013, FR-020, FR-024; contracts/flows-api.md §1, §3):
// webhook flows seeded once in the shared database, the same trigger sent to both apps, responses compared.
// The parity requests send no token: webhooks run with the public accountability.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { cleanupFlows, runRows, same, seedFlow, type SeededFlow, until } from './helpers.js';

const seeded: string[] = [];

async function flow(def: Parameters<typeof seedFlow>[0]): Promise<SeededFlow> {
	const result = await seedFlow(def);
	seeded.push(result.id);
	return result;
}

const trigger = (id: string, method = 'GET', extra: Record<string, unknown> = {}) => ({
	method,
	path: `/flows/trigger/${id}`,
	...extra,
});

let hello: SeededFlow;
let all: SeededFlow;
let path: SeededFlow;
let post: SeededFlow;

beforeAll(async () => {
	hello = await flow({
		trigger: 'webhook',
		operations: [{ key: 'greet', type: 'transform', options: { json: { hello: '{{ $trigger.query.name }}' } } }],
	});

	all = await flow({
		trigger: 'webhook',
		options: { return: '$all' },
		operations: [{ key: 'greet', type: 'transform', options: { json: { n: 1 } } }],
	});

	path = await flow({ trigger: 'webhook', options: { return: '$trigger.query.x' } });

	post = await flow({
		trigger: 'webhook',
		options: { method: 'POST' },
		operations: [{ key: 'echo', type: 'transform', options: { json: '{{ $trigger.body }}' } }],
	});
}, 60_000);

afterAll(async () => {
	await cleanupFlows(seeded);
});

describe('responses', () => {
	test('GET returns $last as the raw body (no data envelope)', async () => {
		const result = await same(trigger(hello.id, 'GET', { path: `/flows/trigger/${hello.id}?name=A` }));

		expect(result.directus.status).toBe(200);
		expect(result.directus.json).toEqual({ hello: 'A' });
	});

	test('return $all: every key, the public accountability, the allowed env', async () => {
		const result = await same(trigger(all.id));

		expect(Object.keys(result.directus.json as any).sort()).toEqual([
			'$accountability',
			'$env',
			'$last',
			'$trigger',
			'greet',
		]);
		expect((result.directus.json as any).$trigger).toMatchObject({ path: `/trigger/${all.id}`, method: 'GET' });
	});

	test('return path, and a path that does not exist answers 204', async () => {
		expect((await same(trigger(path.id, 'GET', { path: `/flows/trigger/${path.id}?x=y` }))).directus.json).toBe('y');
		expect((await same(trigger(path.id))).directus.status).toBe(204);
	});

	test.each([
		['null', null],
		['0', 0],
		['empty string', '""'],
	])('a falsy result (%s) answers 204', async (_label, json) => {
		const falsy = await flow({
			trigger: 'webhook',
			operations: [{ key: 'v', type: 'transform', options: { json } }],
		});

		expect((await same(trigger(falsy.id))).directus.status).toBe(204);
	});

	test('POST with a JSON body; the other method is 403', async () => {
		const result = await same(trigger(post.id, 'POST', { body: { name: 'B' } }));
		expect(result.directus.json).toEqual({ name: 'B' });

		expect((await same(trigger(post.id, 'GET'))).directus.status).toBe(403);
		expect((await same(trigger(hello.id, 'POST', { body: {} }))).directus.status).toBe(403);
	});

	test('OPTIONS and HEAD', async () => {
		await same({ method: 'OPTIONS', path: `/flows/trigger/${hello.id}` });
		await same({ method: 'HEAD', path: `/flows/trigger/${hello.id}` });
	});
});

describe('async and errors', () => {
	test('async answers 204 at once and the flow still runs (one run row per app)', async () => {
		const async = await flow({
			trigger: 'webhook',
			options: { async: true, error_on_reject: true },
			operations: [{ key: 'boom', type: 'throw-error', options: { code: 'NOPE', status: '422', message: 'no' } }],
		});

		expect((await same(trigger(async.id))).directus.status).toBe(204);
		expect(await until(async () => (await runRows(async.id)).length === 2)).toBe(true);
	});

	test('error_on_reject: the error of throw-error with its status, code and message', async () => {
		const rejecting = await flow({
			trigger: 'webhook',
			options: { error_on_reject: true },
			operations: [{ key: 'boom', type: 'throw-error', options: { code: 'NOPE', status: '422', message: 'no' } }],
		});

		const result = await same(trigger(rejecting.id));
		expect(result.directus.status).toBe(422);
		expect((result.directus.json as any).errors[0]).toMatchObject({ message: 'no', extensions: { code: 'NOPE' } });
	});

	test('error_on_reject with a failed condition: 400 with one error per failed rule', async () => {
		const rejecting = await flow({
			trigger: 'webhook',
			options: { error_on_reject: true },
			operations: [
				{
					key: 'check',
					type: 'condition',
					options: { filter: { $trigger: { query: { a: { _eq: '1' } } } } },
				},
			],
		});

		const result = await same(trigger(rejecting.id, 'GET', { path: `/flows/trigger/${rejecting.id}?a=2` }));
		expect(result.directus.status).toBe(400);
		expect((result.directus.json as any).errors[0].extensions.code).toBe('FAILED_VALIDATION');
	});

	test('without error_on_reject the rejected error is the 200 body (R7: name, code, status, no message)', async () => {
		const rejecting = await flow({
			trigger: 'webhook',
			operations: [{ key: 'boom', type: 'throw-error', options: { code: 'NOPE', status: '422', message: 'no' } }],
		});

		const result = await same(trigger(rejecting.id));
		expect(result.directus.status).toBe(200);
		expect(result.directus.json).toEqual({ name: 'DirectusError', code: 'NOPE', status: 422 });
	});
});

describe('flows that cannot be triggered', () => {
	test('inactive flow, operation flow, unknown uuid: 403', async () => {
		const inactive = await flow({ trigger: 'webhook', status: 'inactive' });
		const operation = await flow({ trigger: 'operation' });

		for (const id of [inactive.id, operation.id, randomUUID()]) {
			expect((await same(trigger(id))).directus.status, id).toBe(403);
		}
	});

	test('a key that is not a uuid is a 404 route; an upper case uuid of a flow matches the route but no flow (403)', async () => {
		const notUuid = await same(trigger('not-a-uuid'));
		expect(notUuid.directus.status).toBe(404);
		expect((notUuid.directus.json as any).errors[0].extensions.code).toBe('ROUTE_NOT_FOUND');

		expect((await same(trigger(hello.id.toUpperCase()))).directus.status).toBe(403);
	});

	test('cacheEnabled false: the same Cache-Control header at both apps', async () => {
		const uncached = await flow({ trigger: 'webhook', options: { cacheEnabled: false } });

		await same(trigger(uncached.id));
	});
});
