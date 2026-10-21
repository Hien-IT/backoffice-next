// Ported from directus/api/src/database/migrations/20210927B-replace-m2m-interface.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex('directus_fields')
		.update({
			interface: 'files',
		})
		.where('interface', '=', 'list-m2m')
		.andWhere('special', '=', 'files');
}

export async function down(knex: Knex): Promise<void> {
	await knex('directus_fields')
		.update({
			interface: 'list-m2m',
		})
		.where('interface', '=', 'files')
		.andWhere('special', '=', 'files');
}
