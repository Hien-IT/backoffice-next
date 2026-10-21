// Spec 021 parity fixture: a custom migration that adds a column with a default.
export async function up(knex) {
	await knex.schema.alterTable('bo_migration_sample', (table) => {
		table.boolean('enabled').notNullable().defaultTo(true);
	});
}

export async function down(knex) {
	await knex.schema.alterTable('bo_migration_sample', (table) => {
		table.dropColumn('enabled');
	});
}
