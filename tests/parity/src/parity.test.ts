import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AcceptedDifference } from '../accepted-differences.js';
import { assertParity, compare, diffJson, matches, parity, report, type Difference } from './parity.js';

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

	test('compares access-control-* headers and Retry-After by format', () => {
		const a = { ...base, headers: { 'access-control-allow-origin': '*', 'retry-after': '10' } };
		const b = { ...base, headers: { 'access-control-allow-origin': '*', 'retry-after': '3' } };
		expect(compare('GET /x', a, b)).toEqual([]);
		expect(compare('GET /x', a, { ...b, headers: { 'retry-after': '3' } })).toEqual([
			{ kind: 'header', location: 'access-control-allow-origin', directus: '*', backoffice: undefined },
		]);
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
