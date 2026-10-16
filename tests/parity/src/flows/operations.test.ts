// Feature 009 (T027; spec US4, FR-030 to FR-041, FR-045; contracts/operations.md): each built-in operation in a
// webhook flow that returns `$all`, on its resolve and reject branches, at both apps. Reads go to both apps at once;
// operations that write run as a scenario (Directus, then Backoffice) on items of their own, with the ids of each run
// as placeholders. `reduced` keeps the resolve cases; `full` adds the reject cases and the slow sandbox limits.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { call, snap } from '../files/helpers.js';
import { cleanup, createUserCollection, uniqueName } from '../permissions/fixtures.js';
import { cleanupFlows, type OperationDef, same, seedFlow } from './helpers.js';

const full = process.env['PARITY_SUITE'] !== 'reduced';
const seeded: string[] = [];
let collection: string;
let itemId: string;

/** A webhook flow (POST, `return = $all`) of the given operations. */
async function flow(operations: OperationDef[], options: Record<string, unknown> = {}): Promise<string> {
	const { id } = await seedFlow({
		trigger: 'webhook',
		options: { method: 'POST', return: '$all', ...options },
		operations,
	});
	seeded.push(id);
	return id;
}

const post = (id: string, body: Record<string, unknown> = {}) =>
	same({ method: 'POST', path: `/flows/trigger/${id}`, body });

/** `$all` of a flow at both apps, the same: the result of the run at Directus. */
const run = async (id: string, body: Record<string, unknown> = {}) => (await post(id, body)).directus.json as any;

beforeAll(async () => {
	collection = await createUserCollection(
		uniqueName('flows_ops').replace(/-/g, '_'),
		[{ field: 'title', type: 'string' }],
		{
			primaryKey: 'uuid',
		},
	);

	itemId = (await appRequest('directus', 'POST', `/items/${collection}`, { title: 'kept' })).data.id;
}, 120_000);

afterAll(async () => {
	await cleanupFlows(seeded);
	await cleanup();
});

describe('condition', () => {
	test('resolve: null, and the next operation runs', async () => {
		const id = await flow([
			{
				key: 'check',
				type: 'condition',
				options: { filter: { $trigger: { body: { a: { _eq: 1 } } } } },
				resolve: 'after',
			},
			{ key: 'after', type: 'transform', options: { json: { ok: true } } },
		]);

		const all = await run(id, { a: 1 });
		expect(all.check).toBeNull();
		expect(all.after).toEqual({ ok: true });
	});

	test.skipIf(!full)('reject: one FailedValidationError per rule, on the reject branch', async () => {
		const id = await flow([
			{ key: 'check', type: 'condition', options: { filter: { $trigger: { body: { a: { _eq: 1 } } } } }, reject: 'no' },
			{ key: 'no', type: 'transform', options: { json: { rejected: true } } },
		]);

		const all = await run(id, { a: 2 });
		expect(all.check[0]).toMatchObject({ name: 'DirectusError', code: 'FAILED_VALIDATION' });
		expect(all.no).toEqual({ rejected: true });
	});
});

describe('exec', () => {
	test('resolve: sync and async functions, data without functions, console.log', async () => {
		const id = await flow([
			{
				key: 'script',
				type: 'exec',
				options: {
					code: 'module.exports = async function (data) { console.log("parity exec", data.$trigger.body.n); return { double: data.$trigger.body.n * 2, keys: Object.keys(data), env: process.env }; }',
				},
			},
		]);

		expect((await run(id, { n: 21 })).script).toMatchObject({ double: 42 });
	});

	test.skipIf(!full).each([
		['a syntax error', 'module.exports = function ('],
		['no function', 'module.exports = 42;'],
		['require', "const fs = require('node:fs'); module.exports = () => 1;"],
		['import', "import fs from 'node:fs'; module.exports = () => 1;"],
		['a throwing function', 'module.exports = () => { throw new Error("from the script"); };'],
	])('reject: %s', async (_label, code) => {
		const id = await flow([{ key: 'script', type: 'exec', options: { code } }]);

		await post(id);
	});

	test.skipIf(!full)(
		'reject: the timeout and the memory limit of the sandbox (FLOWS_RUN_SCRIPT_TIMEOUT, _MAX_MEMORY defaults)',
		async () => {
			const timeout = await flow([
				{ key: 'script', type: 'exec', options: { code: 'module.exports = async () => { while (true) {} };' } },
			]);

			const memory = await flow([
				{
					key: 'script',
					type: 'exec',
					options: {
						code: 'module.exports = () => { const s = []; while (true) { const a = new Uint8Array(2097152); for (let i = 0; i < a.length; i += 4096) a[i] = 1; s.push(a); } };',
					},
				},
			]);

			// A plain Error serializes to {} (message is not enumerable), at both apps; the run log keeps the message.
			expect((await run(timeout)).script).toEqual({});
			await post(memory);
		},
		60_000,
	);
});

