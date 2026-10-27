import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useEnv } from '@backoffice/env';
import { type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useLogger } from '../logger/index.js';
import { BACKOFFICE_MIGRATIONS } from './backoffice-migrations/index.js';
import { DIRECTUS_MIGRATIONS } from './migrations/directus-11.17.4.js';
import { checkMigrations, getCustomMigrations, migrationsValid, validateMigrations } from './validate-migrations.js';

vi.mock('@backoffice/env');
vi.mock('../logger/index.js');
vi.mock('./index.js', () => ({ default: vi.fn() }));

const logger = { warn: vi.fn(), error: vi.fn() };
let dir: string;
let exit: MockInstance<typeof process.exit>;

const BO_ALL = BACKOFFICE_MIGRATIONS.map((m) => m.version);

/** directus_migrations holds `versions`; backoffice_migrations holds `bo` (null: the table does not exist). */
function db(versions: string[] | Error, bo: string[] | null = BO_ALL) {
	return {
		schema: { hasTable: async (table: string) => table === 'backoffice_migrations' && bo !== null },
		select: () => ({
			from: async (table: string) => {
				if (table === 'backoffice_migrations') return (bo ?? []).map((version) => ({ version }));
				if (versions instanceof Error) throw versions;
				return versions.map((version) => ({ version }));
			},
		}),
	} as any;
}

function files(folder: string, names: string[]) {
	mkdirSync(join(dir, folder), { recursive: true });
	for (const name of names) writeFileSync(join(dir, folder, name), 'throw new Error("must never be imported")');
}

beforeEach(() => {
	vi.clearAllMocks();
	dir = mkdtempSync(join(tmpdir(), 'migrations-'));
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(useEnv).mockReturnValue({
		MIGRATIONS_PATH: join(dir, 'migrations'),
		EXTENSIONS_PATH: join(dir, 'extensions'),
	});
	exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
});

afterEach(() => exit.mockRestore());

const all = [...DIRECTUS_MIGRATIONS];

describe('validateMigrations', () => {
	test('exact list → passes silently', async () => {
		await validateMigrations(db(all));
		expect(logger.error).not.toHaveBeenCalled();
		expect(logger.warn).not.toHaveBeenCalled();
		expect(exit).not.toHaveBeenCalled();
	});

	test('one or more missing → error lists them (sorted), with the hint, exit 1', async () => {
		await validateMigrations(db(all.filter((v) => v !== '20260211A' && v !== '20201028A')));

		expect(logger.error.mock.calls.map(([m]) => m)).toEqual([
			'Database migrations do not match Directus 11.17.4.',
			'Missing migrations (not run yet): 20201028A, 20260211A',
			'If Directus is still migrating, restart Backoffice after it finishes.',
		]);

		expect(exit).toHaveBeenCalledWith(1);
	});

	test('unknown version → error lists it, exit 1', async () => {
		await validateMigrations(db([...all, '20990101A']));
		expect(logger.error).toHaveBeenCalledWith('Unknown migrations (not part of Directus 11.17.4): 20990101A');
		expect(exit).toHaveBeenCalledWith(1);
	});

	test('missing and unknown are reported in the same run', async () => {
		await validateMigrations(db([...all.slice(1), '20990101A', '20990102A']));

		expect(logger.error.mock.calls.map(([m]) => m)).toEqual([
			'Database migrations do not match Directus 11.17.4.',
			'Missing migrations (not run yet): 20201028A',
			'Unknown migrations (not part of Directus 11.17.4): 20990101A, 20990102A',
			'If Directus is still migrating, restart Backoffice after it finishes.',
		]);
	});

	test('reading directus_migrations fails → "Database migrations cannot be found", exit 1', async () => {
		const error = new Error('relation "directus_migrations" does not exist');
		// Like DR: `throw process.exit(1)` (the mocked exit returns, so the throw surfaces here).
		await validateMigrations(db(error)).catch(() => undefined);
		expect(logger.error).toHaveBeenNthCalledWith(1, 'Database migrations cannot be found');
		expect(logger.error).toHaveBeenNthCalledWith(2, error);
		expect(exit).toHaveBeenCalledWith(1);
	});
});

