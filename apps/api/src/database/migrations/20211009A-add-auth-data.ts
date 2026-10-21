// Ported from directus/api/src/database/migrations/20211009A-add-auth-data.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_users', (table) => {
		table.json('auth_data');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_users', (table) => {
		table.dropColumn('auth_data');
	});
}
