// Spec 021 FR-015: a database left half installed (system tables present, directus_fields dropped) is handled by
// Backoffice exactly as by Directus 11.17.4: `directus_collections` exists so bootstrap takes the "installed" branch,
// the migrations fail at the same point, with the same exit code, error lines and directus_migrations rows.
import { afterAll, describe, expect, test } from 'vitest';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { profileUrls } from '../profiles.js';
import { type CliResult, cliRun, composeOk } from './cli.js';
import { type BootstrapApp, bootstrapDb, emptyBootstrapDb } from './dump.js';
import { normalizeLogs } from './normalize.js';

const vendor = getDbsToTest()[0]!;
const SERVICES: Record<BootstrapApp, string> = {
	directus: 'directus-bootstrap',
	backoffice: 'backoffice-api-bootstrap',
};

/** Each app on its own partial database, Redis db and namespaces (never those of the main bootstrap databases). */
const ENV: Record<BootstrapApp, Record<string, string>> = {
	directus: {
		DB_DATABASE: 'directus_partial',
		DB_FILENAME: '/directus/database/bootstrap/directus_partial.db',
		REDIS: 'redis://redis:6379/12',
		CACHE_NAMESPACE: 'parity-partial-d',
		REDIS_BUS_NAMESPACE: 'parity-partial-d:bus',
		REDIS_LOCK_NAMESPACE: 'parity-partial-d:lock',
	},
	backoffice: {
		DB_DATABASE: 'backoffice_partial',
		DB_FILENAME: '/directus/database/bootstrap/backoffice_partial.db',
		REDIS: 'redis://redis:6379/13',
		CACHE_NAMESPACE: 'parity-partial-b',
		REDIS_BUS_NAMESPACE: 'parity-partial-b:bus',
		REDIS_LOCK_NAMESPACE: 'parity-partial-b:lock',
	},
};

const partialDb = (app: BootstrapApp) => bootstrapDb(vendor, app, `${app}_partial`);
const errors = (result: CliResult) =>
	normalizeLogs(result.stdout + result.stderr)
		.filter((l) => l.level >= 50)
		.map((l) => l.msg);

describe.skipIf(!profileUrls('bootstrap'))('profile bootstrap: a half installed database (FR-015)', () => {
	afterAll(async () => {
		await emptyBootstrapDb(vendor, 'directus', 'directus_partial');
		await emptyBootstrapDb(vendor, 'backoffice', 'backoffice_partial');
	});

	test('bootstrap fails like Directus 11.17.4', async () => {
		const results = {} as Record<BootstrapApp, CliResult>;
		const migrations = {} as Record<BootstrapApp, string[]>;

		for (const app of ['directus', 'backoffice'] as const) {
			// The half installed database is made by the Directus image for both apps.
			const install = cliRun(SERVICES.directus, ['database', 'install'], ENV[app]);
			expect(install.code, install.stdout + install.stderr).toBe(0);

			// SQLite: the container made the file as uid 1000, mode 0644; the runner drops a table below.
			if (vendor === 'sqlite3') composeOk('exec', '-T', SERVICES.directus, 'chmod', '666', ENV[app]['DB_FILENAME']!);

			const db = partialDb(app);

			try {
				await db.schema.dropTable('directus_fields');
				results[app] = cliRun(SERVICES[app], ['bootstrap'], ENV[app]);
				migrations[app] = (await db.select('version').from('directus_migrations').orderBy('version')).map(
					(r) => r.version,
				);
			} finally {
				await db.destroy();
			}
		}

		expect(results.directus.code).toBe(1);
		expect(results.backoffice.code).toBe(results.directus.code);
		expect(errors(results.backoffice)).toEqual(errors(results.directus));
		expect(migrations.backoffice).toEqual(migrations.directus);
	});
});
