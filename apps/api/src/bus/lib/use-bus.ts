// Ported from directus/api/src/bus/lib/use-bus.ts
import { useEnv } from '@backoffice/env';
import { type Bus, createBus } from '@backoffice/memory';
import { redisConfigAvailable, useRedis } from '../../redis/index.js';
import { onServerShutdown } from '../../shutdown.js';

export const _cache: { bus: Bus | undefined } = {
	bus: undefined,
};

/**
 * Returns globally shared message bus. If Redis is available, will use a redis-driven pub/sub bus.
 * Otherwise will default to a local-only bus.
 */
export const useBus = () => {
	if (_cache.bus) {
		return _cache.bus;
	}

	if (redisConfigAvailable()) {
		const env = useEnv();

		_cache.bus = createBus({
			type: 'redis',
			redis: useRedis(),
			namespace: (env['REDIS_BUS_NAMESPACE'] as string) ?? 'directus:bus',
		});

		// Backoffice: close the subscriber connection on shutdown (Principle VII, research R6)
		const bus = _cache.bus;
		onServerShutdown(() => bus.disconnect());
	} else {
		_cache.bus = createBus({ type: 'local' });
	}

	return _cache.bus;
};