describe('Backoffice migrations (spec 022 FR-016, D-180)', () => {
	// The list is static; these cases use a stand-in version so they hold whatever the list contains.
	const BO = ['20261026A'];
	const original = [...BACKOFFICE_MIGRATIONS];

	beforeEach(() => {
		(BACKOFFICE_MIGRATIONS as unknown as object[]).splice(0, Infinity, { version: '20261026A', name: 'x', up: vi.fn() });
	});

	afterEach(() => {
		(BACKOFFICE_MIGRATIONS as unknown as object[]).splice(0, Infinity, ...original);
	});

	test('checkMigrations reports the Backoffice versions apart from the DR ones', async () => {
		const result = await checkMigrations(db(all, null));

		expect(result.boRequired).toEqual(BO);
		expect(result.boCompleted).toEqual([]);
		expect(result.boMissing).toEqual(BO);
		expect(result.boExtra).toEqual([]);
		expect(result.missing).toEqual([]);
	});

	test('no backoffice_migrations table → every Backoffice migration is missing, exit 1 with the bootstrap hint', async () => {
		await validateMigrations(db(all, null));

		expect(logger.error.mock.calls.map(([m]) => m)).toEqual([
			'Backoffice migrations do not match.',
			'Missing Backoffice migrations (not run yet): 20261026A',
			'Run "node cli.js bootstrap" to apply them.',
		]);

		expect(exit).toHaveBeenCalledWith(1);
	});

	test('an unknown Backoffice version (newer Backoffice) → exit 1', async () => {
		await validateMigrations(db(all, [...BO, '20990101A']));

		expect(logger.error.mock.calls.map(([m]) => m)).toEqual([
			'Backoffice migrations do not match.',
			'Unknown Backoffice migrations (newer Backoffice?): 20990101A',
			'Run "node cli.js bootstrap" to apply them.',
		]);

		expect(exit).toHaveBeenCalledWith(1);
	});

	test('DR and Backoffice mismatches are reported together, DR first', async () => {
		await validateMigrations(db(all.slice(1), null));

		expect(logger.error.mock.calls.map(([m]) => m)).toEqual([
			'Database migrations do not match Directus 11.17.4.',
			'Missing migrations (not run yet): 20201028A',
			'If Directus is still migrating, restart Backoffice after it finishes.',
			'Backoffice migrations do not match.',
			'Missing Backoffice migrations (not run yet): 20261026A',
			'Run "node cli.js bootstrap" to apply them.',
		]);

		expect(exit).toHaveBeenCalledOnce();
		expect(exit).toHaveBeenCalledWith(1);
	});

	test('all present → passes silently', async () => {
		await validateMigrations(db(all, BO));
		expect(logger.error).not.toHaveBeenCalled();
		expect(exit).not.toHaveBeenCalled();
	});

	// CI 40294646712 (MySQL): bootstrap gates the Backoffice migrations on migrationsValid; counting them there kept
	// them from ever running on the vendors DR migrates.
	test('migrationsValid answers for the DR migrations only: a pending Backoffice migration keeps it true', async () => {
		expect(await migrationsValid(db(all, BO))).toBe(true);
		expect(await migrationsValid(db(all, null))).toBe(true);
		expect(await migrationsValid(db(all, []))).toBe(true);
		expect(await migrationsValid(db(all.slice(1), null))).toBe(false);
	});
});

