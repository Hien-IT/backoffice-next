// Feature 005, US3 (FR-010 to FR-014, FR-042, contracts/cache.md): the response cache that both apps share. One app
// writes, the other reads: same key, same value, HIT both ways, purges seen across apps, and the cases where neither
// stores ($NOW, CACHE_VALUE_MAX_SIZE, /server/health). Fixtures are made through the Directus of the cache-redis pair
// and every pair's Directus clears its caches after (each pair has its own bus, so its apps reload the schema).
import { readFileSync } from 'node:fs';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cacheRedisPort, type Profile } from '../config.js';
import { adminToken, appRequest } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { profileUrls } from '../profiles.js';

const run = Math.random().toString(16).slice(2, 10);
const COLLECTION = `parity_cache_cross_${run}`;
const STATUS = 'x-cache-status';
const CACHE_PROFILES = ['cache-mem', 'cache-mem-purge', 'cache-redis', 'cache-redis-purge'] as const;

const vendorEnv = readFileSync(new URL(`../../env/${getDbsToTest()[0]}.env`, import.meta.url), 'utf8');
const PUBLIC_URL = vendorEnv.match(/^PUBLIC_URL=(.*)$/m)![1]!.trim();

type App = 'directus' | 'backoffice';
type Pair = { directus: string; backoffice: string; redis: () => Redis; ns: string };

const clients: Redis[] = [];
const client = (port: number) => {
	const r = new Redis(port, '127.0.0.1', { maxRetriesPerRequest: 3 });
	clients.push(r);
	return () => r;
};

const pairOf = (profile: Profile, port: number): Pair | undefined => {
	const urls = profileUrls(profile);
	if (!urls) return undefined;
	return { directus: urls.directusUrl!, backoffice: urls.backofficeUrl!, redis: client(port), ns: `parity-${profile}` };
};

const redisPair = pairOf('cache-redis', cacheRedisPort);
const purgePair = pairOf('cache-redis-purge', 6108);
const mainPair: Pair = {
	directus: process.env['DIRECTUS_URL']!,
	backoffice: process.env['BACKOFFICE_URL']!,
	redis: client(6108),
	// CACHE_NAMESPACE is not set in env/<vendor>.env: Directus' default.
	ns: 'system-cache',
};

let token: string;
const other = (app: App): App => (app === 'directus' ? 'backoffice' : 'directus');

async function call(
	base: string,
	path: string,
	init: { method?: string; headers?: Record<string, string>; body?: unknown; as?: string } = {},
) {
	const res = await fetch(new URL(path, base), {
		method: init.method ?? 'GET',
		headers: {
			authorization: `Bearer ${init.as ?? token}`,
			...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
			...init.headers,
		},
		...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
	});

	const text = await res.text();
	if (res.status >= 400 && init.method && init.method !== 'GET' && init.method !== 'HEAD') {
		throw new Error(`${init.method} ${path}: ${res.status} ${text}`);
	}

	return { status: res.status, cache: res.headers.get(STATUS), control: res.headers.get('cache-control'), text };
}

/** Response cache keys of a namespace (Keyv: sets:namespace:<ns>:<ns>:<hash>), without the 004 filter contexts. */
async function cacheKeys(pair: Pair): Promise<string[]> {
	const keys = await pair.redis().keys(`sets:namespace:${pair.ns}:${pair.ns}:*`);
	return keys.filter((k) => !k.includes('filter-context')).sort();
}

async function clearCache(pair: Pair) {
	const keys = await pair.redis().keys(`sets:namespace:${pair.ns}:*`);
	if (keys.length > 0) await pair.redis().unlink(...keys);
}

const setup = (path: string, method = 'POST', body?: unknown) =>
	appRequest('directus', method, path, body, redisPair?.directus ?? mainPair.directus);

async function clearEveryPair() {
	const bases = [mainPair.directus, ...CACHE_PROFILES.map((p) => profileUrls(p)?.directusUrl).filter(Boolean)];
	for (const base of bases) await appRequest('directus', 'POST', '/utils/cache/clear?system', undefined, base);
}

const created = { policies: [] as string[], users: [] as string[] };

beforeAll(async () => {
	token = await adminToken('directus');

	await setup('/collections', 'POST', {
		collection: COLLECTION,
		schema: {},
		meta: {},
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
			{ field: 'title', type: 'string' },
			{ field: 'published', type: 'timestamp' },
		],
	});

	// 30 rows of 40 characters: `limit=-1` is above CACHE_VALUE_MAX_SIZE=1kb of cache-redis, `limit=1` is not.
	await setup(
		`/items/${COLLECTION}`,
		'POST',
		Array.from({ length: 30 }, (_, i) => ({ title: `row ${i}`.padEnd(40, '.'), published: '2024-01-01T00:00:00Z' })),
	);

	await clearEveryPair();
}, 300_000);

