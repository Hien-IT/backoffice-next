// Backoffice: DR has no unit test for cli/commands/database (spec 021 T017).
import { type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import getDatabase, { getDatabaseClient } from '../../../database/index.js';
import runMigrations from '../../../database/migrations/run.js';
import installSeeds from '../../../database/seeds/run.js';
import { useLogger } from '../../../logger/index.js';
import install from './install.js';
import migrate from './migrate.js';

vi.mock('../../../database/index.js');
vi.mock('../../../database/migrations/run.js');
vi.mock('../../../database/seeds/run.js');
vi.mock('../../../logger/index.js');

const logger = { info: vi.fn(), error: vi.fn() };
const database = { destroy: vi.fn() };
let exit: MockInstance<typeof process.exit>;

beforeEach(() => {
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(getDatabase).mockReturnValue(database as any);
	vi.mocked(getDatabaseClient).mockReturnValue('postgres');
	// process.exit is called inside try/catch like DR: the mock returns so each path runs to its end.
	exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
});

afterEach(() => {
	vi.clearAllMocks();
	exit.mockRestore();
});

describe('database install', () => {
	test('seeds and exits 0', async () => {
		await install();
		expect(exit).toHaveBeenCalledWith(0);
		expect(installSeeds).toHaveBeenCalledWith(database);
		expect(database.destroy).toHaveBeenCalledOnce();
	});

	test('an error (e.g. already installed) is logged and exits 1', async () => {
		const error = new Error('Database is already installed');
		vi.mocked(installSeeds).mockRejectedValueOnce(error);

		await install();
		expect(exit).toHaveBeenCalledWith(1);
		expect(logger.error).toHaveBeenCalledWith(error);
		expect(database.destroy).toHaveBeenCalledOnce();
	});
});

describe('database migrate', () => {
	test.each([
		['latest', 'Database up to date'],
		['up', 'Database up to date'],
		['down', 'Downgrade successful'],
	] as const)('%s logs "Running migrations..." and "%s", exits without a code', async (direction, done) => {
		await migrate(direction);
		expect(exit).toHaveBeenCalledWith();
		expect(runMigrations).toHaveBeenCalledWith(database, direction);
		expect(logger.info.mock.calls.map((c) => c[0])).toEqual(['Running migrations...', done]);
		expect(database.destroy).toHaveBeenCalledOnce();
	});

	test('an error (e.g. "Nothing to upgrade") is logged and exits 1', async () => {
		const error = new Error('Nothing to upgrade');
		vi.mocked(runMigrations).mockRejectedValueOnce(error);

		await migrate('up');
		expect(exit).toHaveBeenCalledWith(1);
		expect(logger.error).toHaveBeenCalledWith(error);
		expect(database.destroy).toHaveBeenCalledOnce();
	});
});

describe('vendors Backoffice does not install or migrate (D-145)', () => {
	const message =
		'Backoffice runs migrations only on Postgres and SQLite databases; on mysql use the Directus 11.17.4 image (D-145)';

	test('database install: error, no seed, exit 1', async () => {
		vi.mocked(getDatabaseClient).mockReturnValue('mysql');

		await install();
		expect(exit).toHaveBeenCalledWith(1);
		expect(logger.error).toHaveBeenCalledWith(message);
		expect(installSeeds).not.toHaveBeenCalled();
	});

	test.each(['latest', 'up', 'down'] as const)('database migrate:%s: error, nothing run, exit 1', async (direction) => {
		vi.mocked(getDatabaseClient).mockReturnValue('mysql');

		await migrate(direction);
		expect(exit).toHaveBeenCalledWith(1);
		expect(logger.error).toHaveBeenCalledWith(message);
		expect(runMigrations).not.toHaveBeenCalled();
	});
});
