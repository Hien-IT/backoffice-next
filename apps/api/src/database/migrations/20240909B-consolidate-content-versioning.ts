// Ported from directus/api/src/database/migrations/20240909B-consolidate-content-versioning.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_versions', (table) => {
		table.json('delta');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_versions', (table) => {
		table.dropColumn('delta');
	});
}
