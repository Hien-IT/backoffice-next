// Feature 002, US3 and SC-003: with an empty schema cache, the process holding turn 1 of `schemaCache--preparing`
// builds the schema; the others wait for `schemaCache--done`, retry on timeout or {schema: null}, like Directus.
import { afterAll, describe, expect, it } from 'vitest';
import { assertParity, parity } from '../parity.js';
import { profileUrls } from '../profiles.js';
import { closeRedis, flushSharedCaches, newConnection, redis } from '../redis.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';
const DIRECTUS = process.env['DIRECTUS_URL']!;
const BACKOFFICE = process.env['BACKOFFICE_URL']!;
const BACKOFFICE_2 = process.env['BACKOFFICE_URL_2'];
const LOCK = 'directus:lock:schemaCache--preparing';
const DONE = 'directus:bus:schemaCache--done';

/** Counts the `schemaCache--done` messages (one per build) published while `fn` runs. */
async function countBuilds(fn: () => Promise<unknown>, channel = DONE): Promise<number> {
	const sub = newConnection();
	let builds = 0;
	sub.on('messageBuffer', () => builds++);
	await sub.subscribe(channel);

	try {
		await fn();
		await new Promise((resolve) => setTimeout(resolve, 300));
		return builds;
	} finally {
		sub.disconnect();
	}
}

const info = async (url: string) => (await fetch(new URL('/server/info', url))).status;

/** Waits until a process subscribed to `channel`, i.e. waits for another process to build the schema. */
async function waitingOn(channel: string): Promise<void> {
	for (let i = 0; i < 100; i++) {
		if (((await redis().pubsub('NUMSUB', channel)) as [string, number])[1] >= 1) return;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}

	throw new Error(`nobody waits on ${channel}`);
}

describe.runIf(suite === 'full' && BACKOFFICE_2)('schema built once (US3, profile multi)', () => {
	afterAll(async () => {
		await redis().unlink(LOCK);
		await closeRedis();
	});

	it('SC-003: 20 concurrent requests on 3 processes while one builds → exactly one build; then none', async () => {
		await redis().unlink(LOCK);
		await flushSharedCaches();
		const urls = [DIRECTUS, BACKOFFICE, BACKOFFICE_2!];

		const builds = await countBuilds(async () => {
			const first = info(BACKOFFICE);
			const others = Array.from({ length: 19 }, (_, i) => info(urls[i % urls.length]!));
			expect(await Promise.all([first, ...others])).toEqual(Array(20).fill(200));
		});
		expect(builds).toBe(1);

		// Every process now holds the schema: sequential requests build nothing more (at most one build each)
		expect(await countBuilds(async () => Promise.all(urls.map(info)))).toBe(0);
	});

	it.each([
		['Directus', DIRECTUS],
		['Backoffice', BACKOFFICE],
	])('%s: after {schema: null} from the building process, the waiting process builds it itself', async (_, url) => {
		await flushSharedCaches();
		await redis().set(LOCK, 1);

		const builds = await countBuilds(async () => {
			const response = info(url);
			await waitingOn(DONE);
			await redis().unlink(LOCK);
			await redis().publish(DONE, '{"schema":null}');
			expect(await response).toBe(200);
		});

		// The null message, then the build of the process that was waiting
		expect(builds).toBe(2);
	});
});

describe.runIf(suite === 'full' && profileUrls('cache-config'))(
	'stuck or worn-out lock (US3, profile cache-config, CACHE_SCHEMA_SYNC_TIMEOUT=1000)',
	() => {
		const PAIR_LOCK = 'parity:lock:schemaCache--preparing';

		afterAll(async () => {
			await redis().unlink(PAIR_LOCK);
			await closeRedis();
		});

		it('a lock nobody releases: both answer 500 after three waits', { timeout: 60_000 }, async () => {
			await flushSharedCaches({ busNs: 'parity:bus', permNs: 'parity-permissions' });
			await redis().set(PAIR_LOCK, 1);

			try {
				const result = await parity({ path: '/server/info', timeoutMs: 30_000 }, profileUrls('cache-config'));
				assertParity(result);
				expect(result.backoffice.status).toBe(500);
			} finally {
				await redis().unlink(PAIR_LOCK);
			}
		});

		it('a lock at CACHE_SCHEMA_MAX_ITERATIONS is deleted, the retry builds: both answer 200', async () => {
			await flushSharedCaches({ busNs: 'parity:bus', permNs: 'parity-permissions' });
			await redis().set(PAIR_LOCK, 99);

			const result = await parity({ path: '/server/info', timeoutMs: 30_000 }, profileUrls('cache-config'));
			assertParity(result);
			expect(result.backoffice.status).toBe(200);
		});
	},
);
