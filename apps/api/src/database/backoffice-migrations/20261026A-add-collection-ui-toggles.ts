// Backoffice (spec 022, D-179, D-180): the per-collection Content toggles. Three nullable boolean columns on
// directus_collections (default true; null or true = shown) and their directus_fields rows, so the collection form of
// both apps shows three labelled toggles. Re-runnable: a column a schema apply created and a row already there are kept.
import type { Knex } from 'knex';

export const version = '20261026A';
export const name = 'Add Collection UI Toggles';

const FIELDS = [
	{ field: 'bo_show_search', en: 'Show Search', vi: 'Hiện ô tìm kiếm' },
	{ field: 'bo_show_import', en: 'Show Import', vi: 'Hiện Import' },
	{ field: 'bo_show_export', en: 'Show Export', vi: 'Hiện Export' },
];

export async function up(knex: Knex): Promise<void> {
	for (const { field, en, vi } of FIELDS) {
		if (!(await knex.schema.hasColumn('directus_collections', field))) {
			try {
				await knex.schema.alterTable('directus_collections', (table) => {
					table.boolean(field).defaultTo(true);
				});
			} catch (error) {
				// Another process without a shared lock added it first (CI 40298326039).
				if (!(await knex.schema.hasColumn('directus_collections', field))) throw error;
			}
		}

		const row = await knex.select('id').from('directus_fields').where({ collection: 'directus_collections', field });

		if (row.length === 0) {
			await knex
				.insert({
					collection: 'directus_collections',
					field,
					// MySQL and SQLite store booleans as numbers: cast-boolean gives true/false in `meta` like the DR fields.
					special: 'cast-boolean',
					interface: 'boolean',
					width: 'half',
					// A string, not an object: every vendor's driver stores it as the JSON of the column.
					translations: JSON.stringify([
						{ language: 'en-US', translation: en },
						{ language: 'vi-VN', translation: vi },
					]),
				})
				.into('directus_fields');
		}

		// Two processes without a shared lock may both have inserted it: keep the first row.
		const rows = await knex
			.select('id')
			.from('directus_fields')
			.where({ collection: 'directus_collections', field })
			.orderBy('id');

		if (rows.length > 1) {
			await knex('directus_fields')
				.whereIn(
					'id',
					rows.slice(1).map((r) => r.id),
				)
				.delete();
		}
	}
}
