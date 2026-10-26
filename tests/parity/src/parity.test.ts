import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { AcceptedDifference } from '../accepted-differences.js';
import {
	assertParity,
	capture,
	compare,
	diffJson,
	isBinary,
	matches,
	parity,
	report,
	type Difference,
} from './parity.js';

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

const servers: http.Server[] = [];

function serve(handler: Handler): Promise<string> {
	return new Promise((resolve) => {
		const server = http.createServer(handler);
		servers.push(server);
		server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
	});
}

afterAll(() => servers.forEach((s) => s.close()));

const json =
	(body: unknown, headers: Record<string, string> = {}): Handler =>
	(_req, res) => {
		res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', ...headers });
		res.end(JSON.stringify(body));
	};

const D01: AcceptedDifference = {
	id: 'D-01',
	feature: '001',
	kind: 'http',
	endpoints: ['*'],
	location: { header: 'x-powered-by' },
	directus: 'Directus',
	backoffice: 'Backoffice',
	reason: 'test',
};

describe('parity() against two local servers', () => {
	let same: [string, string];
	let differentHeader: [string, string];
	let differentBody: [string, string];
	let differentStatus: [string, string];
	let hostEcho: [string, string];

	beforeAll(async () => {
		same = [
			await serve(json({ a: 1, b: [1, 2] }, { 'x-powered-by': 'Directus' })),
			await serve(json({ b: [1, 2], a: 1 }, { 'x-powered-by': 'Backoffice' })),
		];
		differentHeader = [
			await serve(json({}, { 'cache-control': 'no-cache' })),
			await serve(json({}, { 'cache-control': 'max-age=1' })),
		];
		differentBody = [
			await serve(json({ data: { deep: { value: 'a' } } })),
			await serve(json({ data: { deep: { value: 'b' } } })),
		];

		const status =
			(code: number): Handler =>
			(_req, res) => {
				res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' });
				res.end('pong');
			};

		differentStatus = [await serve(status(200)), await serve(status(503))];

		const echo: Handler = (req, res) => json({ host: req.headers.host })(req, res);
		hostEcho = [await serve(echo), await serve(echo)];
	});

	test('equal responses pass; object key order is ignored; D-01 is accepted', async () => {
		const result = await parity({ path: '/x' }, { directusUrl: same[0], backofficeUrl: same[1], accepted: [D01] });
		expect(result.differences).toEqual([]);
		expect(result.accepted).toEqual([
			{ kind: 'header', location: 'x-powered-by', directus: 'Directus', backoffice: 'Backoffice', id: 'D-01' },
		]);
		expect(() => assertParity(result)).not.toThrow();
	});

	test('a header difference fails with endpoint, header and both values', async () => {
		const result = await parity(
			{ path: '/server/info' },
			{ directusUrl: differentHeader[0], backofficeUrl: differentHeader[1], accepted: [] },
		);
		expect(result.differences).toEqual([
			{ kind: 'header', location: 'cache-control', directus: 'no-cache', backoffice: 'max-age=1' },
		]);
		expect(() => assertParity(result)).toThrow(
			/GET \/server\/info: 1 unaccepted difference[\s\S]*header cache-control[\s\S]*"no-cache"[\s\S]*"max-age=1"/,
		);
	});

	test('a deep body difference is reported by JSON pointer', async () => {
		const result = await parity(
			{ path: '/server/info' },
			{ directusUrl: differentBody[0], backofficeUrl: differentBody[1], accepted: [] },
		);
		expect(result.differences).toEqual([
			{ kind: 'body', location: '/data/deep/value', directus: 'a', backoffice: 'b' },
		]);
		expect(report(result)).toContain('body /data/deep/value');
	});

	test('a status difference fails; non-JSON bodies compare as text', async () => {
		const result = await parity(
			{ method: 'post', path: '/server/ping', body: { a: 1 } },
			{ directusUrl: differentStatus[0], backofficeUrl: differentStatus[1], accepted: [] },
		);
		expect(result.endpoint).toBe('POST /server/ping');
		expect(result.differences).toEqual([{ kind: 'status', location: '', directus: 200, backoffice: 503 }]);
	});

	test('both servers receive the same Host header', async () => {
		const result = await parity({ path: '/' }, { directusUrl: hostEcho[0], backofficeUrl: hostEcho[1], accepted: [] });
		expect(result.differences).toEqual([]);
		expect(result.directus.json).toEqual({ host: new URL(hostEcho[0]).host });
	});

	test('needs both URLs', async () => {
		await expect(parity({ path: '/' }, { directusUrl: '', backofficeUrl: '' })).rejects.toThrow(
			'DIRECTUS_URL and BACKOFFICE_URL must be set',
		);
	});
});

