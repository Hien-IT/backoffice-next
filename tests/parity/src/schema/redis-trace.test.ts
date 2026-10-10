// Feature 002, US4 (SC-004, FR-033): with custom CACHE_NAMESPACE and REDIS_*_NAMESPACE, Backoffice uses only keys and
// channels Directus uses with the same configuration (profile cache-config, env/profile-cache-config.env).
import { afterAll, describe, expect, it } from 'vitest';
import { directusRequest } from '../directus-api.js';
import { profileUrls } from '../profiles.js';
import {
	closeRedis,
	containerAddress,
	expandKeys,
	flushSharedCaches,
	redis,
	traceRedis,
	type TracedCommand,
} from '../redis.js';
import { clearSystemCacheIn } from './clear-system-cache.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';
const pair = profileUrls('cache-config');

const NS = { busNs: 'parity:bus', permNs: 'parity-permissions' };
// Connection set-up and subscriptions depend on when a process started, not on the request: compared separately.
const SESSION = new Set(['info', 'client', 'select', 'ping', 'quit', 'subscribe', 'unsubscribe', 'hello', 'auth']);

/** `<command> <key>` of the commands `service` sent while serving the same requests. */
async function commandsOf(service: string, url: string, clearSystemCache: () => Promise<void>): Promise<Set<string>> {
	await flushSharedCaches(NS);
	const address = containerAddress(service);

	const traced = await traceRedis(async () => {
		await fetch(new URL('/server/specs/oas', url));
		await redis().publish('parity:bus:schemaChanged', '{}');
		await new Promise((resolve) => setTimeout(resolve, 200));
		await fetch(new URL('/server/info', url));
		await clearSystemCache();
	});

	return new Set(
		traced.filter((c: TracedCommand) => c.client === address && !SESSION.has(c.command)).flatMap(expandKeys),
	);
}

describe.runIf(suite === 'full' && pair)('Redis keys and channels (US4, profile cache-config)', () => {
	afterAll(() => closeRedis());

	it('Backoffice uses a subset of the keys and channels of Directus, all in the configured namespaces', async () => {
		const directus = await commandsOf('directus-cache-config', pair!.directusUrl!, async () => {
			// POST /utils/cache/clear?system runs clearSystemCache({ forced: true }) (directus/api/src/services/utils.ts)
			await directusRequest('POST', '/utils/cache/clear?system', undefined, pair!.directusUrl);
		});
		const backoffice = await commandsOf('backoffice-api-cache-config', pair!.backofficeUrl!, async () => {
			clearSystemCacheIn('backoffice-api-cache-config', { forced: true });
		});

		expect([...backoffice].filter((c) => !directus.has(c))).toEqual([]);

		for (const commands of [directus, backoffice]) {
			const all = [...commands];
			expect(all).toContain('incrby parity:lock:schemaCache--preparing');
			expect(all).toContain('publish parity:bus:schemaCache--done');
			expect(all).toContain('publish parity:bus:schemaChanged');
			expect(all).toContain('publish parity-permissions:multi-cache');
			expect(all.some((c) => c.startsWith('set parity-permissions:policies-'))).toBe(true);
			expect(all).toContain('set sets:namespace:parity-cache-config_lock:parity-cache-config_lock:system-cache-lock');
			expect(all).toContain('keys sets:namespace:parity-cache-config_system:*');
			expect(all.filter((c) => / (directus:|permissions:|sets:namespace:system-cache)/.test(c))).toEqual([]);
		}
	});

	it('both subscribe to the configured schemaChanged and multi-cache channels', async () => {
		const counts = (await redis().pubsub('NUMSUB', 'parity:bus:schemaChanged', 'parity-permissions:multi-cache')) as (
			| string
			| number
		)[];

		expect(Number(counts[1])).toBeGreaterThanOrEqual(2);
		expect(Number(counts[3])).toBeGreaterThanOrEqual(2);
	});
});
