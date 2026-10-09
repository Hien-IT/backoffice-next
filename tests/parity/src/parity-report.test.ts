// US4.2: a difference outside the accepted list fails with the endpoint, the header or JSON pointer and both values.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AcceptedDifference } from '../accepted-differences.js';
import { assertParity, parity } from './parity.js';

const servers: http.Server[] = [];
let directus: string;
let backoffice: string;

function serve(status: number, headers: Record<string, string>, body: unknown): Promise<string> {
	return new Promise((resolve) => {
		const server = http.createServer((_req, res) => {
			res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
			res.end(JSON.stringify(body));
		});

		servers.push(server);
		server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
	});
}

beforeAll(async () => {
	directus = await serve(
		200,
		{ 'cache-control': 'no-cache', 'x-powered-by': 'Directus' },
		{ data: { a: { b: [1, { c: 'x' }] } } },
	);
	backoffice = await serve(
		201,
		{ 'cache-control': 'public', 'x-powered-by': 'Backoffice' },
		{ data: { a: { b: [1, { c: 'y' }] } } },
	);
});

afterAll(() => servers.forEach((s) => s.close()));

const D01: AcceptedDifference = {
	id: 'D-01',
	feature: '001',
	kind: 'http',
	endpoints: ['*'],
	location: { header: 'x-powered-by' },
	directus: 'Directus',
	backoffice: 'Backoffice',
	reason: 'x',
};

test('report names the endpoint, each location and both values; accepted ones are left out', async () => {
	const result = await parity(
		{ method: 'PATCH', path: '/server/info?x=1' },
		{ directusUrl: directus, backofficeUrl: backoffice, accepted: [D01] },
	);

	expect(() => assertParity(result)).toThrow(
		[
			'PATCH /server/info: 3 unaccepted difference(s)',
			'  status',
			'    Directus:   200',
			'    Backoffice: 201',
			'  header cache-control',
			'    Directus:   "no-cache"',
			'    Backoffice: "public"',
			'  body /data/a/b/1/c',
			'    Directus:   "x"',
			'    Backoffice: "y"',
		].join('\n'),
	);

	expect(result.accepted.map((d) => d.id)).toEqual(['D-01']);
});

test('without the accepted entry the rebranded header fails too', async () => {
	const result = await parity({ path: '/' }, { directusUrl: directus, backofficeUrl: backoffice, accepted: [] });
	expect(result.differences.some((d) => d.location === 'x-powered-by')).toBe(true);
});
