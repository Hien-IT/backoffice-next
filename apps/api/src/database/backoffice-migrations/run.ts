// Backoffice (spec 022, D-180): runs the pending Backoffice migrations, tracked in backoffice_migrations and never in
// directus_migrations, so a DR on the same database keeps its own migration state. Latest only, under the shared
// lock of principle VII (3.2.0): replicas that start together run them once; the others wait and read the table again.
import type { Knex } from 'knex';
import { flushCaches } from '../../cache.js';
import { useLock } from '../../lock/index.js';
import { useLogger } from '../../logger/index.js';
import { BACKOFFICE_MIGRATIONS, type BackofficeMigration, TABLE, completedBackofficeMigrations } from './index.js';

const LOCK = 'backoffice-migrations';

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
		// Created under the lock, so two replicas never race on CREATE TABLE.
		if (!(await knex.schema.hasTable(TABLE))) {
			await knex.schema.createTable(TABLE, (table) => {
				table.string('version', 255).primary();
				table.string('name', 255).notNullable();
				table.timestamp('timestamp').defaultTo(knex.fn.now());
			});
		}

		for (const migration of await pendingMigrations(knex, migrations)) {
			if (log) logger.info(`Applying ${migration.name}...`);
			await migration.up(knex);
			await knex.insert({ version: migration.version, name: migration.name }).into(TABLE);
			applied = true;
		}
	});

	// The schema changed: clear the caches of both apps over Redis, as the DR runner does.
	if (applied) await flushCaches(true);
}
