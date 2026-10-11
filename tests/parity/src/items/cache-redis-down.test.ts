// Feature 005, US3 (FR-016, CHK012): CACHE_ENABLED=true at the cache-redis pair, whose Redis (redis-cache, response
// cache, bus, permissions cache) stops. Compared like FR-085 of 004 (src/redis-down.test.ts): the same status and
// error code at both apps, or neither answers within 15 seconds; the same `[cache]` warning in the logs; times are
// only recorded. Each app is measured alone: warm read, Redis down, read, Redis up.
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cacheRedisPort } from '../config.js';
import { adminToken, appRequest } from '../directus-api.js';
import { compose, logs, redisDown, redisUp } from '../docker.js';
import { capture, type Captured } from '../parity.js';
import { profileUrls } from '../profiles.js';

const run = Math.random().toString(16).slice(2, 10);
const COLLECTION = `parity_cache_down_${run}`;
const SERVICES = { directus: 'directus-cache-redis', backoffice: 'backoffice-api-cache-redis' } as const;

/**
 * Like flushSharedCaches() of src/redis.ts on the pair's own Redis and namespaces (env/profile-cache-redis.env): a
 * permissions cache entry stays in the memory of the process that wrote it last (004, FR-085), so each app is measured
 * right after it alone filled the shared caches.
 */
async function flushPair() {
	const r = new Redis(cacheRedisPort, '127.0.0.1', { maxRetriesPerRequest: 3 });

	try {
		await r.publish(
			'parity-cache-redis-permissions:multi-cache',
			JSON.stringify({ type: 'clear', origin: 'parity-test' }),
		);
		const keys = [
			...(await r.keys('parity-cache-redis-permissions:*')),
			...(await r.keys('sets:namespace:parity-cache-redis:*')),
		];
		if (keys.length) await r.unlink(...keys);
		await r.publish('parity-cache-redis:bus:schemaChanged', '{}');
		await new Promise((resolve) => setTimeout(resolve, 200));
	} finally {
		r.disconnect();
	}
}

