// Backoffice: Directus has no unit test for cli/commands/bootstrap (spec 021 T016).
import { useEnv } from '@backoffice/env';
import { type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import getDatabase, {
	getDatabaseClient,
	hasDatabaseConnection,
	isInstalled,
	validateDatabaseConnection,
} from '../../../database/index.js';
import runMigrations from '../../../database/migrations/run.js';
import installDatabase from '../../../database/seeds/run.js';
import { useLogger } from '../../../logger/index.js';
import { getSchema } from '../../../schema/get-database-schema.js';
import { SettingsService } from '../../../services/settings.service.js';
import { createAdmin } from '../../../utils/create-admin.js';
import bootstrap from './index.js';

vi.mock('@backoffice/env');
vi.mock('../../../database/index.js');
vi.mock('../../../database/migrations/run.js');
vi.mock('../../../database/seeds/run.js');
vi.mock('../../../logger/index.js');
vi.mock('../../../schema/get-database-schema.js');
vi.mock('../../../services/settings.service.js');
vi.mock('../../../utils/create-admin.js');

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
const database = { destroy: vi.fn() };
const calls: string[] = [];
let exit: MockInstance<typeof process.exit>;

class Exit extends Error {}

beforeEach(() => {
	vi.useFakeTimers();
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(useEnv).mockReturnValue({});
	vi.mocked(getDatabase).mockReturnValue(database as any);
	vi.mocked(getDatabaseClient).mockReturnValue('postgres');
	vi.mocked(hasDatabaseConnection).mockResolvedValue(true);
	vi.mocked(getSchema).mockResolvedValue({} as any);
	vi.mocked(installDatabase).mockImplementation(async () => void calls.push('seed'));
	vi.mocked(runMigrations).mockImplementation(async (_db, direction) => void calls.push(`migrate:${direction}`));
	vi.mocked(createAdmin).mockImplementation(async () => void calls.push('admin'));
	vi.mocked(SettingsService.prototype.upsertSingleton).mockImplementation(async (data: any) => {
		calls.push(`settings:${data.project_name}`);
		return 1;
	});
	vi.mocked(SettingsService.prototype.setOwner).mockImplementation(async (data: any) => {
		calls.push(`owner:${data.project_owner}`);
		return 1;
	});
	exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
		throw new Exit(String(code));
	}) as never);
});

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
	exit.mockRestore();
	calls.length = 0;
});

const run = (options: { skipAdminInit?: boolean } = {}) => bootstrap(options).catch((e) => e);
const messages = () => logger.info.mock.calls.map((c) => c[0]);

describe('empty database', () => {
	beforeEach(() => vi.mocked(isInstalled).mockResolvedValue(false));

	test('seeds, migrates, creates the admin, logs like Directus and exits 0', async () => {
		const error = await run();

		expect(error).toEqual(new Exit('0'));
		expect(calls).toEqual(['seed', 'migrate:latest', 'admin', 'settings:Backoffice']);
		expect(messages()).toEqual([
			'Initializing bootstrap...',
			'Installing Backoffice system tables...',
			'Running migrations...',
			'Done',
		]);
		expect(database.destroy).toHaveBeenCalledOnce();
	});

	test('--skipAdminInit skips createAdmin with the Directus log line', async () => {
		await run({ skipAdminInit: true });

		expect(calls).toEqual(['seed', 'migrate:latest', 'settings:Backoffice']);
		expect(messages()).toContain('Skipping creation of default Admin user and role...');
	});

	test('PROJECT_NAME and an e-mail PROJECT_OWNER are written', async () => {
		vi.mocked(useEnv).mockReturnValue({ PROJECT_NAME: 'Acme', PROJECT_OWNER: 'owner@example.com' });

		await run();

		expect(calls).toEqual(['seed', 'migrate:latest', 'admin', 'settings:Acme', 'owner:owner@example.com']);
		expect(SettingsService.prototype.setOwner).toHaveBeenCalledWith({
			project_owner: 'owner@example.com',
			org_name: null,
			project_usage: null,
			product_updates: false,
		});
	});

	test('a PROJECT_OWNER that is not an e-mail is ignored; an empty PROJECT_NAME names the project Backoffice', async () => {
		vi.mocked(useEnv).mockReturnValue({ PROJECT_NAME: '', PROJECT_OWNER: 'not-an-email' });

		await run();

		expect(calls).toEqual(['seed', 'migrate:latest', 'admin', 'settings:Backoffice']);
	});
});

describe('installed database', () => {
	beforeEach(() => vi.mocked(isInstalled).mockResolvedValue(true));

	test('only runs the pending migrations', async () => {
		const error = await run();

		expect(error).toEqual(new Exit('0'));
		expect(calls).toEqual(['migrate:latest']);
		expect(messages()).toEqual([
			'Initializing bootstrap...',
			'Database already initialized, skipping install',
			'Running migrations...',
			'Done',
		]);
	});
});

describe('waiting for the database', () => {
	beforeEach(() => vi.mocked(isInstalled).mockResolvedValue(true));

	test('tries 5 times, 5 seconds apart, then lets validateDatabaseConnection fail', async () => {
		vi.mocked(hasDatabaseConnection).mockResolvedValue(false);
		vi.mocked(validateDatabaseConnection).mockImplementation(async () => {
			throw new Exit('1');
		});

		const pending = run();
		await vi.advanceTimersByTimeAsync(25_000);

		expect(await pending).toEqual(new Exit('1'));
		expect(hasDatabaseConnection).toHaveBeenCalledTimes(5);
		expect(validateDatabaseConnection).toHaveBeenCalledWith(database);
		expect(calls).toEqual([]);
	});

	test('continues as soon as the database answers', async () => {
		vi.mocked(hasDatabaseConnection).mockResolvedValueOnce(false).mockResolvedValue(true);

		const pending = run();
		await vi.advanceTimersByTimeAsync(5_000);

		expect(await pending).toEqual(new Exit('0'));
		expect(hasDatabaseConnection).toHaveBeenCalledTimes(2);
		expect(validateDatabaseConnection).not.toHaveBeenCalled();
	});
});

describe('vendors Backoffice does not install or migrate (D-145)', () => {
	test.each(['mysql', 'mssql', 'oracle', 'cockroachdb', 'redshift'] as const)(
		'%s, empty database: error, nothing written, exit 1',
		async (client) => {
			vi.mocked(getDatabaseClient).mockReturnValue(client);
			vi.mocked(isInstalled).mockResolvedValue(false);

			expect(await run()).toEqual(new Exit('1'));
			expect(calls).toEqual([]);
			expect(logger.error).toHaveBeenCalledWith(
				`Backoffice bootstraps only Postgres and SQLite databases; on ${client} run "node cli.js bootstrap" with the Directus 11.17.4 image (D-145)`,
			);
		},
	);

	test('installed database: no migration, "Done", exit 0', async () => {
		vi.mocked(getDatabaseClient).mockReturnValue('mysql');
		vi.mocked(isInstalled).mockResolvedValue(true);

		expect(await run()).toEqual(new Exit('0'));
		expect(calls).toEqual([]);
		expect(messages()).toEqual([
			'Initializing bootstrap...',
			'Database on mysql is migrated by Directus 11.17.4 (D-145); skipping migrations',
			'Done',
		]);
	});

	test('sqlite is bootstrapped by Backoffice', async () => {
		vi.mocked(getDatabaseClient).mockReturnValue('sqlite');
		vi.mocked(isInstalled).mockResolvedValue(false);

		await run();
		expect(calls).toEqual(['seed', 'migrate:latest', 'admin', 'settings:Backoffice']);
	});
});
