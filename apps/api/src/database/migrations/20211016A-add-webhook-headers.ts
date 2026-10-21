// Ported from directus/api/src/database/migrations/20211016A-add-webhook-headers.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_webhooks', (table) => {
		table.json('headers');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_webhooks', (table) => {
		table.dropColumn('headers');
	});
}
