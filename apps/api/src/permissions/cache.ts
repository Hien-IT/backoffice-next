// Ported from directus/api/src/permissions/cache.ts
// Backoffice: the config is computed on first use instead of at module load (env read in functions, as in 001),
// and the multi cache closes its bus connection on shutdown (Principle VII, research R6).
import { useEnv } from '@backoffice/env';
import { type Cache, type CacheConfig, CacheMulti, createCache } from '@backoffice/memory';
import { redisConfigAvailable, useRedis } from '../redis/index.js';
import { onServerShutdown } from '../shutdown.js';
import { getMilliseconds } from '../utils/get-milliseconds.js';

let cache: Cache | undefined;

function getConfig(): CacheConfig {
	const localOnly = redisConfigAvailable() === false;
	const env = useEnv();
	const ttl = getMilliseconds(env['CACHE_SYSTEM_TTL']);

	return localOnly
		? {
				type: 'local',
				maxKeys: 500,
			}
		: {
				type: 'multi',
				redis: {
					namespace: (env['REDIS_PERMISSIONS_NAMESPACE'] as string) ?? 'permissions',
					redis: useRedis(),
					...(ttl !== undefined ? { ttl } : {}),
				},
				local: {
					maxKeys: 100,
				},
			};
}

export function useCache(): Cache {
	if (cache) return cache;

	const created = createCache(getConfig());
	if (created instanceof CacheMulti) onServerShutdown(() => created.disconnect());
	cache = created;

	return cache;
}

export function clearCache() {
	const cache = useCache();
	return cache.clear();
}

/** Test helper. */
export function _resetCache(): void {
	cache = undefined;
}
