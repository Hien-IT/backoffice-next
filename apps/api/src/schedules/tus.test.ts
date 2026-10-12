// Backoffice: directus/api/src/schedules/tus.ts has no unit test (feature 007, T016).
import { beforeEach, expect, test, vi } from 'vitest';
import { RESUMABLE_UPLOADS } from '../constants.js';
import { getSchema } from '../schema/get-database-schema.js';
import { createTusServer } from '../services/tus/index.js';
import { onServerShutdown } from '../shutdown.js';
import { scheduleSynchronizedJob } from '../utils/schedule.js';
import schedule from './tus.js';

vi.mock('../constants.js', () => ({ RESUMABLE_UPLOADS: { ENABLED: false, SCHEDULE: '0 * * * *' } }));
vi.mock('../services/tus/index.js', () => ({ createTusServer: vi.fn() }));
vi.mock('../schema/get-database-schema.js', () => ({ getSchema: vi.fn() }));
vi.mock('../shutdown.js', () => ({ onServerShutdown: vi.fn() }));

vi.mock('../utils/schedule.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../utils/schedule.js')>()),
	scheduleSynchronizedJob: vi.fn(() => ({ stop: vi.fn() })),
}));

beforeEach(() => {
	vi.clearAllMocks();
	Object.assign(RESUMABLE_UPLOADS, { ENABLED: false, SCHEDULE: '0 * * * *' });
});

test('does nothing when TUS is disabled', async () => {
	expect(await schedule()).toBe(false);
	expect(scheduleSynchronizedJob).not.toHaveBeenCalled();
});

test('schedules the synchronized tus-cleanup job and stops it on shutdown', async () => {
	Object.assign(RESUMABLE_UPLOADS, { ENABLED: true });

	expect(await schedule()).toBe(true);
	expect(scheduleSynchronizedJob).toHaveBeenCalledWith('tus-cleanup', '0 * * * *', expect.any(Function));

	const job = vi.mocked(scheduleSynchronizedJob).mock.results[0]!.value;
	vi.mocked(onServerShutdown).mock.calls[0]![0]();
	expect(job.stop).toHaveBeenCalled();

	const cleanUpExpiredUploads = vi.fn();
	const cleanup = vi.fn();
	vi.mocked(getSchema).mockResolvedValue({ collections: {}, relations: [] } as any);
	vi.mocked(createTusServer).mockResolvedValue([{ cleanUpExpiredUploads } as any, cleanup]);

	await vi.mocked(scheduleSynchronizedJob).mock.calls[0]![2](new Date());

	expect(createTusServer).toHaveBeenCalledWith({ schema: { collections: {}, relations: [] } });
	expect(cleanUpExpiredUploads).toHaveBeenCalled();
	expect(cleanup).toHaveBeenCalled();
});

test('an invalid cron schedules nothing but still reports TUS as initialized, like Directus', async () => {
	Object.assign(RESUMABLE_UPLOADS, { ENABLED: true, SCHEDULE: 'not a cron' });

	expect(await schedule()).toBe(true);
	expect(scheduleSynchronizedJob).not.toHaveBeenCalled();
	expect(onServerShutdown).not.toHaveBeenCalled();
});
