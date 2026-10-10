// Ported from directus/api/src/cache.ts: getCache() with its five Keyv instances and the in-memory schema cache
// (feature 002). clearSystemCache and the `schemaChanged` subscription come with T025. flushCaches,
// set/getSystemCache and set/getCacheValue* come with their first caller (005, 006; research R3).
// Backoffice: env is read when getCache() first runs, not at module load, and Redis-backed instances are
// disconnected on shutdown (Principle VII).
import { createRequire } from 'node:module';
import { useEnv } from '@backoffice/env';
import type { SchemaOverview } from '@backoffice/types';
import Keyv, { type KeyvOptions } from 'keyv';
import { useLogger } from './logger/index.js';
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

type Store = 'memory' | 'redis';

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
