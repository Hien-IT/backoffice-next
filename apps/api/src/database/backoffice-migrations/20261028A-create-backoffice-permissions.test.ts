// Backoffice (spec 025, D-189.5): migration 20261028A on SQLite in memory, on the tables the seeds create.
import { createInspector } from '@backoffice/schema';
import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import runSeed from '../seeds/run.js';
import { name, up, version } from './20261028A-create-backoffice-permissions.js';
import { BACKOFFICE_MIGRATIONS } from './index.js';

const TABLE = 'backoffice_permissions';

let db: Knex;

beforeEach(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
	await runSeed(db);
});

afterEach(async () => {
	await db.destroy();
});

test('version and name; listed after 20261026A', () => {
	expect(version).toBe('20261028A');
	expect(name).toBe('Create Backoffice Permissions');
	expect(BACKOFFICE_MIGRATIONS.map((m) => m.version)).toEqual(['20261026A', '20261028A']);
});

test('creates the table with the columns of directus_permissions plus options', async () => {
	await up(db);

	const columns = await createInspector(db).columnInfo(TABLE);
	const nullable = Object.fromEntries(columns.map((c) => [c.name, c.is_nullable]));

	expect(Object.keys(nullable).sort()).toEqual(
		['action', 'collection', 'fields', 'id', 'options', 'permissions', 'policy', 'presets', 'validation'].sort(),
	);

	expect(nullable).toMatchObject({
		policy: false,
		action: false,
		collection: true,
		permissions: true,
		validation: true,
		presets: true,
		fields: true,
		options: true,
	});
});

test('no foreign key to a directus_* table; an index on policy, collection, action', async () => {
	await up(db);

	expect(await createInspector(db).foreignKeys(TABLE)).toEqual([]);

	const indexes = await db.raw(`select name from sqlite_master where type = 'index' and tbl_name = '${TABLE}'`);
	expect(indexes.map((i: { name: string }) => i.name)).toContain(
		'backoffice_permissions_policy_collection_action_index',
	);
});

test('an action name longer than the 10 characters of directus_permissions fits (later actions, FR-003)', async () => {
	await up(db);

	await db
		.insert({ policy: 'a8e1a1c4-7c55-4c39-9a5d-1d1fd3a8b8a1', collection: 'articles', action: 'batch_update_items' })
		.into(TABLE);

	expect(await db.select('action').from(TABLE)).toEqual([{ action: 'batch_update_items' }]);
});

test('runs again without error and keeps the rows', async () => {
	await up(db);
	await db.insert({ policy: 'p', collection: 'articles', action: 'export' }).into(TABLE);

	await up(db);

	expect(await db.count('* as count').from(TABLE)).toEqual([{ count: 1 }]);
});

// CI 40298326039: two processes without a shared lock run up at once (no Redis).
test('concurrent runs: the table another process created first is not an error', async () => {
	await up(db);
	const hasTable = vi.spyOn(db.schema, 'hasTable').mockResolvedValueOnce(false);

	await expect(up(db)).resolves.toBeUndefined();
	hasTable.mockRestore();
});