describe('compare()', () => {
	const base = { status: 200, text: '', json: undefined, isJson: false };

	test('skips ETag for OAS and /metrics only', () => {
		const a = { ...base, headers: { etag: 'W/"1"' } };
		const b = { ...base, headers: { etag: 'W/"2"' } };
		expect(compare('GET /server/specs/oas', a, b)).toEqual([]);
		expect(compare('GET /metrics', a, b)).toEqual([]);
		expect(compare('GET /server/info', a, b)).toHaveLength(1);
	});

	test('spec 022 D-181: no ETag compare when one body lists backoffice_migrations, or on a HEAD of the SDL route', () => {
		const json = (data: unknown[]) => ({
			...base,
			isJson: true,
			json: { data },
			headers: { etag: `W/"${data.length}-x"` },
		});
		const directus = json([{ collection: 'articles' }, { collection: 'backoffice_migrations' }]);
		const backoffice = json([{ collection: 'articles' }]);
		directus.text = JSON.stringify(directus.json);
		backoffice.text = JSON.stringify(backoffice.json);

		expect(compare('GET /collections', directus, backoffice)).toEqual([]);

		// The SDL download is octet-stream: compared as text without backoffice_migrations, not by its sha256.
		const sdl = (text: string) => ({
			...base,
			text,
			bytes: Buffer.from(text),
			headers: { 'content-type': 'application/octet-stream' },
		});
		const query = 'type Query {\n  articles: [articles]\n}';
		expect(
			compare(
				'GET /server/specs/graphql',
				sdl('type Query {\n  articles: [articles]\n  backoffice_migrations: [backoffice_migrations]\n}'),
				sdl(query),
			),
		).toEqual([]);
		expect(compare('GET /server/specs/graphql', sdl(query), sdl('type Query {\n  other: [other]\n}'))).toHaveLength(1);

		const head = { ...base, headers: { etag: 'W/"1"' } };
		expect(compare('HEAD /server/specs/graphql', head, { ...head, headers: { etag: 'W/"2"' } })).toEqual([]);
		expect(compare('HEAD /server/info', head, { ...head, headers: { etag: 'W/"2"' } })).toHaveLength(1);
	});

	test('spec 022 D-181: introspection types are compared by name when Directus had backoffice_migrations', () => {
		const schema = (types: { name: string }[]) => {
			const captured = { ...base, isJson: true, headers: {}, json: { data: { __schema: { types } } } };
			return { ...captured, text: JSON.stringify(captured.json) };
		};
		const directus = schema([
			{ name: 'Query' },
			{ name: 'backoffice_migrations' },
			{ name: 'ID' },
			{ name: 'articles' },
		]);
		const backoffice = schema([{ name: 'Query' }, { name: 'articles' }, { name: 'ID' }]);

		expect(compare('POST /graphql', directus, backoffice)).toEqual([]);
		// The system scope on MySQL (CI 40298326039): EventEnum found through backoffice_migrations_mutated first; types by
		// name there, verbatim on Postgres and SQLite.
		const system = () =>
			compare(
				'POST /graphql/system',
				schema([
					{ name: 'Subscription' },
					{ name: 'backoffice_migrations_mutated' },
					{ name: 'EventEnum' },
					{ name: 'directus_access_mutated' },
				]),
				schema([{ name: 'Subscription' }, { name: 'directus_access_mutated' }, { name: 'EventEnum' }]),
			);
		vi.stubEnv('TEST_DB', 'mysql');
		expect(system()).toEqual([]);
		vi.stubEnv('TEST_DB', 'postgres');
		expect(system()).not.toEqual([]);
		vi.unstubAllEnvs();
		// Without backoffice_migrations at either side the order is compared as before.
		expect(
			compare(
				'POST /graphql',
				schema([{ name: 'Query' }, { name: 'ID' }]),
				schema([{ name: 'ID' }, { name: 'Query' }]),
			),
		).not.toEqual([]);
	});

	test('compares access-control-* headers and Retry-After by format', () => {
		const a = { ...base, headers: { 'access-control-allow-origin': '*', 'retry-after': '10' } };
		const b = { ...base, headers: { 'access-control-allow-origin': '*', 'retry-after': '3' } };
		expect(compare('GET /x', a, b)).toEqual([]);
		expect(compare('GET /x', a, { ...b, headers: { 'retry-after': '3' } })).toEqual([
			{ kind: 'header', location: 'access-control-allow-origin', directus: '*', backoffice: undefined },
		]);
	});

	test('feature 007: binary bodies compare by bytes, not by their UTF-8 text', () => {
		const headers = { 'content-type': 'image/jpeg' };
		const a = { ...base, headers, bytes: Buffer.from([0xff, 0xd8, 0xfe]) };
		const b = { ...base, headers, bytes: Buffer.from([0xff, 0xd8, 0xfd]) };

		// Both decode to the same replacement characters.
		expect(a.bytes.toString('utf8')).toBe(b.bytes.toString('utf8'));
		expect(compare('GET /assets/x', a, { ...a })).toEqual([]);
		expect(compare('GET /assets/x', a, b)).toEqual([
			expect.objectContaining({ kind: 'body', directus: expect.stringMatching(/^sha256:[0-9a-f]{64} \(3 bytes\)$/) }),
		]);
		expect(isBinary({ headers: { 'content-type': 'application/json; charset=utf-8' } })).toBe(false);
		expect(isBinary({ headers: { 'content-type': 'application/zip' } })).toBe(true);
		expect(isBinary({ headers: {} })).toBe(false);
	});

	test('ignores headers outside FR-104 (date, content-length)', () => {
		const a = { ...base, headers: { date: 'x', 'content-length': '1' } };
		const b = { ...base, headers: { date: 'y', 'content-length': '2' } };
		expect(compare('GET /x', a, b)).toEqual([]);
	});

	test('OAS: info.version ignored, tags and paths sorted', () => {
		const a = {
			...base,
			isJson: true,
			headers: {},
			json: {
				info: { version: 'h1', title: 'T' },
				tags: [{ name: 'B' }, { name: 'A' }],
				paths: { '/b': {}, '/a': {} },
			},
		};
		const b = {
			...base,
			isJson: true,
			headers: {},
			json: {
				info: { version: 'h2', title: 'T' },
				tags: [{ name: 'A' }, { name: 'B' }],
				paths: { '/a': {}, '/b': {} },
			},
		};
		expect(compare('GET /server/specs/oas', a, b)).toEqual([]);
	});

	test('rate limit body: reset and message compared by shape, limit by value', () => {
		const body = (reset: number, after: string, limit: number) => ({
			errors: [
				{
					message: `Too many requests, retry after ${after}.`,
					extensions: { code: 'REQUESTS_EXCEEDED', limit, reset },
				},
			],
		});

		const a = { ...base, isJson: true, headers: {}, json: body(1, '1s', 5) };
		expect(compare('GET /x', a, { ...a, json: body(2, '900ms', 5) })).toEqual([]);
		expect(compare('GET /x', a, { ...a, json: body(2, '900ms', 6) })).toEqual([
			{ kind: 'body', location: '/errors/0/extensions/limit', directus: 5, backoffice: 6 },
		]);
	});

	test('rate limit body from the Redis store: reset is a date, the ETag is compared by length only', () => {
		const body = (reset: string) => ({ errors: [{ extensions: { code: 'REQUESTS_EXCEEDED', reset } }] });
		const a = {
			...base,
			isJson: true,
			headers: { etag: 'W/"96-6Z69u48KId6LmKfcLlaGDXn5kH4"' },
			json: body('2026-10-09T14:36:09.597Z'),
		};
		const b = { ...a, headers: { etag: 'W/"96-4pXepL/cjQuKQAQVoET0eu6Zg0E"' }, json: body('2026-10-09T14:36:09.596Z') };

		expect(compare('GET /x', a, b)).toEqual([]);
		expect(compare('GET /x', a, { ...b, headers: { etag: 'W/"97-4pXepL/cjQuKQAQVoET0eu6Zg0E"' } })).toEqual([
			{ kind: 'header', location: 'etag', directus: 'W/"96-<hash>"', backoffice: 'W/"97-<hash>"' },
		]);
	});

	test('the ETag of a time-independent body is compared in full', () => {
		const a = { ...base, isJson: true, headers: { etag: 'W/"2-aaa"' }, json: { a: 1 } };
		expect(compare('GET /x', a, { ...a, headers: { etag: 'W/"2-bbb"' } })).toEqual([
			{ kind: 'header', location: 'etag', directus: 'W/"2-aaa"', backoffice: 'W/"2-bbb"' },
		]);
	});
});

