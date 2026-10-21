// Backoffice (spec 021 D-145, FR-008, FR-026): Backoffice installs and migrates Postgres and SQLite databases only; the
// other vendors are installed and migrated by the Directus 11.17.4 image. The migration and seed runners stay verbatim;
// the gate is in the commands.
import type { Knex } from 'knex';
import { getDatabaseClient } from '../../database/index.js';

const BOOTSTRAP_CLIENTS: readonly string[] = ['postgres', 'sqlite'];

/** The database client when Backoffice does not install or migrate it, otherwise null. */
export function unsupportedClient(database: Knex): string | null {
	const client = getDatabaseClient(database);
	return BOOTSTRAP_CLIENTS.includes(client) ? null : client;
}

export const vendorMessages = {
	bootstrapEmpty: (client: string) =>
		`Backoffice bootstraps only Postgres and SQLite databases; on ${client} run "node cli.js bootstrap" with the Directus 11.17.4 image (D-145)`,
	bootstrapInstalled: (client: string) =>
		`Database on ${client} is migrated by Directus 11.17.4 (D-145); skipping migrations`,
	migrate: (client: string) =>
		`Backoffice runs migrations only on Postgres and SQLite databases; on ${client} use the Directus 11.17.4 image (D-145)`,
};