describe('items', () => {
	test('item-read with $full by key and with a query; $trigger is the public accountability (403 on reject)', async () => {
		const id = await flow([
			{ key: 'one', type: 'item-read', options: { collection, key: itemId, permissions: '$full' }, resolve: 'query' },
			{
				key: 'query',
				type: 'item-read',
				options: { collection, query: '{"filter":{"title":{"_eq":"kept"}},"fields":["title"]}', permissions: '$full' },
				resolve: 'public',
			},
			{ key: 'public', type: 'item-read', options: { collection, key: itemId, permissions: '$trigger' } },
		]);

		const all = await run(id);
		expect(all.one).toMatchObject({ id: itemId, title: 'kept' });
		expect(all.query).toEqual([{ title: 'kept' }]);
		expect(all.public).toMatchObject({ code: 'FORBIDDEN' });
	});

	test.skipIf(!full)('a role uuid that does not exist rejects with the error of getAccountabilityForRole', async () => {
		const role = randomUUID();
		const id = await flow([
			{ key: 'read', type: 'item-read', options: { collection, key: itemId, permissions: role } },
		]);

		// A plain Error: {} in $all at both apps (message is not enumerable); the run log keeps the message.
		expect((await run(id)).read).toEqual({});
	});

	test('item-create, item-update and item-delete with $full, each app on its own item', async () => {
		const id = await flow([
			{
				key: 'create',
				type: 'item-create',
				options: { collection, payload: '{"title":"{{ $trigger.body.title }}"}', permissions: '$full' },
				resolve: 'update',
			},
			{
				key: 'update',
				type: 'item-update',
				options: { collection, key: '{{ create[0] }}', payload: { title: 'changed' }, permissions: '$full' },
				resolve: 'read',
			},
			{
				key: 'read',
				type: 'item-read',
				options: { collection, key: '{{ create[0] }}', permissions: '$full' },
				resolve: 'delete',
			},
			{ key: 'delete', type: 'item-delete', options: { collection, key: '{{ create[0] }}', permissions: '$full' } },
		]);

		const transcripts = await scenario(urls(), async (ctx) => {
			const captured = await call(ctx, {
				method: 'POST',
				path: `/flows/trigger/${id}`,
				body: { title: 'created' },
			});
			const created = (captured.json as any).create[0] as string;
			const left = await appRequest('directus', 'GET', `/items/${collection}?filter[id][_eq]=${created}`);

			return {
				response: snap(captured, `/flows/trigger/${id}`, { created }),
				left: left.data.length,
			};
		});

		assertSameTranscripts(transcripts, 'item operations');
		expect(transcripts.directus.left).toBe(0);
	});
});

