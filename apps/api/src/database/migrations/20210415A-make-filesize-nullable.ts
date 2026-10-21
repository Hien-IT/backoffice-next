// Ported from directus/api/src/database/migrations/20210415A-make-filesize-nullable.ts
import type { Knex } from 'knex';
import { getHelpers } from '../helpers/index.js';

export async function up(knex: Knex): Promise<void> {
	const helper = getHelpers(knex).schema;

	await helper.changeToType('directus_files', 'filesize', 'integer', {
		nullable: true,
		default: null,
	});
}

export async function down(knex: Knex): Promise<void> {
	const helper = getHelpers(knex).schema;

	await helper.changeToType('directus_files', 'filesize', 'integer', {
		nullable: false,
		default: 0,
	});
}
