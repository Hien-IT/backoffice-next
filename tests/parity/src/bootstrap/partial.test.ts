// Spec 021 FR-015: a database left half installed (system tables present, directus_fields dropped) is handled by
// Backoffice exactly as by Directus 11.17.4: `directus_collections` exists so bootstrap takes the "installed" branch,
// the migrations fail at the same point, with the same exit code, error lines and directus_migrations rows.
import { createInspector } from '@backoffice/schema';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { profileUrls } from '../profiles.js';
import { type CliResult, cliRun } from './cli.js';
import { type BootstrapApp, bootstrapDb } from './dump.js';
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

/** Drops every table of a partial database (Postgres keeps PostGIS' spatial_ref_sys), or removes the SQLite file. */
async function empty(app: BootstrapApp) {
	if (vendor === 'sqlite3') {
		rmSync(fileURLToPath(new URL(`../../.data/bootstrap/${app}_partial.db`, import.meta.url)), { force: true });
		return;
	}

	const db = partialDb(app);

	try {
		for (const table of await createInspector(db).tables()) {
			if (table !== 'spatial_ref_sys') await db.raw('DROP TABLE IF EXISTS ?? CASCADE', [table]);
		}
	} finally {
		await db.destroy();
	}
}

describe.skipIf(!profileUrls('bootstrap'))('profile bootstrap: a half installed database (FR-015)', () => {
	afterAll(async () => {
		await empty('directus');
		await empty('backoffice');
	});

	test('bootstrap fails like Directus 11.17.4', async () => {
		const results = {} as Record<BootstrapApp, CliResult>;
		const migrations = {} as Record<BootstrapApp, string[]>;

		for (const app of ['directus', 'backoffice'] as const) {
			// The half installed database is made by the Directus image for both apps.
			const install = cliRun(SERVICES.directus, ['database', 'install'], ENV[app]);
			expect(install.code, install.stdout + install.stderr).toBe(0);

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
