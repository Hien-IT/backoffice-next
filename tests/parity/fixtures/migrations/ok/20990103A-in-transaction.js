// Spec 021 parity fixture: a custom migration that writes rows inside a transaction.
export async function up(knex) {
	await knex.transaction(async (trx) => {
		await trx('bo_migration_sample').insert([{ name: 'one' }, { name: 'two' }]);
	});
}

export async function down(knex) {
	await knex.transaction(async (trx) => {
		await trx('bo_migration_sample').whereIn('name', ['one', 'two']).delete();
	});
}
