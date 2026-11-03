// Backoffice (spec 022, D-180): the Backoffice migrations, a static list so nothing is read from disk and the DR
// migration runner (database/migrations/run.ts, a verbatim port) never sees them. A new migration is a file next to
// this one and a line below, in version order (constitution II, 3.2.0: only backoffice_* tables, bo_* columns on
// directus_* tables and their directus_fields rows; up only, re-runnable, Knex only). Every new bo_* column also gets
// its directus_fields row in the same migration (hidden and read-only when users must not edit it), or the Data Model
// of both apps lists it as "Database Only" (owner 2026-11-01; see 20261026A, 20261101A).
import type { Knex } from 'knex';
import * as addCollectionUiToggles from './20261026A-add-collection-ui-toggles.js';
import * as createBackofficePermissions from './20261028A-create-backoffice-permissions.js';
import * as createBackofficePasskeys from './20261101A-create-backoffice-passkeys.js';
import * as createBackofficeIndexes from './20261103A-create-backoffice-indexes.js';

export interface BackofficeMigration {
	/** `YYYYMMDD` + a letter, like the DR migrations; the primary key of backoffice_migrations. */
	version: string;
	name: string;
	up(knex: Knex): Promise<void>;
}

export const BACKOFFICE_MIGRATIONS: readonly BackofficeMigration[] = [
	addCollectionUiToggles,
	createBackofficePermissions,
	createBackofficePasskeys,
	createBackofficeIndexes,
];

export const TABLE = 'backoffice_migrations';

/** The versions in backoffice_migrations; none when the table does not exist yet. */
export async function completedBackofficeMigrations(knex: Knex): Promise<string[]> {
	if (!(await knex.schema.hasTable(TABLE))) return [];
	return (await knex.select('version').from(TABLE)).map((row) => String(row['version']));
}
