// Backoffice (spec 022, D-180): the runner of the Backoffice migrations on SQLite in memory; cache, logger and lock are
// mocked so the flushes and the lock order can be counted.
import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { type BackofficeMigration, TABLE } from './index.js';
import runBackofficeMigrations from './run.js';

const { flushCaches, logger, lock } = vi.hoisted(() => ({
	flushCaches: vi.fn(),
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
	lock: { usingLock: vi.fn(async (_key: string, callback: () => Promise<unknown>) => callback()) },
}));

vi.mock('../../cache.js', () => ({ flushCaches }));
vi.mock('../../logger/index.js', () => ({ useLogger: () => logger }));
vi.mock('../../lock/index.js', () => ({ useLock: () => lock }));

let db: Knex;
const applied: string[] = [];

const migration = (version: string, up: (knex: Knex) => Promise<void> = async () => void applied.push(version)) =>
	({ version, name: `Migration ${version}`, up }) satisfies BackofficeMigration;

const versions = async () => (await db.select('version').from(TABLE).orderBy('version')).map((r) => r['version']);
const messages = () => logger.info.mock.calls.map((c) => c[0]);

beforeEach(() => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
	applied.length = 0;
	vi.clearAllMocks();
});

afterEach(async () => {
	await db.destroy();
});

test('creates the table and runs every migration in order, one flush at the end', async () => {
	await runBackofficeMigrations(db, [migration('20261026A'), migration('20261027A')]);

	expect(await db.schema.hasTable(TABLE)).toBe(true);
	expect(applied).toEqual(['20261026A', '20261027A']);
	expect(await db.select('version', 'name').from(TABLE).orderBy('version')).toEqual([
		{ version: '20261026A', name: 'Migration 20261026A' },
		{ version: '20261027A', name: 'Migration 20261027A' },
	]);
	expect(flushCaches).toHaveBeenCalledExactlyOnceWith(true);
	expect(lock.usingLock).toHaveBeenCalledExactlyOnceWith('backoffice-migrations', expect.any(Function));
	expect(messages()).toEqual([
		'Running Backoffice migrations...',
		'Applying Migration 20261026A...',
		'Applying Migration 20261027A...',
	]);
});

test('skips the migrations already in the table', async () => {
	await runBackofficeMigrations(db, [migration('20261026A')]);
	applied.length = 0;

	await runBackofficeMigrations(db, [migration('20261026A'), migration('20261027A')]);

	expect(applied).toEqual(['20261027A']);
	expect(await versions()).toEqual(['20261026A', '20261027A']);
});

test('nothing pending: no lock, no flush, "up to date"', async () => {
	await runBackofficeMigrations(db, [migration('20261026A')]);
	vi.clearAllMocks();

	await runBackofficeMigrations(db, [migration('20261026A')]);

	expect(lock.usingLock).not.toHaveBeenCalled();
	expect(flushCaches).not.toHaveBeenCalled();
	expect(messages()).toEqual(['Running Backoffice migrations...', 'Backoffice migrations are up to date']);
});

test('an empty list does nothing: no table, no lock, no flush', async () => {
	await runBackofficeMigrations(db, []);

	expect(await db.schema.hasTable(TABLE)).toBe(false);
	expect(lock.usingLock).not.toHaveBeenCalled();
	expect(flushCaches).not.toHaveBeenCalled();
});

test('log = false keeps the runner silent (init)', async () => {
	await runBackofficeMigrations(db, [migration('20261026A')], false);

	expect(logger.info).not.toHaveBeenCalled();
	expect(await versions()).toEqual(['20261026A']);
});

test('a failing up writes no row and throws; the earlier ones stay', async () => {
	const failing = migration('20261027A', async () => {
		throw new Error('boom');
	});

	await expect(runBackofficeMigrations(db, [migration('20261026A'), failing])).rejects.toThrow('boom');

	expect(await versions()).toEqual(['20261026A']);
	expect(flushCaches).not.toHaveBeenCalled();
});

test('reads the table again under the lock: a migration another process ran while waiting is not run twice', async () => {
	lock.usingLock.mockImplementationOnce(async (_key, callback) => {
		// The other replica held the lock first: it created the table and ran 20261026A.
		await db.schema.createTable(TABLE, (table) => {
			table.string('version', 255).primary();
			table.string('name', 255).notNullable();
			table.timestamp('timestamp').defaultTo(db.fn.now());
		});
		await db.insert({ version: '20261026A', name: 'Migration 20261026A' }).into(TABLE);
		return callback();
	});

	await runBackofficeMigrations(db, [migration('20261026A'), migration('20261027A')]);

	expect(applied).toEqual(['20261027A']);
	expect(await versions()).toEqual(['20261026A', '20261027A']);
});
