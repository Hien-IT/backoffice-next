import { useEnv } from '@backoffice/env';
import { CacheMulti, createCache } from '@backoffice/memory';
import { beforeEach, expect, test, vi } from 'vitest';
import { redisConfigAvailable, useRedis } from '../redis/index.js';
import { onServerShutdown } from '../shutdown.js';
import { _resetCache, clearCache, useCache } from './cache.js';

vi.mock('@backoffice/env');
vi.mock('../redis/index.js');
vi.mock('../shutdown.js');
vi.mock('@backoffice/memory', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@backoffice/memory')>();
	return { ...actual, createCache: vi.fn(actual.createCache) };
});

beforeEach(() => {
	vi.clearAllMocks();
	_resetCache();
	vi.mocked(useEnv).mockReturnValue({});
});

test('without Redis: a local cache of 500 keys, created once', () => {
	vi.mocked(redisConfigAvailable).mockReturnValue(false);
	const cache = useCache();
	expect(createCache).toHaveBeenCalledWith({ type: 'local', maxKeys: 500 });
	expect(useCache()).toBe(cache);
	expect(onServerShutdown).not.toHaveBeenCalled();
});

test('with Redis: multi cache, namespace REDIS_PERMISSIONS_NAMESPACE ?? permissions, TTL CACHE_SYSTEM_TTL', () => {
	const redis = {
		defineCommand: vi.fn(),
		duplicate: vi.fn(() => ({ on: vi.fn(), subscribe: vi.fn(async () => {}) })),
	} as any;
	vi.mocked(redisConfigAvailable).mockReturnValue(true);
	vi.mocked(useRedis).mockReturnValue(redis);

	vi.mocked(useEnv).mockReturnValue({ CACHE_SYSTEM_TTL: '10m' });
	expect(useCache()).toBeInstanceOf(CacheMulti);
	expect(createCache).toHaveBeenLastCalledWith({
		type: 'multi',
		redis: { namespace: 'permissions', redis, ttl: 600_000 },
		local: { maxKeys: 100 },
	});
	expect(onServerShutdown).toHaveBeenCalledOnce();

	_resetCache();
	vi.mocked(useEnv).mockReturnValue({ REDIS_PERMISSIONS_NAMESPACE: 'perm-ns' });
	useCache();
	expect(createCache).toHaveBeenLastCalledWith({
		type: 'multi',
		redis: { namespace: 'perm-ns', redis },
		local: { maxKeys: 100 },
	});
});

test('clearCache clears the cache', async () => {
	vi.mocked(redisConfigAvailable).mockReturnValue(false);
	await useCache().set('k', 1);
	await clearCache();
	expect(await useCache().get('k')).toBeUndefined();
});

test('FR-084: without Redis, clearSystemCache of this process clears the local cache and tells the local bus', async () => {
	vi.mocked(redisConfigAvailable).mockReturnValue(false);
	vi.mocked(useEnv).mockReturnValue({ CACHE_STORE: 'memory', CACHE_NAMESPACE: 'ns' });

	const { clearSystemCache } = await import('../cache.js');
	const { useBus } = await import('../bus/index.js');
	const messages: unknown[] = [];
	await useBus().subscribe('schemaChanged', async (message: unknown) => void messages.push(message));

	await useCache().set('k', 1);
	await clearSystemCache();

	expect(await useCache().get('k')).toBeUndefined();
	expect(messages).toEqual([{ autoPurgeCache: undefined }]);
});
