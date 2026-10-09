// Ported from directus/api/src/metrics/lib/create-metrics.ts. Without the PM2 aggregation (process.on('message'),
// pm2 sync, AggregatorRegistry): the image runs one process, each container reports its own metrics (D-19).
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { useEnv } from '@backoffice/env';
import { toArray } from '@backoffice/utils';
import { Counter, Histogram, register } from 'prom-client';
import { getCache } from '../../cache.js';
import { hasDatabaseConnection } from '../../database/index.js';
import { redisConfigAvailable, useRedis } from '../../redis/index.js';
import { getStorage } from '../../storage/index.js';
import type { MetricService } from '../types/metric.js';

export function createMetrics() {
	const env = useEnv();

	const services: MetricService[] = (env['METRICS_SERVICES'] as MetricService[] | undefined) ?? [];
	const metricNamePrefix = env['METRICS_NAME_PREFIX'] ?? 'directus_';
	const metricsHealthCheckPrefix = env['METRICS_HEALTH_CHECK_PREFIX'] as string;

	async function generate() {
		const checkId = randomUUID();

		await Promise.all([
			trackDatabaseMetric(),
			trackCacheMetric(checkId),
			trackRedisMetric(checkId),
			trackStorageMetric(checkId),
		]);
	}

	async function readAll(): Promise<string> {
		return register.metrics();
	}

	function getDatabaseErrorMetric(): Counter | null {
		if (services.includes('database') === false) {
			return null;
		}

		const client = env['DB_CLIENT'];

		let metric = register.getSingleMetric(`${metricNamePrefix}db_${client}_connection_errors`) as Counter | undefined;

		if (!metric) {
			metric = new Counter({
				name: `${metricNamePrefix}db_${client}_connection_errors`,
				help: `${client} Database connection error count`,
			});
		}

		return metric;
	}

	function getDatabaseResponseMetric(): Histogram | null {
		if (services.includes('database') === false) {
			return null;
		}

		const client = env['DB_CLIENT'];

		let metric = register.getSingleMetric(`${metricNamePrefix}db_${client}_response_time_ms`) as Histogram | undefined;

		if (!metric) {
			metric = new Histogram({
				name: `${metricNamePrefix}db_${client}_response_time_ms`,
				help: `${client} Database connection response time`,
				buckets: [1, 10, 20, 40, 60, 80, 100, 200, 500, 750, 1000],
			});
		}

		return metric;
	}

	function getCacheErrorMetric(): Counter | null {
		if (services.includes('cache') === false || env['CACHE_ENABLED'] !== true) {
			return null;
		}

		if (env['CACHE_STORE'] === 'redis' && redisConfigAvailable() !== true) {
			return null;
		}

		let metric = register.getSingleMetric(`${metricNamePrefix}cache_${env['CACHE_STORE']}_connection_errors`) as
			| Counter
			| undefined;

		if (!metric) {
			metric = new Counter({
				name: `${metricNamePrefix}cache_${env['CACHE_STORE']}_connection_errors`,
				help: 'Cache connection error count',
			});
		}

		return metric;
	}

	function getRedisErrorMetric(): Counter | null {
		if (services.includes('redis') === false || redisConfigAvailable() !== true) {
			return null;
		}

		let metric = register.getSingleMetric(`${metricNamePrefix}redis_connection_errors`) as Counter | undefined;

		if (!metric) {
			metric = new Counter({
				name: `${metricNamePrefix}redis_connection_errors`,
				help: 'Redis connection error count',
			});
		}

		return metric;
	}

	function getStorageErrorMetric(location: string): Counter | null {
		if (services.includes('storage') === false) {
			return null;
		}

		let metric = register.getSingleMetric(`${metricNamePrefix}storage_${location}_connection_errors`) as
			| Counter
			| undefined;

		if (!metric) {
			metric = new Counter({
				name: `${metricNamePrefix}storage_${location}_connection_errors`,
				help: `${location} storage connection error count`,
			});
		}

		return metric;
	}

	async function trackDatabaseMetric(): Promise<void> {
		const metric = getDatabaseErrorMetric();

		if (metric === null) {
			return;
		}

		try {
			if (!(await hasDatabaseConnection())) {
				metric.inc();
			}
		} catch {
			metric.inc();
		}
	}

	async function trackCacheMetric(checkId: string): Promise<void> {
		const metric = getCacheErrorMetric();

		if (metric === null) {
			return;
		}

		const { cache } = getCache();

		if (!cache) {
			return;
		}

		try {
			await cache.set(`${metricsHealthCheckPrefix}${checkId}`, '1', 5);
			await cache.delete(`${metricsHealthCheckPrefix}${checkId}`);
		} catch {
			metric.inc();
		}
	}

	async function trackRedisMetric(checkId: string) {
		const metric = getRedisErrorMetric();

		if (metric === null) {
			return;
		}

		const redis = useRedis();

		try {
			await redis.set(`${metricsHealthCheckPrefix}${checkId}`, '1');
			await redis.del(`${metricsHealthCheckPrefix}${checkId}`);
		} catch {
			metric.inc();
		}
	}

	async function trackStorageMetric(checkId: string) {
		if (services.includes('storage') === false) {
			return;
		}

		const storage = await getStorage();

		for (const location of toArray(env['STORAGE_LOCATIONS'] as string)) {
			const disk = storage.location(location);

			const metric = getStorageErrorMetric(location);

			if (metric === null) {
				continue;
			}

			try {
				await disk.write(`${metricsHealthCheckPrefix}file`, Readable.from([checkId]));
			} catch {
				metric.inc();
			}
		}
	}

	return {
		getDatabaseErrorMetric,
		getDatabaseResponseMetric,
		getCacheErrorMetric,
		getRedisErrorMetric,
		getStorageErrorMetric,
		generate,
		readAll,
	};
}
