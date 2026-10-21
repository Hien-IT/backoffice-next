// Ported from directus/api/src/database/migrations/20211104A-remove-collections-listing.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_roles', (table) => {
		table.dropColumn('collection_list');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_roles', (table) => {
		table.json('collection_list');
	});
}
