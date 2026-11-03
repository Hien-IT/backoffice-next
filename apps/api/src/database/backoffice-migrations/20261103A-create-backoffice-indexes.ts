// Backoffice (spec 030, D-210.2): the indexes Backoffice created on user collections (composite B-tree, trigram), one
// row per index (data-model.md). The index itself lives on the user table; this row carries the definition and the
// state of the background job that builds it (creating, ready, failed). No foreign key to directus_collections (DR
// deleting the collection leaves the row, which GET reports as missing); no directus_fields rows (hidden system
// collection). Re-runnable, and safe when two processes without a shared lock run it at once.
import type { Knex } from 'knex';

export const version = '20261103A';
export const name = 'Create Backoffice Indexes';

const TABLE = 'backoffice_indexes';

export async function up(knex: Knex): Promise<void> {
	if (await knex.schema.hasTable(TABLE)) return;

	try {
		await knex.schema.createTable(TABLE, (table) => {
			table.uuid('id').primary().notNullable();
			table.string('collection', 64).notNullable().index('backoffice_indexes_collection_index');
			// The real index name; unique is what keeps two replicas from building the same index (research R4).
			table.string('name', 128).notNullable().unique('backoffice_indexes_name_unique');
			table.json('fields').notNullable();
			table.string('type', 16).notNullable();
			table.boolean('unique').notNullable().defaultTo(false);
			table.string('status', 16).notNullable().defaultTo('creating');
			table.text('error').nullable();
			table.timestamp('date_created').notNullable().defaultTo(knex.fn.now());
		});
	} catch (error) {
		// Another process without a shared lock created it first (CI 40298326039).
		if (!(await knex.schema.hasTable(TABLE))) throw error;
	}
}
