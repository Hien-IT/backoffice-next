// Ported from directus/api/src/cache.ts: getCache() with its five Keyv instances, clearSystemCache, the
// `schemaChanged` subscription and the in-memory schema cache (feature 002). flushCaches, set/getSystemCache and
// set/getCacheValue* come with their first caller (005, 006; research R3).
// Backoffice: env is read when a function first runs, not at module load, so the subscription is made by
// subscribeSchemaChanged() from createApp(); Redis-backed instances are disconnected on shutdown (Principle VII).
import { createRequire } from 'node:module';
import { useEnv } from '@backoffice/env';
import type { SchemaOverview } from '@backoffice/types';
import Keyv, { type KeyvOptions } from 'keyv';
import { useBus } from './bus/index.js';
import { useLogger } from './logger/index.js';
import { clearCache as clearPermissionCache } from './permissions/cache.js';
import { redisConfigAvailable } from './redis/index.js';
import { onServerShutdown } from './shutdown.js';
import { freezeSchema, unfreezeSchema } from './utils/freeze-schema.js';
import { getConfigFromEnv } from './utils/get-config-from-env.js';
import { getMilliseconds } from './utils/get-milliseconds.js';
import { validateEnv } from './utils/validate-env.js';

const require = createRequire(import.meta.url);

let cache: Keyv | null = null;
let systemCache: Keyv | null = null;
let deploymentCache: Keyv | null = null;
let lockCache: Keyv | null = null;

let localSchemaCache: Keyv | null = null;
let memorySchemaCache: Readonly<SchemaOverview> | null = null;
let messengerSubscribed = false;

type Store = 'memory' | 'redis';

interface CacheMessage {
	autoPurgeCache: boolean | undefined;
}

/** The `schemaChanged` handler of Directus' cache.ts, registered once per process when Redis is configured. */
export function subscribeSchemaChanged(): void {
	if (!redisConfigAvailable() || messengerSubscribed) return;

	messengerSubscribed = true;
	const env = useEnv();

	useBus().subscribe<CacheMessage>('schemaChanged', async (opts) => {
		if (env['CACHE_STORE'] === 'memory' && env['CACHE_AUTO_PURGE'] && cache && opts?.['autoPurgeCache'] !== false) {
			await cache.clear();
		}

		await localSchemaCache?.clear();
		memorySchemaCache = null;
	});
}

export function getCache(): {
	cache: Keyv | null;
	systemCache: Keyv;
	deploymentCache: Keyv;
	localSchemaCache: Keyv;
	lockCache: Keyv;
} {
	const env = useEnv();
	const logger = useLogger();

	if (env['CACHE_ENABLED'] === true && cache === null) {
		validateEnv(['CACHE_NAMESPACE', 'CACHE_TTL', 'CACHE_STORE']);
		cache = getKeyvInstance(env['CACHE_STORE'] as Store, getMilliseconds(env['CACHE_TTL']));
		cache.on('error', (err) => logger.warn(err, `[cache] ${err}`));
	}

	if (systemCache === null) {
		systemCache = getKeyvInstance(env['CACHE_STORE'] as Store, getMilliseconds(env['CACHE_SYSTEM_TTL']), '_system');
		systemCache.on('error', (err) => logger.warn(err, `[system-cache] ${err}`));
	}

	if (deploymentCache === null) {
		const ttl = getMilliseconds(env['CACHE_DEPLOYMENT_TTL']) || 5000; // Default 5s
		deploymentCache = getKeyvInstance(env['CACHE_STORE'] as Store, ttl, '_deployment');
		deploymentCache.on('error', (err) => logger.warn(err, `[deployment-cache] ${err}`));
	}

	if (localSchemaCache === null) {
		localSchemaCache = getKeyvInstance('memory', getMilliseconds(env['CACHE_SYSTEM_TTL']), '_schema');
		localSchemaCache.on('error', (err) => logger.warn(err, `[schema-cache] ${err}`));
	}

	if (lockCache === null) {
		lockCache = getKeyvInstance(env['CACHE_STORE'] as Store, undefined, '_lock');
		lockCache.on('error', (err) => logger.warn(err, `[lock-cache] ${err}`));
	}

	return { cache, systemCache, deploymentCache, localSchemaCache, lockCache };
}

export async function clearSystemCache(opts?: {
	forced?: boolean | undefined;
	autoPurgeCache?: false | undefined;
}): Promise<void> {
	const { systemCache, localSchemaCache, lockCache } = getCache();

	// Flush system cache when forced or when system cache lock not set
	if (opts?.forced || !(await lockCache.get('system-cache-lock'))) {
		await lockCache.set('system-cache-lock', true, 10000);
		await systemCache.clear();
		await lockCache.delete('system-cache-lock');
	}

	await localSchemaCache.clear();
	memorySchemaCache = null;

	// Since a lot of cached permission function rely on the schema it needs to be cleared as well
	await clearPermissionCache();

	useBus().publish<CacheMessage>('schemaChanged', { autoPurgeCache: opts?.autoPurgeCache });
}

export function setMemorySchemaCache(schema: SchemaOverview) {
	if (Object.isFrozen(schema)) {
		memorySchemaCache = schema;
	} else {
		memorySchemaCache = freezeSchema(schema);
	}
}

export function getMemorySchemaCache(): Readonly<SchemaOverview> | undefined {
	const env = useEnv();

	if (env['CACHE_SCHEMA_FREEZE_ENABLED']) {
		return memorySchemaCache ?? undefined;
	} else if (memorySchemaCache) {
		return unfreezeSchema(memorySchemaCache);
	}

	return undefined;
}

/** Test helper. */
export function _resetCache(): void {
	cache = null;
	systemCache = null;
	deploymentCache = null;
	lockCache = null;
	localSchemaCache = null;
	memorySchemaCache = null;
	messengerSubscribed = false;
}

function getKeyvInstance(store: Store, ttl: number | undefined, namespaceSuffix?: string): Keyv {
	let instance: Keyv;

	switch (store) {
		case 'redis':
			instance = new Keyv(getConfig('redis', ttl, namespaceSuffix));
			// Backoffice: each Redis-backed Keyv opens its own connection; close it on shutdown (Principle VII)
			onServerShutdown(() => instance.disconnect());
			return instance;
		case 'memory':
		default:
			return new Keyv(getConfig('memory', ttl, namespaceSuffix));
	}
}

function getConfig(store: Store = 'memory', ttl: number | undefined, namespaceSuffix = ''): KeyvOptions {
	const env = useEnv();

	const config: KeyvOptions = {
		namespace: `${env['CACHE_NAMESPACE']}${namespaceSuffix}`,
		...(ttl && { ttl }),
	};

	if (store === 'redis') {
		const { default: KeyvRedis } = require('@keyv/redis');
		config.store = new KeyvRedis(env['REDIS'] || getConfigFromEnv('REDIS'), { useRedisSets: false });
	}

	return config;
}
