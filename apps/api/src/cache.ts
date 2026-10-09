// Ported from directus/api/src/cache.ts (only the `cache` part of getCache(), used by the health check and
// metrics). System, deployment, lock and schema caches, the bus and setCacheValue come with feature 002 (D-20).
import { createRequire } from 'node:module';
import { useEnv } from '@backoffice/env';
import Keyv, { type KeyvOptions } from 'keyv';
import { useLogger } from './logger/index.js';
import { onServerShutdown } from './shutdown.js';
import { getConfigFromEnv } from './utils/get-config-from-env.js';
import { getMilliseconds } from './utils/get-milliseconds.js';
import { validateEnv } from './utils/validate-env.js';

const require = createRequire(import.meta.url);

let cache: Keyv | null = null;

type Store = 'memory' | 'redis';

export function getCache(): { cache: Keyv | null } {
	const env = useEnv();
	const logger = useLogger();

	if (env['CACHE_ENABLED'] === true && cache === null) {
		validateEnv(['CACHE_NAMESPACE', 'CACHE_TTL', 'CACHE_STORE']);
		cache = getKeyvInstance(env['CACHE_STORE'] as Store, getMilliseconds(env['CACHE_TTL']));
		cache.on('error', (err) => logger.warn(err, `[cache] ${err}`));

		const instance = cache;
		onServerShutdown(() => instance.disconnect());
	}

	return { cache };
}

/** Test helper. */
export function _resetCache(): void {
	cache = null;
}

function getKeyvInstance(store: Store, ttl: number | undefined, namespaceSuffix?: string): Keyv {
	switch (store) {
		case 'redis':
			return new Keyv(getConfig('redis', ttl, namespaceSuffix));
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