afterAll(async () => {
	if (created.users.length) await setup('/users', 'DELETE', created.users);
	for (const id of created.policies) await setup(`/policies/${id}`, 'DELETE');
	await setup(`/collections/${COLLECTION}`, 'DELETE');
	await clearEveryPair();
	await Promise.all(clients.map((c) => c.quit()));
}, 300_000);

/** A user with one policy (read on the collection with `filter`), a static token, made through the pair's Directus. */
async function userWithPolicy(name: string, filter: Record<string, unknown> | null, ipAccess?: string[]) {
	const policy = (
		await setup('/policies', 'POST', { name: `${name} ${run}`, ...(ipAccess ? { ip_access: ipAccess } : {}) })
	).data.id;
	created.policies.push(policy);
	await setup('/permissions', 'POST', {
		policy,
		collection: COLLECTION,
		action: 'read',
		fields: ['*'],
		permissions: filter,
	});

	const userToken = `cache-cross-${name}-${run}`;
	const user = (await setup('/users', 'POST', { email: `cache-cross-${name}-${run}@example.com`, token: userToken }))
		.data.id;
	created.users.push(user);
	await setup('/access', 'POST', { user, policy });
	await clearEveryPair();
	return { policy, token: userToken };
}

describe.runIf(redisPair)('cache-redis pair (CACHE_AUTO_PURGE=false, CACHE_SKIP_ALLOWED=false, 1kb)', () => {
	const pair = () => redisPair!;

	it('one app writes the same key and the same value as the other (empty cache before each)', async () => {
		const path = `/items/${COLLECTION}?limit=2&sort=id`;
		const written: Record<App, { keys: string[]; value: string }> = {} as any;

		for (const app of ['directus', 'backoffice'] as const) {
			await clearCache(pair());
			expect((await call(pair()[app], path)).cache).toBe('MISS');
			const keys = await cacheKeys(pair());
			const value = (await pair()
				.redis()
				.get(keys.find((k) => !k.endsWith('__expires_at'))!))!;
			// Keyv stores the expiry time beside the compressed value.
			written[app] = { keys, value: value.replace(/"expires":\d+/, '"expires":<n>') };
		}

		expect(written.directus.keys).toHaveLength(2);
		expect(written.backoffice).toEqual(written.directus);
	});

	it('HIT across apps both ways, 20 requests, same body', async () => {
		for (let i = 0; i < 20; i++) {
			await clearCache(pair());
			const first: App = i % 2 === 0 ? 'directus' : 'backoffice';
			const path = `/items/${COLLECTION}?limit=${i + 1}&fields=id&sort=id`;

			const miss = await call(pair()[first], path);
			const hit = await call(pair()[other(first)], path);

			expect([miss.cache, hit.cache]).toEqual(['MISS', 'HIT']);
			expect(hit.text).toBe(miss.text);
		}
	});

	it.each(['directus', 'backoffice'] as const)(
		'a write at %s does not purge (CACHE_AUTO_PURGE=false)',
		async (writer) => {
			await clearCache(pair());
			const path = `/items/${COLLECTION}?limit=1`;
			await call(pair()[other(writer)], path);
			await call(pair()[writer], `/items/${COLLECTION}`, { method: 'POST', body: { title: 'no purge' } });
			expect((await call(pair()[other(writer)], path)).cache).toBe('HIT');
		},
	);

	it('Cache-Control: no-store is ignored (CACHE_SKIP_ALLOWED=false): HIT at both apps', async () => {
		await clearCache(pair());
		const path = `/items/${COLLECTION}?limit=1&fields=title`;
		await call(pair().directus, path);

		for (const app of ['directus', 'backoffice'] as const) {
			const res = await call(pair()[app], path, { headers: { 'cache-control': 'no-store' } });
			expect([res.cache, res.control]).toEqual(['HIT', expect.stringMatching(/^public|^private|max-age/)]);
		}
	});

	it('CACHE_VALUE_MAX_SIZE=1kb: a larger payload is never stored, a smaller one is', async () => {
		await clearCache(pair());

		for (const app of ['directus', 'backoffice', 'directus'] as const) {
			expect((await call(pair()[app], `/items/${COLLECTION}?limit=-1`)).cache).toBe('MISS');
		}

		expect(await cacheKeys(pair())).toEqual([]);
		await call(pair().backoffice, `/items/${COLLECTION}?limit=1&fields=id`);
		expect((await call(pair().directus, `/items/${COLLECTION}?limit=1&fields=id`)).cache).toBe('HIT');
	});

	it('Referer <PUBLIC_URL>/admin with CACHE_AUTO_PURGE=false: never read, still stored (no-store)', async () => {
		await clearCache(pair());
		const path = `/items/${COLLECTION}?limit=1&fields=published`;
		const referer = { referer: `${PUBLIC_URL}/admin/content/${COLLECTION}` };

		for (const app of ['directus', 'backoffice'] as const) {
			const res = await call(pair()[app], path, { headers: referer });
			expect([res.cache, res.control]).toEqual(['MISS', 'no-store']);
		}

		expect((await cacheKeys(pair())).length).toBe(2);
		expect((await call(pair().backoffice, path)).cache).toBe('HIT');
	});

	it('$NOW in the read permission: neither app stores', async () => {
		const user = await userWithPolicy('now', { published: { _lte: '$NOW' } });
		await clearCache(pair());

		for (const app of ['directus', 'backoffice', 'directus', 'backoffice'] as const) {
			const res = await call(pair()[app], `/items/${COLLECTION}?limit=1`, { as: user.token });
			expect([res.status, res.cache, res.control]).toEqual([200, 'MISS', 'no-cache']);
		}

		expect(await cacheKeys(pair())).toEqual([]);
	});

	it('a policy whose ip_access matches the client: the key has the IP, the same at both apps', async () => {
		const user = await userWithPolicy('ip', null);
		const path = `/items/${COLLECTION}?limit=1&fields=id,title`;

		await clearCache(pair());
		await call(pair().directus, path, { as: user.token });
		const withoutIp = await cacheKeys(pair());

		await setup(`/policies/${user.policy}`, 'PATCH', { ip_access: ['0.0.0.0/0', '::/0'] });
		await clearEveryPair();
		await clearCache(pair());

		expect((await call(pair().directus, path, { as: user.token })).cache).toBe('MISS');
		const withIp = await cacheKeys(pair());
		expect(withIp).toHaveLength(2);
		expect(withIp).not.toEqual(withoutIp);
		expect((await call(pair().backoffice, path, { as: user.token })).cache).toBe('HIT');
	});

	it('GET /server/health: never HIT, never stored, at either app', async () => {
		await clearCache(pair());

		for (const app of ['directus', 'backoffice', 'directus', 'backoffice'] as const) {
			const res = await call(pair()[app], '/server/health');
			expect([res.cache, res.control]).toEqual(['MISS', 'no-cache']);
		}

		expect(await cacheKeys(pair())).toEqual([]);
	});

	it('HEAD: not read, not stored, the same headers at both apps', async () => {
		await clearCache(pair());
		const path = `/items/${COLLECTION}?limit=1&fields=title,id`;
		await call(pair().directus, path);
		const heads = await Promise.all(
			(['directus', 'backoffice'] as const).map((app) => call(pair()[app], path, { method: 'HEAD' })),
		);

		expect(heads[1]).toEqual(heads[0]);
		expect(heads[0]!.cache).toBeNull();
	});

	it('a trailing slash is another key (CHK013), the same at both apps', async () => {
		await clearCache(pair());
		const path = `/items/${COLLECTION}?limit=1&fields=id,published`;
		const slashed = path.replace('?', '/?');

		await call(pair().directus, path);
		const statuses: string[] = [];

		for (const app of ['backoffice', 'directus'] as const) {
			const res = await call(pair()[app], slashed);
			statuses.push(`${res.status} ${res.cache}`);
		}

		expect(statuses).toEqual(['200 MISS', '200 HIT']);
	});
});

