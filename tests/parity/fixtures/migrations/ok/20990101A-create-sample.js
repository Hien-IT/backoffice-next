// Spec 021 parity fixture: a custom migration that creates a table.
export async function up(knex) {
	await knex.schema.createTable('bo_migration_sample', (table) => {
		table.increments('id');
		table.string('name', 64);
	});
}

export async function down(knex) {
	await knex.schema.dropTable('bo_migration_sample');
}
