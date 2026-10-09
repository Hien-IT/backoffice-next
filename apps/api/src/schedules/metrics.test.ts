// Ported from directus/api/src/schedules/metrics.test.ts
import { useEnv } from '@backoffice/env';
import { CronJob } from 'cron';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useLogger } from '../logger/index.js';
import { useMetrics } from '../metrics/index.js';
import { runShutdownTasks } from '../shutdown.js';
import * as schedule from '../utils/schedule.js';
import { handleMetricsJob, default as metricsSchedule } from './metrics.js';

vi.mock('@backoffice/env', () => ({
	useEnv: vi.fn().mockReturnValue({}),
}));

vi.mock('../metrics/index.js', () => {
	const metrics = { generate: vi.fn() };
	return { useMetrics: () => metrics };
});

vi.mock('../logger/index.js', () => {
	const logger = { warn: vi.fn() };
	return { useLogger: () => logger };
});

vi.spyOn(schedule, 'validateCron');

vi.mock('cron', async (importOriginal) => {
	const actual = (await importOriginal()) as any;

	return {
		...actual,
		CronJob: {
			...actual.CronJob,
			from: vi.fn(),
		},
	};
});

beforeEach(() => {
	vi.mocked(useEnv).mockReturnValue({ METRICS_ENABLED: true, METRICS_SCHEDULE: '0 0 * * *' });
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('metrics', () => {
	test('Returns early when metrics is disabled', async () => {
		vi.mocked(useEnv).mockReturnValue({ METRICS_ENABLED: false, METRICS_SCHEDULE: '0 0 * * *' });

		const res = await metricsSchedule();

		expect(schedule.validateCron).not.toHaveBeenCalled();
		expect(res).toBe(false);
	});

	test('Returns early for invalid metrics schedule', async () => {
		vi.mocked(useEnv).mockReturnValue({ METRICS_ENABLED: true, METRICS_SCHEDULE: '#' });

		const res = await metricsSchedule();

		expect(schedule.validateCron).toHaveBeenCalledWith('#');
		expect(res).toBe(false);
	});

	test('Schedules job', async () => {
		await metricsSchedule();

		expect(schedule.validateCron).toHaveBeenCalledWith('0 0 * * *');

		expect(CronJob.from).toHaveBeenCalledWith({
			cronTime: '0 0 * * *',
			onTick: handleMetricsJob,
			start: true,
		});
	});

	test('Returns true on successful init', async () => {
		const res = await metricsSchedule();

		expect(res).toBe(true);
	});
});

describe('Backoffice', () => {
	test('Stops the job when the server shuts down', async () => {
		const stop = vi.fn();
		vi.mocked(CronJob.from).mockReturnValue({ stop } as any);

		await metricsSchedule();
		await runShutdownTasks();

		expect(stop).toHaveBeenCalledOnce();
	});

	test('handleMetricsJob logs a warning when generation fails, and runs again afterwards', async () => {
		const error = new Error('boom');
		vi.mocked(useMetrics()!.generate).mockRejectedValueOnce(error);

		await handleMetricsJob();
		expect(useLogger().warn).toHaveBeenCalledWith(error);

		await handleMetricsJob();
		expect(useMetrics()!.generate).toHaveBeenCalledTimes(2);
	});
});
