// Backoffice (spec 029, D-207.1, D-207.5): migration 20261101A on SQLite in memory, on the tables the seeds create.
import { createInspector } from '@backoffice/schema';
import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import runSeed from '../seeds/run.js';
import { name, up, version } from './20261101A-create-backoffice-passkeys.js';
import { BACKOFFICE_MIGRATIONS } from './index.js';

const TABLE = 'backoffice_passkeys';

let db: Knex;

beforeEach(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
	await runSeed(db);
});

afterEach(async () => {
	await db.destroy();
});

const row = (over: Record<string, unknown> = {}) => ({
	id: '7b3f2b1e-5c0a-4a4b-9f0e-2d1c3e4f5a6b',
	user: '2d6b8f10-0c4e-4b5a-8d7e-9a1b2c3d4e5f',
	credential_id: 'cred-1',
	public_key: 'pQECAyYgASFYIK',
	name: 'MacBook',
	...over,
});

test('version and name; listed after 20261028A', () => {
	expect(version).toBe('20261101A');
	expect(name).toBe('Create Backoffice Passkeys');
	expect(BACKOFFICE_MIGRATIONS.map((m) => m.version)).toEqual(['20261026A', '20261028A', '20261101A', '20261103A']);
});

test('creates backoffice_passkeys with the columns and nullability of the data model', async () => {
	await up(db);

	const columns = await createInspector(db).columnInfo(TABLE);
	const nullable = Object.fromEntries(columns.map((c) => [c.name, c.is_nullable]));

	expect(Object.keys(nullable).sort()).toEqual(
		[
			'backed_up',
			'counter',
			'credential_id',
			'date_created',
			'device_type',
			'discoverable',
			'id',
			'last_used',
			'name',
			'public_key',
			'transports',
			'user',
		].sort(),
	);

	expect(nullable).toMatchObject({
		user: false,
		credential_id: false,
		public_key: false,
		counter: false,
		name: false,
		backed_up: false,
		discoverable: false,
		date_created: false,
		transports: true,
		device_type: true,
		last_used: true,
	});
});

test('defaults: counter 0, backed_up false, discoverable true, date_created set, last_used null', async () => {
	await up(db);
	await db.insert(row()).into(TABLE);

	const [stored] = await db.select('*').from(TABLE);

	expect(Number(stored.counter)).toBe(0);
	expect(Boolean(stored.backed_up)).toBe(false);
	expect(Boolean(stored.discoverable)).toBe(true);
	expect(stored.date_created).toBeTruthy();
	expect(stored.last_used).toBeNull();
});

test('credential_id is unique, user is indexed, no foreign key', async () => {
	await up(db);

	expect(await createInspector(db).foreignKeys(TABLE)).toEqual([]);

	const indexes = await db.raw(`select name from sqlite_master where type = 'index' and tbl_name = '${TABLE}'`);
	const names = indexes.map((i: { name: string }) => i.name);
	expect(names).toContain('backoffice_passkeys_user_index');
	expect(names).toContain('backoffice_passkeys_credential_id_unique');

	await db.insert(row()).into(TABLE);
	await expect(db.insert(row({ id: 'other' })).into(TABLE)).rejects.toThrow();
});

test('adds a nullable bo_passkey column without default to directus_sessions; existing rows get null', async () => {
	await db
		.insert({ token: 't1', user: '2d6b8f10-0c4e-4b5a-8d7e-9a1b2c3d4e5f', expires: new Date(Date.now() + 60_000) })
		.into('directus_sessions');

	await up(db);

	const columns = await createInspector(db).columnInfo('directus_sessions');
	const column = columns.find((c) => c.name === 'bo_passkey');
	expect(column).toMatchObject({ is_nullable: true, default_value: null });
	expect(await db.select('bo_passkey').from('directus_sessions')).toEqual([{ bo_passkey: null }]);
});

const sessionFieldRows = () =>
	db
		.select('field', 'special', 'interface', 'readonly', 'hidden', 'width', 'translations')
		.from('directus_fields')
		.where({ collection: 'directus_sessions' });

test('adds one hidden, read-only directus_fields row for bo_passkey with en-US and vi-VN labels', async () => {
	await up(db);

	const rows = (await sessionFieldRows()).map((r) => ({
		...r,
		readonly: Boolean(r.readonly),
		hidden: Boolean(r.hidden),
		translations: JSON.parse(r.translations),
	}));

	expect(rows).toEqual([
		{
			field: 'bo_passkey',
			special: 'cast-boolean',
			interface: 'boolean',
			readonly: true,
			hidden: true,
			width: 'half',
			translations: [
				{ language: 'en-US', translation: 'Passkey Session' },
				{ language: 'vi-VN', translation: 'Phiên passkey' },
			],
		},
	]);
});

test('runs again without error and keeps the rows and the column', async () => {
	await up(db);
	await db.insert(row()).into(TABLE);

	await up(db);

	expect(await db.count('* as count').from(TABLE)).toEqual([{ count: 1 }]);
	expect(await db.schema.hasColumn('directus_sessions', 'bo_passkey')).toBe(true);
	expect(await sessionFieldRows()).toHaveLength(1);
});

test('a duplicate directus_fields row another process inserted is removed, the first one kept', async () => {
	await up(db);
	const [first] = await db.select('id').from('directus_fields').where({ field: 'bo_passkey' });
	await db.insert({ collection: 'directus_sessions', field: 'bo_passkey' }).into('directus_fields');

	await up(db);

	expect(await db.select('id').from('directus_fields').where({ field: 'bo_passkey' })).toEqual([first]);
});

// CI 40298326039: two processes without a shared lock run up at once (no Redis).
test('concurrent runs: a table and a column another process created first are not errors', async () => {
	await up(db);
	const hasTable = vi.spyOn(db.schema, 'hasTable').mockResolvedValueOnce(false);
	const hasColumn = vi.spyOn(db.schema, 'hasColumn').mockResolvedValueOnce(false);

	await expect(up(db)).resolves.toBeUndefined();
	hasTable.mockRestore();
	hasColumn.mockRestore();
});
