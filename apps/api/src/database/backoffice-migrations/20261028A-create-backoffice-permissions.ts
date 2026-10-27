// Backoffice (spec 025, D-189.5): the table of the Backoffice permission actions (import, export, later more). The
// columns of directus_permissions plus `options`; `action` is a free string so a later action needs no DDL. No foreign
// key, so DR sees no constraint on directus_policies (rows of a deleted policy are ignored when read). No directus_fields
// rows: the SchemaOverview shared with DR stays the one DR builds (research R1).
import type { Knex } from 'knex';

export const version = '20261028A';
export const name = 'Create Backoffice Permissions';

const TABLE = 'backoffice_permissions';

export async function up(knex: Knex): Promise<void> {
	if (await knex.schema.hasTable(TABLE)) return;

	try {
		await knex.schema.createTable(TABLE, (table) => {
			table.increments('id');
			table.uuid('policy').notNullable();
			table.string('collection', 64).nullable();
			table.string('action', 64).notNullable();
			table.json('permissions').nullable();
			table.json('validation').nullable();
			table.json('presets').nullable();
			table.text('fields').nullable();
			table.json('options').nullable();
			table.index(['policy', 'collection', 'action']);
		});
	} catch (error) {
		// Another process without a shared lock created it first (CI 40298326039).
		if (!(await knex.schema.hasTable(TABLE))) throw error;
	}
}
