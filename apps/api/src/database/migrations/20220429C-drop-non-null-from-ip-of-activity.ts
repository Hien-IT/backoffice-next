// Ported from directus/api/src/database/migrations/20220429C-drop-non-null-from-ip-of-activity.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_activity', (table) => {
		table.setNullable('ip');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_activity', (table) => {
		table.dropNullable('ip');
	});
}
