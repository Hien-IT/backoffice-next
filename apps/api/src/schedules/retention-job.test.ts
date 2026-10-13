// Backoffice: directus/api/src/schedules/retention.test.ts only covers schedule(). The job itself (spec FR-050 to
// FR-053, contracts/parity.md §1): the shared lock, batches, the two-step delete of MySQL, errors that stop one task
// only, no schema build, and the stop on shutdown. Timeframes are read at import, so this file sets them first.
import { createTracker, MockClient } from 'knex-mock-client';
import knex from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	lock: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
	isMySQL: { value: false },
	error: vi.fn(),
	onServerShutdown: vi.fn(),
	getSchema: vi.fn(),
	job: { stop: vi.fn() },
}));

vi.mock('@backoffice/env', () => ({
	useEnv: () => ({
		RETENTION_ENABLED: true,
		RETENTION_SCHEDULE: '*/10 * * * * *',
		RETENTION_BATCH: 2,
		ACTIVITY_RETENTION: '2s',
		REVISIONS_RETENTION: '1s',
		FLOW_LOGS_RETENTION: '3s',
	}),
}));

const db = knex({ client: MockClient, dialect: 'pg' });
const tracker = createTracker(db);

vi.mock('../database/index.js', () => ({ default: () => db }));
vi.mock('../lock/index.js', () => ({ useLock: () => mocks.lock }));
vi.mock('../logger/index.js', () => ({ useLogger: () => ({ error: mocks.error, warn: vi.fn() }) }));
vi.mock('../shutdown.js', () => ({ onServerShutdown: mocks.onServerShutdown }));
vi.mock('../schema/get-database-schema.js', () => ({ getSchema: mocks.getSchema }));

vi.mock('../database/helpers/index.js', () => ({
	getHelpers: () => ({
		date: { parse: (date: Date) => date.toISOString() },
		schema: { isOneOfClients: () => mocks.isMySQL.value },
	}),
}));

vi.mock('../utils/schedule.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../utils/schedule.js')>()),
	scheduleSynchronizedJob: vi.fn(() => mocks.job),
}));

const { default: schedule, handleRetentionJob } = await import('./retention.js');
const { scheduleSynchronizedJob } = await import('../utils/schedule.js');

beforeEach(() => {
	mocks.lock.get.mockResolvedValue(null);
	mocks.isMySQL.value = false;
});

afterEach(() => {
	tracker.reset();
	vi.clearAllMocks();
});

const deletes = () => tracker.history.delete.map((q) => ({ sql: q.sql, bindings: q.bindings }));

describe('handleRetentionJob', () => {
	test('a lock set less than 10 minutes ago means another process runs: nothing is deleted', async () => {
		mocks.lock.get.mockResolvedValue(String(Date.now() - 60_000));

		await handleRetentionJob();

		expect(tracker.history.all).toEqual([]);
		expect(mocks.lock.set).not.toHaveBeenCalled();
	});

	test('deletes activity in batches until a batch is short, run activity with its own timeframe, then frees the lock', async () => {
		for (const count of [2, 1, 0]) tracker.on.delete('directus_activity').responseOnce(count);

		await handleRetentionJob();

		const [first, second, run] = deletes();
		expect(first!.sql).toContain('delete from "directus_activity" where "id" in (select "directus_activity"."id"');
		expect(first!.sql).toContain('"action" != $2 limit $3');
		expect(first!.bindings).toEqual(expect.arrayContaining(['run', 2]));
		expect(second!.sql).toBe(first!.sql);
		expect(run!.sql).toContain('"action" = $2 limit $3');
		expect(deletes()).toHaveLength(3);
		expect(mocks.lock.set).toHaveBeenCalledWith('schedule--data-retention', expect.any(Number));
		expect(mocks.lock.delete).toHaveBeenCalledWith('schedule--data-retention');
		expect(mocks.getSchema).not.toHaveBeenCalled();
	});

	test('MySQL and MariaDB select the ids first and stop on an empty selection', async () => {
		mocks.isMySQL.value = true;
		for (const rows of [[{ id: 7 }, { id: 8 }], [], []]) tracker.on.select('directus_activity').responseOnce(rows);
		tracker.on.delete('directus_activity').responseOnce(2);

		await handleRetentionJob();

		expect(tracker.history.select[0]!.sql).toContain('limit $3');
		expect(deletes()).toEqual([{ sql: expect.stringContaining('where "id" in ($1, $2)'), bindings: [7, 8] }]);
	});

	test('an error logs, stops that task only, and still frees the lock', async () => {
		tracker.on.delete('directus_activity').simulateErrorOnce('boom');
		tracker.on.delete('directus_activity').responseOnce(0);

		await handleRetentionJob();

		expect(mocks.error).toHaveBeenCalledWith(expect.anything(), 'Retention failed for Collection directus_activity');
		expect(deletes()).toHaveLength(2);
		expect(mocks.lock.delete).toHaveBeenCalledWith('schedule--data-retention');
	});
});

describe('schedule', () => {
	test('adds the revisions task when ACTIVITY_RETENTION is longer than REVISIONS_RETENTION, stops on shutdown', async () => {
		await expect(schedule()).resolves.toBe(true);
		expect(scheduleSynchronizedJob).toHaveBeenCalledWith('retention', '*/10 * * * * *', handleRetentionJob);

		vi.mocked(mocks.onServerShutdown).mock.calls[0]![0]();
		expect(mocks.job.stop).toHaveBeenCalled();

		tracker.on.delete('directus_activity').response(0);
		tracker.on.delete('directus_revisions').responseOnce(0);

		await handleRetentionJob();

		const revisions = deletes().find((q) => q.sql.includes('"directus_revisions"'));
		expect(revisions!.sql).toContain(
			'inner join "directus_activity" on "directus_revisions"."activity" = "directus_activity"."id"',
		);
	});
});
