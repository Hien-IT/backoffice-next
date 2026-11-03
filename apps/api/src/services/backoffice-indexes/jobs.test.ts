// Backoffice (spec 030, D-210, research R4): the in-process job that builds an index and the SIGTERM hook.
import type { Knex } from 'knex';
import { beforeEach, expect, test, vi } from 'vitest';
import { failRunningIndexJobs, runIndexJob, running } from './jobs.js';

vi.mock('../../logger/index.js', () => ({
	useLogger: () => ({ warn: vi.fn(), trace: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

const row = {
	id: '3f6c1b2a-9d4e-4c8b-8a1f-2b3c4d5e6f70',
	collection: 'articles',
	name: 'articles_a_b_unique',
	fields: ['a', 'b'],
	type: 'btree' as const,
	unique: true,
	status: 'creating' as const,
	error: null,
	date_created: '2026-11-03T00:00:00.000Z',
};

let createIndex: ReturnType<typeof vi.fn>;
let dropIndex: ReturnType<typeof vi.fn>;
let updateOne: ReturnType<typeof vi.fn>;
let raw: ReturnType<typeof vi.fn>;

const ctx = (client = 'sqlite') => ({
	knex: { raw } as unknown as Knex,
	client,
	helpers: { createIndex, dropIndex } as never,
	updateOne,
	attemptConcurrentIndex: true,
});

beforeEach(() => {
	createIndex = vi.fn().mockResolvedValue(undefined);
	dropIndex = vi.fn().mockResolvedValue(undefined);
	updateOne = vi.fn().mockResolvedValue(row.id);
	raw = vi.fn().mockResolvedValue(undefined);
	running.clear();
});

test('builds the index with the fields, unique and the concurrent flag, then sets ready', async () => {
	await runIndexJob(row, ctx());

	expect(createIndex).toHaveBeenCalledWith('articles', ['a', 'b'], {
		unique: true,
		type: 'btree',
		attemptConcurrentIndex: true,
	});
	expect(updateOne).toHaveBeenCalledWith(row.id, { status: 'ready', error: null });
	expect(running.size).toBe(0);
});

test('a failing build drops the leftover index on Postgres and sets failed with the message', async () => {
	createIndex.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

	await runIndexJob(row, ctx('postgres'));

	expect(dropIndex).toHaveBeenCalledWith('articles', 'articles_a_b_unique');
	expect(updateOne).toHaveBeenCalledWith(row.id, {
		status: 'failed',
		error: expect.stringMatching(/duplicate key/),
	});
});

test('a failing build on SQLite does not try to drop; a drop failure is ignored', async () => {
	createIndex.mockRejectedValue(new Error('x'));
	await runIndexJob(row, ctx('sqlite'));
	expect(dropIndex).not.toHaveBeenCalled();

	createIndex.mockRejectedValue(new Error('y'));
	dropIndex.mockRejectedValue(new Error('no such index'));
	await runIndexJob(row, ctx('postgres'));
	expect(updateOne).toHaveBeenLastCalledWith(row.id, { status: 'failed', error: 'y' });
});

test('trigram on Postgres installs pg_trgm first; a permission error becomes a failed row naming the command', async () => {
	await runIndexJob({ ...row, type: 'trigram', unique: false, fields: ['name'] }, ctx('postgres'));
	expect(raw).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS pg_trgm');
	expect(createIndex).toHaveBeenCalledWith('articles', ['name'], {
		unique: false,
		type: 'trigram',
		attemptConcurrentIndex: true,
	});

	raw.mockRejectedValue(Object.assign(new Error('permission denied to create extension "pg_trgm"'), { code: '42501' }));
	await runIndexJob({ ...row, type: 'trigram', unique: false, fields: ['name'] }, ctx('postgres'));
	expect(updateOne).toHaveBeenLastCalledWith(row.id, {
		status: 'failed',
		error: expect.stringMatching(/CREATE EXTENSION pg_trgm/),
	});
});

test('failRunningIndexJobs marks every running job failed without waiting for the DDL', async () => {
	let finish!: () => void;
	createIndex.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
	const job = runIndexJob(row, ctx());
	expect(running.size).toBe(1);

	const started = Date.now();
	await failRunningIndexJobs();
	expect(Date.now() - started).toBeLessThan(500);
	expect(updateOne).toHaveBeenCalledWith(row.id, { status: 'failed', error: 'Server shutdown' });

	finish();
	await job;
	// The late success must not overwrite the shutdown mark.
	expect(updateOne).not.toHaveBeenCalledWith(row.id, { status: 'ready', error: null });
});
