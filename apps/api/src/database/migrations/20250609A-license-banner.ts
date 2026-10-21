// Ported from directus/api/src/database/migrations/20250609A-license-banner.ts
import { useEnv } from '@backoffice/env';
import { toBoolean } from '@backoffice/utils';
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	const env = useEnv();

	const acceptedTerms: boolean = toBoolean(env['ACCEPT_TERMS']);

	await knex.schema.alterTable('directus_settings', (table) => {
		table.boolean('accepted_terms').defaultTo(acceptedTerms);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_settings', (table) => {
		table.dropColumn('accepted_terms');
	});
}
