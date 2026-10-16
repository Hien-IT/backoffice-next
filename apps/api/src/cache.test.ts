import { useEnv } from '@backoffice/env';
import type { SchemaOverview } from '@backoffice/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useBus } from './bus/index.js';
import {
	_resetCache,
	clearSystemCache,
	flushCaches,
	getCache,
	getMemorySchemaCache,
	setMemorySchemaCache,
	subscribeSchemaChanged,
} from './cache.js';
import { useLogger } from './logger/index.js';
import { clearCache as clearPermissionCache } from './permissions/cache.js';
import { redisConfigAvailable } from './redis/index.js';
import { runShutdownTasks } from './shutdown.js';

vi.mock('@backoffice/env');
vi.mock('./logger/index.js');
vi.mock('./bus/index.js');
vi.mock('./permissions/cache.js');
vi.mock('./redis/index.js');

const bus = { publish: vi.fn(async () => {}), subscribe: vi.fn(async () => {}) };

const logger = { warn: vi.fn() };

beforeEach(() => {
	vi.clearAllMocks();
	_resetCache();
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(useBus).mockReturnValue(bus as any);
	vi.mocked(redisConfigAvailable).mockReturnValue(false);
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
	// Directus's health check sets a 5 ms TTL; a slow runner expired it before the get (CI run 38894817992).
	await cache!.set('directus-health-abcde', true, 60_000);
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

// Feature 002: the system, deployment, schema and lock caches (contracts/redis.md §5)
test('system, deployment, schema and lock caches use CACHE_NAMESPACE suffixes and their TTLs', () => {
	vi.mocked(useEnv).mockReturnValue({
		CACHE_ENABLED: false,
		CACHE_STORE: 'memory',
		CACHE_NAMESPACE: 'system-cache',
		CACHE_SYSTEM_TTL: '10m',
	});
	const { systemCache, deploymentCache, localSchemaCache, lockCache } = getCache();
	expect(systemCache.namespace).toBe('system-cache_system');
	expect(systemCache.ttl).toBe(600_000);
	expect(deploymentCache.namespace).toBe('system-cache_deployment');
	expect(deploymentCache.ttl).toBe(5000);
	expect(localSchemaCache.namespace).toBe('system-cache_schema');
	expect(localSchemaCache.ttl).toBe(600_000);
	expect(lockCache.namespace).toBe('system-cache_lock');
	expect(lockCache.ttl).toBeUndefined();
	expect(getCache().systemCache).toBe(systemCache);
});

test('CACHE_DEPLOYMENT_TTL sets the deployment cache TTL', () => {
	vi.mocked(useEnv).mockReturnValue({ CACHE_STORE: 'memory', CACHE_NAMESPACE: 'ns', CACHE_DEPLOYMENT_TTL: '30s' });
	expect(getCache().deploymentCache.ttl).toBe(30_000);
});

test('with CACHE_STORE=redis every cache but the schema cache uses Redis and logs with its prefix', async () => {
	vi.mocked(useEnv).mockReturnValue({
		CACHE_ENABLED: false,
		CACHE_STORE: 'redis',
		CACHE_NAMESPACE: 'ns',
		REDIS: 'redis://127.0.0.1:1',
	});
	const caches = getCache();
	expect(caches.localSchemaCache.opts.store).toBeInstanceOf(Map);

	for (const [name, prefix] of [
		['systemCache', 'system-cache'],
		['deploymentCache', 'deployment-cache'],
		['lockCache', 'lock-cache'],
	] as const) {
		expect(caches[name].opts.store).not.toBeInstanceOf(Map);
		caches[name].emit('error', new Error('down'));
		expect(logger.warn).toHaveBeenCalledWith(expect.any(Error), `[${prefix}] Error: down`);
	}

	caches.localSchemaCache.emit('error', new Error('down'));
	expect(logger.warn).toHaveBeenCalledWith(expect.any(Error), '[schema-cache] Error: down');
	await runShutdownTasks();
});

describe('memory schema cache', () => {
	const schema = (): SchemaOverview => ({
		collections: {
			a: {
				collection: 'a',
				primary: 'id',
				singleton: false,
				note: null,
				sortField: null,
				accountability: 'all',
				fields: {},
			},
		},
		relations: [],
	});

	test('empty until set', () => {
		vi.mocked(useEnv).mockReturnValue({});
		expect(getMemorySchemaCache()).toBeUndefined();
	});

	test('CACHE_SCHEMA_FREEZE_ENABLED: returns the same frozen object', () => {
		vi.mocked(useEnv).mockReturnValue({ CACHE_SCHEMA_FREEZE_ENABLED: true });
		setMemorySchemaCache(schema());
		const a = getMemorySchemaCache()!;
		expect(Object.isFrozen(a)).toBe(true);
		expect(Object.isFrozen(a.collections['a'])).toBe(true);
		expect(getMemorySchemaCache()).toBe(a);
	});

	test('freeze disabled (default): returns a mutable copy on every call', () => {
		vi.mocked(useEnv).mockReturnValue({ CACHE_SCHEMA_FREEZE_ENABLED: false });
		setMemorySchemaCache(schema());
		const a = getMemorySchemaCache()!;
		expect(Object.isFrozen(a)).toBe(false);
		expect(getMemorySchemaCache()).not.toBe(a);
		(a.collections['a'] as { note: string | null }).note = 'changed';
		expect(getMemorySchemaCache()!.collections['a']!.note).toBeNull();
	});

	test('keeps an already frozen schema as is', () => {
		vi.mocked(useEnv).mockReturnValue({ CACHE_SCHEMA_FREEZE_ENABLED: true });
		const frozen = Object.freeze(schema());
		setMemorySchemaCache(frozen);
		expect(getMemorySchemaCache()).toBe(frozen);
	});
});

// Feature 002: clearSystemCache and the schemaChanged handler (contracts/redis.md §3)
const overview = (): SchemaOverview => ({ collections: {}, relations: [] });

describe('clearSystemCache', () => {
	beforeEach(() => {
		vi.mocked(useEnv).mockReturnValue({ CACHE_STORE: 'memory', CACHE_NAMESPACE: 'ns' });
	});

	test('clears the system cache, the schema caches and the permissions cache, then publishes schemaChanged', async () => {
		const { systemCache, localSchemaCache, lockCache } = getCache();
		await systemCache.set('a', 1);
		await localSchemaCache.set('b', 2);
		setMemorySchemaCache(overview());
		const lockSet = vi.spyOn(lockCache, 'set');

		await clearSystemCache({ autoPurgeCache: false });

		expect(lockSet).toHaveBeenCalledWith('system-cache-lock', true, 10000);
		expect(await lockCache.get('system-cache-lock')).toBeUndefined();
		expect(await systemCache.get('a')).toBeUndefined();
		expect(await localSchemaCache.get('b')).toBeUndefined();
		expect(getMemorySchemaCache()).toBeUndefined();
		expect(clearPermissionCache).toHaveBeenCalledOnce();
		expect(bus.publish).toHaveBeenCalledWith('schemaChanged', { autoPurgeCache: false });
	});

	test('leaves the system cache alone while system-cache-lock is set, unless forced', async () => {
		const { systemCache, lockCache } = getCache();
		await systemCache.set('a', 1);
		await lockCache.set('system-cache-lock', true);

		await clearSystemCache();
		expect(await systemCache.get('a')).toBe(1);
		expect(bus.publish).toHaveBeenCalledWith('schemaChanged', { autoPurgeCache: undefined });

		await clearSystemCache({ forced: true });
		expect(await systemCache.get('a')).toBeUndefined();
	});
});

// Feature 006: flushCaches after a schema apply (directus/api/src/cache.ts:91)
describe('flushCaches', () => {
	test('clears the system cache (forced as asked) and the data cache', async () => {
		vi.mocked(useEnv).mockReturnValue({
			CACHE_ENABLED: true,
			CACHE_STORE: 'memory',
			CACHE_NAMESPACE: 'ns',
			CACHE_TTL: '5m',
		});
		const { cache, systemCache, lockCache } = getCache();
		await cache!.set('data', 1);
		await systemCache.set('a', 1);
		await lockCache.set('system-cache-lock', true);

		await flushCaches(true);

		expect(await cache!.get('data')).toBeUndefined();
		expect(await systemCache.get('a')).toBeUndefined();
		expect(bus.publish).toHaveBeenCalledWith('schemaChanged', { autoPurgeCache: undefined });
	});

	test('works without a data cache (CACHE_ENABLED=false)', async () => {
		vi.mocked(useEnv).mockReturnValue({ CACHE_STORE: 'memory', CACHE_NAMESPACE: 'ns' });
		expect(getCache().cache).toBeNull();
		await expect(flushCaches()).resolves.toBeUndefined();
		expect(clearPermissionCache).toHaveBeenCalledOnce();
	});
});

describe('schemaChanged handler', () => {
	const handler = async (message: unknown) => {
		const call = bus.subscribe.mock.calls.find((c) => (c as unknown[])[0] === 'schemaChanged') as unknown[];
		await (call[1] as (m: unknown) => Promise<void>)(message);
	};

	test('not registered without Redis', () => {
		subscribeSchemaChanged();
		expect(bus.subscribe).not.toHaveBeenCalled();
	});

	test('registered once; clears the in-memory and local schema caches', async () => {
		vi.mocked(redisConfigAvailable).mockReturnValue(true);
		vi.mocked(useEnv).mockReturnValue({ CACHE_STORE: 'redis', CACHE_NAMESPACE: 'ns' });
		subscribeSchemaChanged();
		subscribeSchemaChanged();
		expect(bus.subscribe).toHaveBeenCalledOnce();

		vi.mocked(useEnv).mockReturnValue({ CACHE_STORE: 'memory', CACHE_NAMESPACE: 'ns' });
		const { localSchemaCache } = getCache();
		await localSchemaCache.set('b', 2);
		setMemorySchemaCache(overview());

		await handler({});
		expect(getMemorySchemaCache()).toBeUndefined();
		expect(await localSchemaCache.get('b')).toBeUndefined();
	});

	test('clears the response cache only with CACHE_STORE=memory, CACHE_AUTO_PURGE and autoPurgeCache !== false', async () => {
		vi.mocked(redisConfigAvailable).mockReturnValue(true);
		const env = {
			CACHE_ENABLED: true,
			CACHE_STORE: 'memory',
			CACHE_NAMESPACE: 'ns',
			CACHE_TTL: '5m',
			CACHE_AUTO_PURGE: true,
		};
		vi.mocked(useEnv).mockReturnValue(env);
		subscribeSchemaChanged();
		const { cache } = getCache();

		await cache!.set('k', 1);
		await handler({ autoPurgeCache: false });
		expect(await cache!.get('k')).toBe(1);

		await handler({});
		expect(await cache!.get('k')).toBeUndefined();
	});
});