describe('diffJson()', () => {
	test('arrays compare by order and length; missing keys are reported', () => {
		const out: Difference[] = [];
		diffJson({ a: [1, 2], b: 1 }, { a: [2, 1], c: 1 }, '', out);

		expect(out).toEqual([
			{ kind: 'body', location: '/a/0', directus: 1, backoffice: 2 },
			{ kind: 'body', location: '/a/1', directus: 2, backoffice: 1 },
			{ kind: 'body', location: '/b', directus: 1, backoffice: undefined },
			{ kind: 'body', location: '/c', directus: undefined, backoffice: 1 },
		]);

		const lengths: Difference[] = [];
		diffJson([1], [1, 2], '/x', lengths);
		expect(lengths).toEqual([{ kind: 'body', location: '/x', directus: [1], backoffice: [1, 2] }]);
	});
});

describe('matches()', () => {
	test.each([
		[undefined, 'x', true],
		['a', 'a', true],
		['a', 'b', false],
		[/^W\//, 'W/"1"', true],
		[/^W\//, 1, false],
		[{ absent: true }, undefined, true],
		[{ absent: true }, 'x', false],
		[{ any: true }, 42, true],
		[null, null, true],
		[1, 1, true],
	] as const)('%s ~ %s → %s', (matcher, value, expected) => {
		expect(matches(matcher as never, value)).toBe(expected);
	});
});

describe('accepted differences: when, any, RegExp pointers', () => {
	const base = (status: number, json: unknown) => ({
		status,
		json,
		isJson: true,
		text: JSON.stringify(json),
		headers: {},
	});

	test('`when.directusStatus` gates an `any` entry', async () => {
		const { classify } = await import('./parity.js');
		const entry: AcceptedDifference = {
			id: 'D-10',
			feature: '001',
			kind: 'http',
			endpoints: ['*'],
			location: { any: true },
			when: { directusStatus: 401 },
			reason: 't',
		};
		const diffs: Difference[] = [{ kind: 'status', location: '', directus: 401, backoffice: 200 }];
		expect(classify('GET /server/info', diffs, [entry], base(401, {})).accepted).toHaveLength(1);
		expect(classify('GET /server/info', diffs, [entry], base(403, {})).differences).toHaveLength(1);
	});

	test('`excludeEndpoints` leaves endpoints out (D-10 and the auth routes of feature 003)', async () => {
		const { classify } = await import('./parity.js');
		const entry: AcceptedDifference = {
			id: 'D-10',
			feature: '001',
			kind: 'http',
			endpoints: ['*'],
			excludeEndpoints: ['* /auth', '* /auth/*'],
			location: { any: true },
			reason: 't',
		};
		const diffs: Difference[] = [{ kind: 'status', location: '', directus: 401, backoffice: 200 }];
		expect(classify('GET /server/info', diffs, [entry]).accepted).toHaveLength(1);
		expect(classify('POST /AUTH/login', diffs, [entry]).differences).toHaveLength(1);
		expect(classify('GET /auth', diffs, [entry]).differences).toHaveLength(1);

		const toggle = { ...entry, endpoints: ['* /users/*/tfa/disable'], excludeEndpoints: [] };
		expect(classify('POST /users/abc/tfa/disable', diffs, [toggle]).accepted).toHaveLength(1);
		expect(classify('POST /users/abc/tfa/enable', diffs, [toggle]).differences).toHaveLength(1);
	});

	test('`when.backofficeCode` reads the code of the Backoffice answer (D-24)', async () => {
		const { classify } = await import('./parity.js');
		const entry: AcceptedDifference = {
			id: 'D-24',
			feature: '003',
			kind: 'http',
			endpoints: ['POST /auth/refresh'],
			location: { any: true },
			when: { backofficeCode: 'INVALID_PROVIDER_CONFIG' },
			reason: 't',
		};
		const diffs: Difference[] = [{ kind: 'status', location: '', directus: 200, backoffice: 503 }];
		const code = (c: string) => base(503, { errors: [{ extensions: { code: c } }] });
		expect(
			classify('POST /auth/refresh', diffs, [entry], base(200, {}), code('INVALID_PROVIDER_CONFIG')).accepted,
		).toHaveLength(1);
		expect(classify('POST /auth/refresh', diffs, [entry], base(200, {}), code('OTHER')).accepted).toHaveLength(0);
	});

	test('`when.directusCode` reads errors[0].extensions.code', async () => {
		const { classify } = await import('./parity.js');
		const entry: AcceptedDifference = {
			id: 'D-12',
			feature: '001',
			kind: 'http',
			endpoints: ['*'],
			location: { any: true },
			when: { directusCode: 'INVALID_QUERY' },
			reason: 't',
		};
		const diffs: Difference[] = [{ kind: 'status', location: '', directus: 400, backoffice: 200 }];
		expect(
			classify('GET /x', diffs, [entry], base(400, { errors: [{ extensions: { code: 'INVALID_QUERY' } }] })).accepted,
		).toHaveLength(1);
		expect(
			classify('GET /x', diffs, [entry], base(400, { errors: [{ extensions: { code: 'OTHER' } }] })).accepted,
		).toHaveLength(0);
	});

	test('RegExp JSON pointer', async () => {
		const { classify } = await import('./parity.js');
		const entry: AcceptedDifference = {
			id: 'D-02',
			feature: '001',
			kind: 'http',
			endpoints: ['GET /server/specs/oas'],
			location: { jsonPointer: /^\/tags\/\d+\/description$/ },
			directus: /Directus/,
			backoffice: /Backoffice/,
			reason: 't',
		};
		const diffs: Difference[] = [
			{ kind: 'body', location: '/tags/3/description', directus: 'Directus server', backoffice: 'Backoffice server' },
		];
		expect(classify('GET /server/specs/oas', diffs, [entry]).accepted).toHaveLength(1);
		expect(classify('GET /server/info', diffs, [entry]).accepted).toHaveLength(0);
	});
});

test('capture() sends Cache-Control: no-store on GET and HEAD unless the request sets one (feature 005, R4)', async () => {
	const url = await serve((req, res) => {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(req.method === 'HEAD' ? undefined : JSON.stringify(req.headers['cache-control'] ?? null));
	});

	expect((await capture(url, { path: '/' })).json).toBe('no-store');
	expect((await capture(url, { path: '/', headers: { 'Cache-Control': 'max-age=0' } })).json).toBe('max-age=0');
	expect((await capture(url, { method: 'POST', path: '/' })).json).toBeNull();
});