describe('custom migrations (FR-031, FR-035)', () => {
	test('MIGRATIONS_PATH: names with "-" ending in .js/.cjs/.mjs are accepted, with a warning', async () => {
		files('migrations', [
			'20990101A-a.js',
			'20990102A-b.cjs',
			'20990103A-c.mjs',
			'nodash.js',
			'20990104A-d.ts',
			'20990105A-e.json',
		]);
		await validateMigrations(db([...all, '20990101A', '20990102A', '20990103A']));

		expect(logger.warn).toHaveBeenCalledWith(
			`Custom migrations are accepted: 20990101A (${join(dir, 'migrations')}), 20990102A (${join(dir, 'migrations')}), 20990103A (${join(dir, 'migrations')})`,
		);

		expect(exit).not.toHaveBeenCalled();
	});

	test('EXTENSIONS_PATH/migrations: every .js file counts; no "-" → the whole name is the version', async () => {
		files('extensions/migrations', ['20990101A-x.js', 'utils.js', '20990102A-y.cjs']);
		expect(getCustomMigrations().map((m) => m.version)).toEqual(['20990101A', 'utils.js']);

		// utils.js is not in the database: reported as missing and the API stops, like DR would never pass.
		await validateMigrations(db([...all, '20990101A']));
		expect(logger.error).toHaveBeenCalledWith('Missing migrations (not run yet): utils.js');
	});

	test('a version in both folders is counted once, reported with MIGRATIONS_PATH', () => {
		files('migrations', ['20990101A-a.js']);
		files('extensions/migrations', ['20990101A-a.js']);
		expect(getCustomMigrations()).toEqual([{ version: '20990101A', directory: join(dir, 'migrations') }]);
	});

	test('a custom file not yet run by Directus counts as missing', async () => {
		files('migrations', ['20990101A-a.js']);
		await validateMigrations(db(all));
		expect(logger.error).toHaveBeenCalledWith('Missing migrations (not run yet): 20990101A');
	});

	test('missing or empty folders → no custom versions; comparison is case sensitive', async () => {
		expect(getCustomMigrations()).toEqual([]);
		files('migrations', []);
		expect(getCustomMigrations()).toEqual([]);

		const result = await checkMigrations(db([...all.slice(0, -1), '20260211a']));
		expect(result.missing).toEqual(['20260211A']);
		expect(result.extra).toEqual(['20260211a']);
	});

	test('EXTENSIONS_LOCATION → custom migrations are read from TEMP_PATH/extensions/migrations', () => {
		vi.mocked(useEnv).mockReturnValue({
			MIGRATIONS_PATH: join(dir, 'none'),
			EXTENSIONS_LOCATION: 's3',
			TEMP_PATH: dir,
		});
		files('extensions/migrations', ['20990101A-a.js']);
		expect(getCustomMigrations()).toEqual([{ version: '20990101A', directory: join(dir, 'extensions', 'migrations') }]);
	});
});

// Spec 021 FR-043: the CLI loads extensions only when no migration is missing (DR' boolean validateMigrations).
describe('migrationsValid', () => {
	test('true with the exact list and with an unknown extra version', async () => {
		await expect(migrationsValid(db([...DIRECTUS_MIGRATIONS]))).resolves.toBe(true);
		await expect(migrationsValid(db([...DIRECTUS_MIGRATIONS, '20990101A']))).resolves.toBe(true);
	});

	test('false when a version is missing, without exiting', async () => {
		await expect(migrationsValid(db(DIRECTUS_MIGRATIONS.slice(1)))).resolves.toBe(false);
		expect(exit).not.toHaveBeenCalled();
	});

	test('a failing read logs "Database migrations cannot be found" and exits 1', async () => {
		await expect(migrationsValid(db(new Error('no table')))).rejects.toBeUndefined();
		expect(logger.error).toHaveBeenCalledWith('Database migrations cannot be found');
		expect(exit).toHaveBeenCalledWith(1);
	});
});

// Spec 025 (D-189.5): a database migrated before 025 lacks 20261028A, so start stops until bootstrap runs it.
test('the real list: a database with only 20261026A misses 20261028A', async () => {
	const result = await checkMigrations(db(all, ['20261026A']));

	expect(result.boRequired).toEqual(['20261026A', '20261028A']);
	expect(result.boMissing).toEqual(['20261028A']);
});
