// Metric names, help texts and buckets of contracts/observability.md (identical to Directus 11.17.4).
import { useEnv } from '@backoffice/env';
import { register } from 'prom-client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getCache } from '../../cache.js';
import { hasDatabaseConnection } from '../../database/index.js';
import { redisConfigAvailable, useRedis } from '../../redis/index.js';
import { getStorage } from '../../storage/index.js';
import { createMetrics } from './create-metrics.js';

vi.mock('@backoffice/env');
vi.mock('../../cache.js');
vi.mock('../../database/index.js');
vi.mock('../../redis/index.js');
vi.mock('../../storage/index.js');

const cache = { set: vi.fn(), delete: vi.fn() };
const redis = { set: vi.fn(), del: vi.fn() };
const disk = { write: vi.fn() };

const env = {
	METRICS_SERVICES: ['database', 'cache', 'redis', 'storage'],
	METRICS_NAME_PREFIX: 'directus_',
	METRICS_HEALTH_CHECK_PREFIX: 'directus-metric-',
	DB_CLIENT: 'pg',
	CACHE_ENABLED: true,
	CACHE_STORE: 'redis',
	STORAGE_LOCATIONS: 'local,s3',
};

beforeEach(() => {
	vi.mocked(useEnv).mockReturnValue(env);
	vi.mocked(getCache).mockReturnValue({ cache } as any);
	vi.mocked(useRedis).mockReturnValue(redis as any);
	vi.mocked(redisConfigAvailable).mockReturnValue(true);
	vi.mocked(getStorage).mockResolvedValue({ location: () => disk } as any);
	vi.mocked(hasDatabaseConnection).mockResolvedValue(true);
});

afterEach(() => {
	register.clear();
	vi.clearAllMocks();
});

async function scrape() {
	return (await register.getMetricsAsJSON()).map(({ name, help, type }) => ({ name, help, type }));
}

describe('createMetrics', () => {
	test('names, help texts and types, like Directus', async () => {
		const metrics = createMetrics();
		await metrics.generate();
		metrics.getDatabaseResponseMetric();

		expect(await scrape()).toEqual([
			{ name: 'directus_db_pg_connection_errors', help: 'pg Database connection error count', type: 'counter' },
			{ name: 'directus_cache_redis_connection_errors', help: 'Cache connection error count', type: 'counter' },
			{ name: 'directus_redis_connection_errors', help: 'Redis connection error count', type: 'counter' },
			{
				name: 'directus_storage_local_connection_errors',
				help: 'local storage connection error count',
				type: 'counter',
			},
			{ name: 'directus_storage_s3_connection_errors', help: 's3 storage connection error count', type: 'counter' },
			{ name: 'directus_db_pg_response_time_ms', help: 'pg Database connection response time', type: 'histogram' },
		]);
	});

	test('response time histogram buckets', async () => {
		createMetrics().getDatabaseResponseMetric()!.observe(5);
		const text = await register.metrics();
		const buckets = [...text.matchAll(/le="([^"]+)"/g)].map((m) => m[1]);
		expect(buckets).toEqual(['1', '10', '20', '40', '60', '80', '100', '200', '500', '750', '1000', '+Inf']);
	});

	test('the checks write with METRICS_HEALTH_CHECK_PREFIX', async () => {
		await createMetrics().generate();
		expect(cache.set).toHaveBeenCalledWith(expect.stringMatching(/^directus-metric-/), '1', 5);
		expect(redis.set).toHaveBeenCalledWith(expect.stringMatching(/^directus-metric-/), '1');
		expect(disk.write).toHaveBeenCalledWith('directus-metric-file', expect.anything());
	});

	test('each failing check increments its error counter', async () => {
		vi.mocked(hasDatabaseConnection).mockResolvedValueOnce(false);
		cache.set.mockRejectedValueOnce(new Error('down'));
		redis.set.mockRejectedValueOnce(new Error('down'));
		disk.write.mockRejectedValueOnce(new Error('down'));

		await createMetrics().generate();

		const values = Object.fromEntries(
			(await register.getMetricsAsJSON()).map((m: any) => [m.name, m.values[0]?.value]),
		);

		expect(values['directus_db_pg_connection_errors']).toBe(1);
		expect(values['directus_cache_redis_connection_errors']).toBe(1);
		expect(values['directus_redis_connection_errors']).toBe(1);
		expect(values['directus_storage_local_connection_errors']).toBe(1);
		expect(values['directus_storage_s3_connection_errors']).toBe(0);
	});

	test('a throwing database check also counts as an error', async () => {
		vi.mocked(hasDatabaseConnection).mockRejectedValueOnce(new Error('boom'));
		const metrics = createMetrics();
		await metrics.generate();
		expect((await metrics.getDatabaseErrorMetric()!.get()).values[0]!.value).toBe(1);
	});

	test('METRICS_SERVICES limits the groups; cache needs CACHE_ENABLED and Redis config', async () => {
		vi.mocked(useEnv).mockReturnValue({ ...env, METRICS_SERVICES: ['cache'], CACHE_ENABLED: false });
		let metrics = createMetrics();
		expect(metrics.getDatabaseErrorMetric()).toBeNull();
		expect(metrics.getDatabaseResponseMetric()).toBeNull();
		expect(metrics.getRedisErrorMetric()).toBeNull();
		expect(metrics.getStorageErrorMetric('local')).toBeNull();
		expect(metrics.getCacheErrorMetric()).toBeNull();

		vi.mocked(useEnv).mockReturnValue({ ...env, METRICS_SERVICES: ['cache', 'redis'] });
		vi.mocked(redisConfigAvailable).mockReturnValue(false);
		metrics = createMetrics();
		expect(metrics.getCacheErrorMetric()).toBeNull();
		expect(metrics.getRedisErrorMetric()).toBeNull();

		await metrics.generate();
		expect(await scrape()).toEqual([]);
	});

	test('no cache instance → cache check skipped; readAll returns the registry text', async () => {
		vi.mocked(getCache).mockReturnValue({ cache: undefined } as any);
		const metrics = createMetrics();
		await metrics.generate();
		expect(cache.set).not.toHaveBeenCalled();
		expect(await metrics.readAll()).toContain('# HELP directus_db_pg_connection_errors');
	});

	test('no collectDefaultMetrics (Directus does not enable them)', async () => {
		await createMetrics().generate();
		expect((await scrape()).some((m) => m.name.startsWith('process_') || m.name.startsWith('nodejs_'))).toBe(false);
	});
});
