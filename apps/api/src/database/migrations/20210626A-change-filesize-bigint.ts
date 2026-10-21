// Ported from directus/api/src/database/migrations/20210626A-change-filesize-bigint.ts
import type { Knex } from 'knex';
import { getHelpers } from '../helpers/index.js';

export async function up(knex: Knex): Promise<void> {
	const helper = getHelpers(knex).schema;

	if (helper.isOneOfClients(['oracle', 'cockroachdb'])) {
		return;
	}

	await knex.schema.alterTable('directus_files', (table) => {
		table.bigInteger('filesize').nullable().defaultTo(null).alter();
	});
}

export async function down(knex: Knex): Promise<void> {
	const helper = getHelpers(knex).schema;

	if (helper.isOneOfClients(['oracle', 'cockroachdb'])) {
		return;
	}

	await knex.schema.alterTable('directus_files', (table) => {
		table.integer('filesize').nullable().defaultTo(null).alter();
	});
}
