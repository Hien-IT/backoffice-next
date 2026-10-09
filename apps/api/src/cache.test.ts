import { useEnv } from '@backoffice/env';
import { beforeEach, expect, test, vi } from 'vitest';
import { _resetCache, getCache } from './cache.js';
import { useLogger } from './logger/index.js';
import { runShutdownTasks } from './shutdown.js';

vi.mock('@backoffice/env');
vi.mock('./logger/index.js');

const logger = { warn: vi.fn() };

beforeEach(() => {
	vi.clearAllMocks();
	_resetCache();
	vi.mocked(useLogger).mockReturnValue(logger as any);
});

test('no cache when CACHE_ENABLED is false', () => {
	vi.mocked(useEnv).mockReturnValue({ CACHE_ENABLED: false });
	expect(getCache().cache).toBeNull();
});

test('memory cache with CACHE_NAMESPACE and CACHE_TTL; set then delete works; reused', async () => {
	vi.mocked(useEnv).mockReturnValue({
		CACHE_ENABLED: true,
		CACHE_STORE: 'memory',
		CACHE_NAMESPACE: 'system-cache',
		CACHE_TTL: '5m',
	});
	const { cache } = getCache();
	expect(cache!.namespace).toBe('system-cache');
	expect(cache!.ttl).toBe(300_000);
	await cache!.set('directus-health-abcde', true, 5);
	expect(await cache!.get('directus-health-abcde')).toBe(true);
	await cache!.delete('directus-health-abcde');
	expect(await cache!.get('directus-health-abcde')).toBeUndefined();
	expect(getCache().cache).toBe(cache);
	await runShutdownTasks();
});

test('redis store errors are logged with the [cache] prefix', async () => {
	vi.mocked(useEnv).mockReturnValue({
		CACHE_ENABLED: true,
		CACHE_STORE: 'redis',
		CACHE_NAMESPACE: 'ns',
		CACHE_TTL: '5m',
		REDIS: 'redis://127.0.0.1:1',
	});
	const { cache } = getCache();
	cache!.emit('error', new Error('connect ECONNREFUSED'));
	expect(logger.warn).toHaveBeenCalledWith(expect.any(Error), '[cache] Error: connect ECONNREFUSED');
	await runShutdownTasks();
});
