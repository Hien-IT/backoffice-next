// Ported from directus/api/src/database/migrations/20210331A-add-refresh-interval.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_presets', (table) => {
		table.integer('refresh_interval');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_presets', (table) => {
		table.dropColumn('refresh_interval');
	});
}