describe.runIf(profileUrls('cache-redis'))('response cache with its Redis down (cache-redis pair)', () => {
	const urls = () => ({
		directus: profileUrls('cache-redis')!.directusUrl!,
		backoffice: profileUrls('cache-redis')!.backofficeUrl!,
	});
	const path = `/items/${COLLECTION}?limit=1`;
	let token: string;

	beforeAll(async () => {
		token = await adminToken('directus');
		await appRequest(
			'directus',
			'POST',
			'/collections',
			{
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
				],
			},
			urls().directus,
		);
		await appRequest('directus', 'POST', `/items/${COLLECTION}`, { title: 'a' }, urls().directus);
		await appRequest('directus', 'POST', '/utils/cache/clear?system', undefined, urls().directus);
	}, 120_000);

	/** /server/ping within 3 seconds. */
	const alive = (url: string) =>
		fetch(new URL('/server/ping', url), { signal: AbortSignal.timeout(3000) }).then(
			(r) => r.ok,
			() => false,
		);

	/** R-10 may stop a process: restart the pair's services that do not answer, then wait for both (120 s at most). */
	async function revive() {
		for (const app of ['directus', 'backoffice'] as const) {
			if (!(await alive(urls()[app]))) compose('restart', SERVICES[app]);
		}

		for (let i = 0; i < 60; i++) {
			if ((await alive(urls().directus)) && (await alive(urls().backoffice))) return;
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}

	afterAll(async () => {
		await redisUp('redis-cache');
		await revive();
		await appRequest('directus', 'DELETE', `/collections/${COLLECTION}`, undefined, urls().directus);
	}, 300_000);

	async function measure(app: 'directus' | 'backoffice') {
		const read = () =>
			capture(urls()[app], {
				path,
				headers: { authorization: `Bearer ${token}`, 'cache-control': 'max-age=0' },
				timeoutMs: 15_000,
			});

		await flushPair();
		await read();
		redisDown('redis-cache');
		const started = Date.now();

		try {
			const down = await read();
			return { down, ms: Date.now() - started };
		} finally {
			await redisUp('redis-cache');
			// ioredis reconnects with a backoff: wait until the pair answers from Redis again.
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
	}

	it('a read with Redis down: same status and code, the same warning; MISS then HIT once it is back', async () => {
		const results: Record<string, { down: Captured; ms: number }> = {};
		for (const app of ['directus', 'backoffice'] as const) results[app] = await measure(app);

		const code = (c: Captured) => (c.json as any)?.errors?.[0]?.extensions?.code;
		const summary = (app: string) => [results[app]!.down.status, code(results[app]!.down)];
		// eslint-disable-next-line no-console -- FR-016 measurement, read from the CI log
		console.info(
			'[cache-redis-down]',
			JSON.stringify(
				Object.fromEntries(
					Object.entries(results).map(([a, r]) => [a, { status: r.down.status, code: code(r.down), ms: r.ms }]),
				),
			),
		);

		expect(summary('backoffice')).toEqual(summary('directus'));

		for (const app of ['directus', 'backoffice'] as const) {
			const warned = logs(SERVICES[app]).includes("[cache] Couldn't read key");
			expect(warned, `${app} log`).toBe(logs(SERVICES.directus).includes("[cache] Couldn't read key"));
		}

		for (const app of ['directus', 'backoffice'] as const) {
			const first = await capture(urls()[app], {
				path: `${path}&fields=id`,
				headers: { authorization: `Bearer ${token}`, 'cache-control': 'max-age=0' },
			});
			const second = await capture(urls()[app], {
				path: `${path}&fields=id`,
				headers: { authorization: `Bearer ${token}`, 'cache-control': 'max-age=0' },
			});
			expect([first.status, second.status]).toEqual([200, 200]);
			expect([first.headers['x-cache-status'], second.headers['x-cache-status']]).toEqual([
				app === 'directus' ? 'MISS' : 'HIT',
				'HIT',
			]);
		}
	}, 180_000);

	it('R-10: a write with Redis down answers like Directus; the rejected publish is logged, both processes keep running', async () => {
		const outcome: Record<string, { status: number; alive: boolean; rejected: boolean }> = {};

		for (const app of ['directus', 'backoffice'] as const) {
			const before = logs(SERVICES[app]).length;
			// Same state at both apps: shared caches emptied, then schema, permissions and the collection read once.
			await flushPair();
			await capture(urls()[app], { path, headers: { authorization: `Bearer ${token}`, 'cache-control': 'max-age=0' } });
			redisDown('redis-cache');

			try {
				const write = await capture(urls()[app], {
					method: 'POST',
					path: `/items/${COLLECTION}`,
					body: { title: `r10 ${app}` },
					headers: { authorization: `Bearer ${token}` },
					timeoutMs: 20_000,
				});

				// ioredis rejects the queued PUBLISH after maxRetriesPerRequest (20) reconnections, about 10 s.
				await new Promise((resolve) => setTimeout(resolve, 30_000));
				const after = logs(SERVICES[app]).slice(before);

				// T050: the cache and bus warnings of the new app during the outage carry no token and no payload.
				if (app === 'backoffice') {
					expect(after).not.toContain(token);
					expect(after).not.toContain(`r10 ${app}`);
				}

				outcome[app] = {
					status: write.status,
					alive: await alive(urls()[app]),
					rejected: /MaxRetriesPerRequest|unhandled/i.test(after),
				};
			} finally {
				await redisUp('redis-cache');
				await revive();
			}
		}

		// eslint-disable-next-line no-console -- R-10 measurement, read from the CI log
		console.info('[R-10]', JSON.stringify(outcome));
		expect(outcome['backoffice']!.status).toBe(outcome['directus']!.status);
		expect(outcome['backoffice']!.rejected).toBe(outcome['directus']!.rejected);
		// Directus runs under pm2-runtime, which logs the unhandled rejection and keeps the process (unhandled-rejection.ts).
		expect(outcome['backoffice']!.alive).toBe(outcome['directus']!.alive);
	}, 300_000);
});
