// Backoffice (spec 022, D-180): runs the pending Backoffice migrations, tracked in backoffice_migrations and never in
// directus_migrations, so a DR on the same database keeps its own migration state. Latest only, under the shared
// lock of principle VII (3.2.0): replicas that start together run them once; the others wait and read the table again.
import type { Knex } from 'knex';
import { flushCaches } from '../../cache.js';
import { useLock } from '../../lock/index.js';
import { useLogger } from '../../logger/index.js';
import { BACKOFFICE_MIGRATIONS, type BackofficeMigration, TABLE, completedBackofficeMigrations } from './index.js';

const LOCK = 'backoffice-migrations';

/**
 * Runs `step`; when it fails because another process did the same first, `done()` holds and the error is dropped.
 * The lock is in-process when Redis is off (CI 40298326039, profile schema-cache-nomsg), so several processes on one
 * database can run the same steps at once.
 */
async function raceSafe(step: () => Promise<unknown>, done: () => Promise<boolean>): Promise<void> {
	try {
		await step();
	} catch (error) {
		if (!(await done())) throw error;
	}
}

async function pendingMigrations(knex: Knex, migrations: readonly BackofficeMigration[]) {
	const completed = new Set(await completedBackofficeMigrations(knex));
	return migrations.filter((migration) => !completed.has(migration.version));
}

export default async function runBackofficeMigrations(
	knex: Knex,
	migrations: readonly BackofficeMigration[] = BACKOFFICE_MIGRATIONS,
	log = true,
): Promise<void> {
	const logger = useLogger();

	if (log) logger.info('Running Backoffice migrations...');

	if ((await pendingMigrations(knex, migrations)).length === 0) {
		if (log) logger.info('Backoffice migrations are up to date');
		return;
	}

	let applied = false;

	await useLock().usingLock(LOCK, async () => {
		if (!(await knex.schema.hasTable(TABLE))) {
			await raceSafe(
				() =>
					knex.schema.createTable(TABLE, (table) => {
						table.string('version', 255).primary();
						table.string('name', 255).notNullable();
						table.timestamp('timestamp').defaultTo(knex.fn.now());
					}),
				() => knex.schema.hasTable(TABLE),
			);
		}

		for (const migration of await pendingMigrations(knex, migrations)) {
			if (log) logger.info(`Applying ${migration.name}...`);
			await migration.up(knex);
			await raceSafe(
				() => knex.insert({ version: migration.version, name: migration.name }).into(TABLE),
				async () => (await completedBackofficeMigrations(knex)).includes(migration.version),
			);
			applied = true;
		}
	});

	// The schema changed: clear the caches of both apps over Redis, as the DR runner does.
	if (applied) await flushCaches(true);
}
