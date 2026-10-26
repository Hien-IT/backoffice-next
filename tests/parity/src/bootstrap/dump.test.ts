import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { dump } from './dump.js';

let db: Knex;

beforeEach(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });

	await db.schema.createTable('directus_roles', (t) => {
		t.uuid('id').primary();
		t.string('name', 100).notNullable();
	});

	await db.schema.createTable('directus_users', (t) => {
		t.uuid('id').primary();
		t.uuid('role').references('id').inTable('directus_roles').onDelete('SET NULL');
		t.boolean('active').defaultTo(true);
		t.index(['active'], 'users_active_idx');
	});

	await db.schema.createTable('bo_other', (t) => t.increments('id'));
	await db('directus_roles').insert({ id: '11111111-1111-4111-8111-111111111111', name: 'Admin' });
});

afterEach(async () => {
	await db.destroy();
});

test('directus_* tables only, with columns, primary key, foreign keys, indexes and rows', async () => {
	const result = await dump(db);

	expect(result.tables.map((t) => t.name)).toEqual(['directus_roles', 'directus_users']);
	expect(result.tables[0]!.columns.map((c) => c.name)).toEqual(['id', 'name']);
	expect(result.tables[0]!.primary).toBe('id');
	expect(result.foreignKeys).toEqual([
		expect.objectContaining({
			table: 'directus_users',
			column: 'role',
			foreign_key_table: 'directus_roles',
			foreign_key_column: 'id',
			on_delete: 'SET NULL',
		}),
	]);
	expect(result.indexes.map((i) => i.name)).toContain('users_active_idx');
	expect(result.rows['directus_roles']).toEqual([{ id: '11111111-1111-4111-8111-111111111111', name: 'Admin' }]);
	expect(result.rows['bo_other']).toBeUndefined();
});

test('the Backoffice migrations are left out: backoffice_* tables, bo_* columns and their directus_fields rows (D-180)', async () => {
	await db.schema.createTable('directus_fields', (t) => {
		t.increments('id');
		t.string('collection');
		t.string('field');
	});
	await db.schema.alterTable('directus_roles', (t) => t.boolean('bo_flag').defaultTo(true));
	await db.schema.createTable('backoffice_migrations', (t) => t.string('version').primary());
	await db('directus_fields').insert([
		{ collection: 'directus_roles', field: 'name' },
		{ collection: 'directus_roles', field: 'bo_flag' },
	]);

	const result = await dump(db);

	expect(result.tables.map((t) => t.name)).not.toContain('backoffice_migrations');
	expect(result.tables.find((t) => t.name === 'directus_roles')!.columns.map((c) => c.name)).toEqual(['id', 'name']);
	expect(result.rows['directus_roles']).toEqual([{ id: '11111111-1111-4111-8111-111111111111', name: 'Admin' }]);
	expect(result.rows['directus_fields']).toEqual([{ id: 1, collection: 'directus_roles', field: 'name' }]);
});
