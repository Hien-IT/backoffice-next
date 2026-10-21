// Ported from directus/api/src/database/migrations/20211103A-set-unique-to-user-token.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_users', (table) => {
		table.unique(['token']);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_users', (table) => {
		table.dropUnique(['token']);
	});
}
