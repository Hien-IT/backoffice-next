// Feature 011, US5.3 (spec FR-004, R-31, contracts/parity.md §2): the response cache both apps share, for GraphQL. On
// the cache-redis-purge pair (Redis store, CACHE_AUTO_PURGE=true, CACHE_SKIP_ALLOWED=false, its own namespaces):
// a query answered by one app is a HIT at the other with the same body; mutations, answers with errors and requests
// with Cache-Control: no-store are not stored; a mutation purges the data cache. The documents use system data only,
// since this pair listens to its own bus (a collection made on the main pair is unknown to its schema cache).
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminToken } from '../directus-api.js';
import { capture } from '../parity.js';
import { profileUrls } from '../profiles.js';

const STATUS = 'x-cache-status';
const NS = 'parity-cache-redis-purge';
const pair = profileUrls('cache-redis-purge');
const redis = new Redis(6108, '127.0.0.1', { maxRetriesPerRequest: 3 });

let token: string;

const post = (base: string, query: string, headers: Record<string, string> = {}) =>
	capture(base, {
		method: 'POST',
		path: '/graphql/system',
		headers: { authorization: `Bearer ${token}`, ...headers },
		body: { query },
	});

async function cacheKeys(): Promise<number> {
	let count = 0;
	for await (const keys of redis.scanStream({ match: `sets:namespace:${NS}:*`, count: 500 })) count += keys.length;
	return count;
}

async function flush() {
	for await (const keys of redis.scanStream({ match: `sets:namespace:${NS}:*`, count: 500 })) {
		if ((keys as string[]).length > 0) await redis.unlink(...(keys as string[]));
	}
}

beforeAll(async () => {
	token = await adminToken('directus');
});

afterAll(async () => {
	await redis.quit();
});

describe.runIf(Boolean(pair))('response cache of /graphql (profile cache-redis-purge)', () => {
	it.each([
		['directus', 'backoffice'],
		['backoffice', 'directus'],
	] as const)('a query answered by %s is a HIT at %s with the same body and headers', async (first, second) => {
		await flush();
		const query = `{ roles(sort: ["name"], limit: 2) { name } server_ping }`;
		const url = (app: string) => (app === 'directus' ? pair!.directusUrl! : pair!.backofficeUrl!);

		const miss = await post(url(first), query);
		const hit = await post(url(second), query);

		expect(miss.headers[STATUS]).toBe('MISS');
		expect(hit.headers[STATUS]).toBe('HIT');
		expect(hit.json).toEqual(miss.json);
		expect(hit.headers['vary']).toBe('Origin, Cache-Control');
	});

	it('not stored: a mutation, an answer with errors; Cache-Control: no-store is ignored here (CACHE_SKIP_ALLOWED=false)', async () => {
		for (const base of [pair!.directusUrl!, pair!.backofficeUrl!]) {
			await flush();

			await post(base, 'mutation { utils_random_string(length: 8) }');
			expect(await cacheKeys()).toBe(0);

			await post(base, '{ users_me { email } activity_by_id(id: "999999999") { id } }');
			const withErrors = await post(base, '{ users_me { email } activity_by_id(id: "999999999") { id } }');
			expect(withErrors.headers[STATUS]).toBe('MISS');

			await post(base, '{ server_ping }', { 'cache-control': 'no-store' });
			const again = await post(base, '{ server_ping }', { 'cache-control': 'no-store' });
			expect(again.headers[STATUS]).toBe('HIT');
		}
	});

	it('a mutation at one app purges the data cache the other app reads (CACHE_AUTO_PURGE)', async () => {
		await flush();
		const query = '{ settings { project_descriptor } }';

		await post(pair!.directusUrl!, query);
		expect((await post(pair!.backofficeUrl!, query)).headers[STATUS]).toBe('HIT');

		await post(
			pair!.backofficeUrl!,
			'mutation { update_settings(data: { project_descriptor: "graphql cache" }) { project_descriptor } }',
		);
		expect((await post(pair!.directusUrl!, query)).headers[STATUS]).toBe('MISS');

		await post(
			pair!.directusUrl!,
			'mutation { update_settings(data: { project_descriptor: null }) { project_descriptor } }',
		);
	});

	it('R-31: two documents that differ in white space only are two entries', async () => {
		await flush();
		await post(pair!.backofficeUrl!, '{ server_ping }');
		const one = await cacheKeys();
		await post(pair!.backofficeUrl!, '{  server_ping }');
		expect(await cacheKeys()).toBeGreaterThan(one);
	});
});