describe.runIf(purgePair)('cache-redis-purge pair (CACHE_AUTO_PURGE=true)', () => {
	const pair = () => purgePair!;

	it.each(['directus', 'backoffice'] as const)('a write at %s purges what the other app stored', async (writer) => {
		await clearCache(pair());
		const path = `/items/${COLLECTION}?limit=1&fields=id`;
		await call(pair()[other(writer)], path);
		expect((await call(pair()[other(writer)], path)).cache).toBe('HIT');

		await call(pair()[writer], `/items/${COLLECTION}`, { method: 'POST', body: { title: 'purge' } });
		expect((await call(pair()[other(writer)], path)).cache).toBe('MISS');
	});

	it('Referer <PUBLIC_URL>/admin with CACHE_AUTO_PURGE=true: read (the collection is not ignored)', async () => {
		await clearCache(pair());
		const path = `/items/${COLLECTION}?limit=2&fields=id`;
		await call(pair().directus, path);

		for (const app of ['directus', 'backoffice'] as const) {
			const res = await call(pair()[app], path, { headers: { referer: `${PUBLIC_URL}/admin/content/${COLLECTION}` } });
			expect([res.cache, res.control]).toEqual(['HIT', 'no-cache']);
		}
	});
});

describe('main pair (CACHE_SKIP_ALLOWED=true, research R4)', () => {
	it.each(['directus', 'backoffice'] as const)(
		'Cache-Control: no-store at %s skips the read but stores; the other app then gets HIT',
		async (first) => {
			await clearCache(mainPair);
			const path = `/items/${COLLECTION}?limit=3&fields=id`;
			const skipped = await call(mainPair[first], path, { headers: { 'cache-control': 'no-store' } });

			expect([skipped.cache, skipped.control]).toEqual(['MISS', 'no-store']);
			expect(await cacheKeys(mainPair)).toHaveLength(2);
			expect((await call(mainPair[other(first)], path)).cache).toBe('HIT');
		},
	);
});
