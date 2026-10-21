// Ported from directus/api/src/database/migrations/20260128A-add-collaborative-editing.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_settings', (table) => {
		table.boolean('collaborative_editing_enabled').defaultTo(false).notNullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_settings', (table) => {
		table.dropColumn('collaborative_editing_enabled');
	});
}
