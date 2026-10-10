import { useEnv } from '@backoffice/env';
import type { SchemaOverview } from '@backoffice/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { _resetCache, getCache, getMemorySchemaCache, setMemorySchemaCache } from './cache.js';
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