describe('other operations', () => {
	test('json-web-token sign, verify, decode', async () => {
		const id = await flow([
			{
				key: 'sign',
				type: 'json-web-token',
				options: {
					operation: 'sign',
					payload: { sub: 'parity' },
					secret: 'flow-secret',
					options: { noTimestamp: true },
				},
				resolve: 'verify',
			},
			{
				key: 'verify',
				type: 'json-web-token',
				options: { operation: 'verify', token: '{{ sign }}', secret: 'flow-secret' },
				resolve: 'decode',
			},
			{ key: 'decode', type: 'json-web-token', options: { operation: 'decode', token: '{{ sign }}' } },
		]);

		const all = await run(id);
		expect(all.verify).toEqual({ sub: 'parity' });
		expect(all.decode).toEqual({ sub: 'parity' });
	});

	test.skipIf(!full).each([
		['sign without a secret', { operation: 'sign', payload: { a: 1 } }],
		['verify with the wrong secret', { operation: 'verify', token: 'a.b.c', secret: 'x' }],
		['an unknown operation', { operation: 'nope' }],
	])('json-web-token reject: %s', async (_label, options) => {
		await post(await flow([{ key: 'jwt', type: 'json-web-token', options }]));
	});

	test('log, sleep, transform, throw-error and an unknown type', async () => {
		const id = await flow([
			{ key: 'log', type: 'log', options: { message: 'parity log {{ $trigger.body.n }}' }, resolve: 'sleep' },
			{ key: 'sleep', type: 'sleep', options: { milliseconds: '50' }, resolve: 'transform' },
			{ key: 'transform', type: 'transform', options: { json: '{"n":{{ $trigger.body.n }}}' }, resolve: 'throw' },
			{
				key: 'throw',
				type: 'throw-error',
				options: { code: 'PARITY', status: '418', message: 'teapot' },
				reject: 'unknown',
			},
			{ key: 'unknown', type: 'from-an-extension', options: {} },
		]);

		const all = await run(id, { n: 7 });
		expect(all).toMatchObject({
			log: null,
			sleep: null,
			transform: { n: 7 },
			throw: { code: 'PARITY', status: 418 },
			unknown: null,
		});
	});

	test('mail: the rate limiter, then no mail (D-34): null at both apps', async () => {
		const id = await flow([
			{
				key: 'mail',
				type: 'mail',
				options: { to: 'flows@example.com', subject: 'Parity', type: 'wysiwyg', body: 'x' },
			},
		]);

		expect((await run(id)).mail).toBeNull();
	});

	test('notification with $full: one row per recipient, no sender', async () => {
		const admin = (await appRequest('directus', 'GET', '/users/me')).data.id;
		const id = await flow([
			{
				key: 'notify',
				type: 'notification',
				options: { recipient: [admin], subject: 'Parity', message: 'hello', permissions: '$full' },
			},
		]);

		const transcripts = await scenario(urls(), async (ctx) => {
			const captured = await call(ctx, { method: 'POST', path: `/flows/trigger/${id}` });
			const all = captured.json as any;
			const [key] = all.notify as number[];
			const row = (await appRequest('directus', 'GET', `/notifications/${key}?fields=recipient,sender,subject,message`))
				.data;
			// The serial key differs per run: compared as an array of one placeholder.
			all.notify = all.$last = all.notify.map(() => '<key>');
			return { response: snap(captured, `/flows/trigger/${id}`), row };
		});

		assertSameTranscripts(transcripts, 'notification');
		expect(transcripts.directus.row).toEqual({ recipient: admin, sender: null, subject: 'Parity', message: 'hello' });
	});

	test('request: a 200, a 404 on the reject branch, Content-Type added for a JSON body', async () => {
		const id = await flow([
			{
				key: 'ping',
				type: 'request',
				options: { url: 'http://files-fixtures/drawing.svg', method: 'GET' },
				resolve: 'nope',
			},
			{
				key: 'nope',
				type: 'request',
				options: { url: 'http://files-fixtures/nope', method: 'POST', body: '{"a":1}' },
			},
		]);

		const result = await same({
			method: 'POST',
			path: `/flows/trigger/${id}`,
			body: {},
			// The body holds the upstream headers (Date): the ETag hash is time-dependent, its length part is compared.
			normalize: (captured) => ({
				...captured,
				json: stable(captured.json),
				headers: { ...captured.headers, etag: (captured.headers['etag'] ?? '').replace(/-[^-"]+"$/, '-<hash>"') },
			}),
		});

		const all = result.directus.json as any;
		expect(all.ping).toMatchObject({ status: 200, statusText: 'OK' });
		expect(all.nope.status).toBeGreaterThanOrEqual(400);
	});

	test.skipIf(!full)('request: a denied IP and a host that does not resolve reject with an Error', async () => {
		const id = await flow([
			{
				key: 'denied',
				type: 'request',
				options: { url: 'http://169.254.169.254/latest', method: 'GET' },
				reject: 'unknown',
			},
			{ key: 'unknown', type: 'request', options: { url: 'http://nope.invalid/', method: 'GET' } },
		]);

		const all = await run(id);
		// Errors of the HTTP agent serialize with the enumerable fields axios adds; the same at both apps.
		expect(all.denied).toBeTypeOf('object');
		expect(all.unknown).toBeTypeOf('object');
	});

	test('trigger: an operation flow per item, serial, batch and parallel; a missing flow gives null', async () => {
		const target = await seedFlow({
			trigger: 'operation',
			options: { return: '$last' },
			operations: [{ key: 'double', type: 'transform', options: { json: '{"v":{{ $trigger.v }}}' } }],
		});

		seeded.push(target.id);
		const payload = [{ v: 1 }, { v: 2 }, { v: 3 }];

		const id = await flow([
			{
				key: 'serial',
				type: 'trigger',
				options: { flow: target.id, payload, iterationMode: 'serial' },
				resolve: 'batch',
			},
			{
				key: 'batch',
				type: 'trigger',
				options: { flow: target.id, payload, iterationMode: 'batch', batchSize: 2 },
				resolve: 'parallel',
			},
			{ key: 'parallel', type: 'trigger', options: { flow: target.id, payload }, resolve: 'single' },
			{ key: 'single', type: 'trigger', options: { flow: target.id, payload: { v: 9 } }, resolve: 'missing' },
			{ key: 'missing', type: 'trigger', options: { flow: randomUUID(), payload: {} } },
		]);

		const all = await run(id);
		for (const mode of ['serial', 'batch', 'parallel']) expect(all[mode]).toEqual(payload);
		expect(all.single).toEqual({ v: 9 });
		expect(all.missing).toBeNull();
	});
});

/** Results of the request operation: only the content type of the response headers (servers add their own). */
function stable(value: unknown): unknown {
	if (!value || typeof value !== 'object') return value;
	const all = value as Record<string, any>;

	for (const key of Object.keys(all)) {
		const result = all[key];
		if (result && typeof result === 'object' && 'statusText' in result && result.headers) {
			all[key] = { ...result, headers: { 'content-type': result.headers['content-type'] } };
		}
	}

	return all;
}
