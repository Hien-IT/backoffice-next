// Feature 002, FR-024 and US4.5 (removes D-20): with Redis down, a process with the schema in memory keeps serving;
// with an empty schema cache the lock step fails after the ioredis retries and both answer 500. Both log the errors
// of their Keyv caches with the same prefixes. Runs on the cache-config pair, which has CACHE_ENABLED=false so the
// response cache (feature 005) does not touch Redis on these requests.
import { afterAll, describe, expect, it } from 'vitest';
import { logs, redisDown, redisUp } from '../docker.js';
import { assertParity, parity } from '../parity.js';
import { profileUrls } from '../profiles.js';
import { closeRedis, redis } from '../redis.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';
const pair = profileUrls('cache-config');
const CHANNEL = 'parity:bus:schemaChanged';
let subscribers = 0;

const numsub = async () => Number(((await redis().pubsub('NUMSUB', CHANNEL)) as [string, number])[1]);

async function bothAnswer(): Promise<void> {
	for (let i = 0; i < 60; i++) {
		const statuses = await Promise.all(
			[pair!.directusUrl!, pair!.backofficeUrl!].map((url) =>
				fetch(new URL('/server/info', url)).then(
					(r) => r.status,
					() => 0,
				),
			),
		);
		if (statuses.every((s) => s === 200)) return;
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}

describe.runIf(suite === 'full' && pair)('Redis down (FR-024, profile cache-config)', () => {
	afterAll(async () => {
		await redisUp();
		await bothAnswer();
		await closeRedis();
	}, 120_000);

	it('schema in memory: both keep answering', { timeout: 120_000 }, async () => {
		await parity({ path: '/server/info' }, pair);
		subscribers = await numsub();
		redisDown();

		try {
			const result = await parity({ path: '/server/info', timeoutMs: 60_000 }, pair);
			assertParity(result);
			expect(result.backoffice.status).toBe(200);
		} finally {
			await redisUp();
			await bothAnswer();
		}
	});

	it('empty schema cache: both answer 500 once the lock step fails', { timeout: 180_000 }, async () => {
		// The apps answer from memory before their bus subscribers are back after the previous case: wait for them, or
		// the message is lost and the schema stays.
		for (let i = 0; i < 60 && (await numsub()) < subscribers; i++) await new Promise((r) => setTimeout(r, 500));
		await redis().publish(CHANNEL, '{}');
		await new Promise((resolve) => setTimeout(resolve, 300));
		redisDown();

		try {
			const result = await parity({ path: '/server/info', timeoutMs: 90_000 }, pair);
			assertParity(result);
			expect(result.backoffice.status).toBe(500);
		} finally {
			await redisUp();
			await bothAnswer();
		}
	});

	it('both log the Keyv errors with the prefixes of Directus (D-20 removed)', () => {
		for (const service of ['directus-cache-config', 'backoffice-api-cache-config']) {
			const text = logs(service);
			for (const prefix of ['[system-cache]', '[deployment-cache]', '[lock-cache]']) {
				expect(text, `${service} ${prefix}`).toContain(prefix);
			}
		}
	});
});
