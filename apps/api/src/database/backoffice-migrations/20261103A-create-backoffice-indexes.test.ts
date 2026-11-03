// Backoffice (spec 030, D-210.2): migration 20261103A on SQLite in memory, on the tables the seeds create.
import { createInspector } from '@backoffice/schema';
import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import runSeed from '../seeds/run.js';
import { name, up, version } from './20261103A-create-backoffice-indexes.js';
import { BACKOFFICE_MIGRATIONS } from './index.js';

const TABLE = 'backoffice_indexes';

let db: Knex;

beforeEach(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
	await runSeed(db);
});

afterEach(async () => {
	await db.destroy();
});

const row = (over: Record<string, unknown> = {}) => ({
	id: '3f6c1b2a-9d4e-4c8b-8a1f-2b3c4d5e6f70',
	collection: 'articles',
	name: 'articles_a_b_unique',
	fields: JSON.stringify(['a', 'b']),
	type: 'btree',
	unique: true,
	...over,
});

test('version and name; listed after 20261101A', () => {
	expect(version).toBe('20261103A');
	expect(name).toBe('Create Backoffice Indexes');
	expect(BACKOFFICE_MIGRATIONS.map((m) => m.version)).toEqual(['20261026A', '20261028A', '20261101A', '20261103A']);
});

test('creates backoffice_indexes with the columns and nullability of the data model', async () => {
	await up(db);

	const columns = await createInspector(db).columnInfo(TABLE);
	const nullable = Object.fromEntries(columns.map((c) => [c.name, c.is_nullable]));

	expect(Object.keys(nullable).sort()).toEqual(
		['collection', 'date_created', 'error', 'fields', 'id', 'name', 'status', 'type', 'unique'].sort(),
	);

	expect(nullable).toMatchObject({
		id: false,
		collection: false,
		name: false,
		fields: false,
		type: false,
		unique: false,
		status: false,
		date_created: false,
		error: true,
	});
});

test('defaults: unique false, status creating, error null, date_created set', async () => {
	await up(db);
	const { unique: _unique, ...withoutUnique } = row();
	await db.insert(withoutUnique).into(TABLE);

	const [stored] = await db.select('*').from(TABLE);

	expect(Boolean(stored.unique)).toBe(false);
	expect(stored.status).toBe('creating');
	expect(stored.error).toBeNull();
	expect(stored.date_created).toBeTruthy();
});

test('name is unique, collection is indexed, no foreign key', async () => {
	await up(db);

	expect(await createInspector(db).foreignKeys(TABLE)).toEqual([]);

	const indexes = await db.raw(`select name from sqlite_master where type = 'index' and tbl_name = '${TABLE}'`);
	const names = indexes.map((i: { name: string }) => i.name);
	expect(names).toContain('backoffice_indexes_collection_index');
	expect(names).toContain('backoffice_indexes_name_unique');

	await db.insert(row()).into(TABLE);
	await expect(db.insert(row({ id: 'other' })).into(TABLE)).rejects.toThrow();
});

test('runs again without error and keeps the rows', async () => {
	await up(db);
	await db.insert(row()).into(TABLE);

	await up(db);

	expect(await db.count('* as count').from(TABLE)).toEqual([{ count: 1 }]);
});

// Two processes without a shared lock run up at once (no Redis), as CI 40298326039 showed for 20261028A.
test('concurrent runs: a table another process created first is not an error', async () => {
	await up(db);
	const hasTable = vi.spyOn(db.schema, 'hasTable').mockResolvedValueOnce(false);

	await expect(up(db)).resolves.toBeUndefined();
	hasTable.mockRestore();
});
