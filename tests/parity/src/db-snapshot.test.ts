import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { snapshot } from './db-snapshot.js';

let db: Knex;

beforeEach(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
	await db.raw('create table a (id integer primary key, name text)');
	await db.raw('create table b (x text, y text)');
	await db.raw('create index a_name on a (name)');
	await db('a').insert([
		{ id: 2, name: 'two' },
		{ id: 1, name: 'one' },
	]);
	await db('b').insert([
		{ x: '2', y: 'b' },
		{ x: '1', y: 'a' },
	]);
});

afterEach(() => db.destroy());

test('stable when nothing changes; covers tables, indexes and rows', async () => {
	const first = await snapshot(db);
	expect(first.tables.map((t) => [t.name, t.rowCount])).toEqual([
		['a', 2],
		['b', 2],
	]);
	expect(first.indexes).toEqual([{ table: 'a', name: 'a_name', unique: false, columns: ['name'] }]);
	expect(await snapshot(db)).toEqual(first);
});

test('detects a changed row, including in a table without primary key', async () => {
	const before = await snapshot(db);
	await db('b').where({ x: '1' }).update({ y: 'changed' });
	const after = await snapshot(db);
	expect(after.tables[1]!.checksum).not.toBe(before.tables[1]!.checksum);
	expect(after.tables[0]).toEqual(before.tables[0]);
});

test('detects an index whose columns changed', async () => {
	const before = await snapshot(db);
	await db.raw('drop index a_name');
	await db.raw('create index a_name on a (id, name)');
	expect((await snapshot(db)).indexes).not.toEqual(before.indexes);
});

test('detects a new column and a new table', async () => {
	const before = await snapshot(db);
	await db.raw('alter table a add column extra text');
	await db.raw('create table c (id integer primary key)');
	const after = await snapshot(db);
	expect(after.tables.map((t) => t.name)).toEqual(['a', 'b', 'c']);
	expect(after.tables[0]!.columns).not.toEqual(before.tables[0]!.columns);
});
