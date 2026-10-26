// Backoffice (spec 022, D-180): the Backoffice migrations, a static list so nothing is read from disk and the DR
// migration runner (database/migrations/run.ts, a verbatim port) never sees them. A new migration is a file next to
// this one and a line below, in version order (constitution II, 3.2.0: only backoffice_* tables, bo_* columns on
// directus_* tables and their directus_fields rows; up only, re-runnable, Knex only).
import type { Knex } from 'knex';
import * as addCollectionUiToggles from './20261026A-add-collection-ui-toggles.js';

export interface BackofficeMigration {
	/** `YYYYMMDD` + a letter, like the DR migrations; the primary key of backoffice_migrations. */
	version: string;
	name: string;
	up(knex: Knex): Promise<void>;
}

export const BACKOFFICE_MIGRATIONS: readonly BackofficeMigration[] = [addCollectionUiToggles];

export const TABLE = 'backoffice_migrations';

/** The versions in backoffice_migrations; none when the table does not exist yet. */
export async function completedBackofficeMigrations(knex: Knex): Promise<string[]> {
	if (!(await knex.schema.hasTable(TABLE))) return [];
	return (await knex.select('version').from(TABLE)).map((row) => String(row['version']));
}
