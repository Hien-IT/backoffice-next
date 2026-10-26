// Backoffice (spec 022, D-179, D-180): migration 20261026A on SQLite in memory, on the tables the seeds create.
import { createInspector } from '@backoffice/schema';
import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import runSeed from '../seeds/run.js';
import { name, up, version } from './20261026A-add-collection-ui-toggles.js';

const COLUMNS = ['bo_show_search', 'bo_show_import', 'bo_show_export'];

let db: Knex;

beforeEach(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
	await runSeed(db);
});

afterEach(async () => {
	await db.destroy();
});

const fieldRows = () =>
	db
		.select('field', 'special', 'interface', 'width', 'translations', 'hidden', 'sort')
		.from('directus_fields')
		.where({ collection: 'directus_collections' })
		.whereIn('field', COLUMNS)
		.orderBy('field');

test('version and name', () => {
	expect(version).toBe('20261026A');
	expect(name).toBe('Add Collection UI Toggles');
});

test('adds three nullable boolean columns defaulting to true; existing rows get true', async () => {
	await db.insert({ collection: 'articles' }).into('directus_collections');

	await up(db);

	const columns = await createInspector(db).columnInfo('directus_collections');

	for (const column of COLUMNS) {
		const info = columns.find((c) => c.name === column);
		expect(info, column).toBeDefined();
		expect(info!.is_nullable, column).toBe(true);
		expect(String(info!.default_value), column).toMatch(/^(true|1|'1')$/);
	}

	const [row] = await db
		.select(...COLUMNS)
		.from('directus_collections')
		.where({ collection: 'articles' });
	expect(COLUMNS.map((c) => Boolean(row[c]))).toEqual([true, true, true]);
});

test('adds the three directus_fields rows: boolean interface, half width, en-US and vi-VN labels', async () => {
	await up(db);

	const rows = (await fieldRows()).map((r) => ({ ...r, translations: JSON.parse(r.translations) }));

	expect(rows).toEqual([
		{
			field: 'bo_show_export',
			special: 'cast-boolean',
			interface: 'boolean',
			width: 'half',
			translations: [
				{ language: 'en-US', translation: 'Show Export' },
				{ language: 'vi-VN', translation: 'Hiện Export' },
			],
			hidden: expect.anything(),
			sort: null,
		},
		{
			field: 'bo_show_import',
			special: 'cast-boolean',
			interface: 'boolean',
			width: 'half',
			translations: [
				{ language: 'en-US', translation: 'Show Import' },
				{ language: 'vi-VN', translation: 'Hiện Import' },
			],
			hidden: expect.anything(),
			sort: null,
		},
		{
			field: 'bo_show_search',
			special: 'cast-boolean',
			interface: 'boolean',
			width: 'half',
			translations: [
				{ language: 'en-US', translation: 'Show Search' },
				{ language: 'vi-VN', translation: 'Hiện ô tìm kiếm' },
			],
			hidden: expect.anything(),
			sort: null,
		},
	]);
	expect(rows.every((r) => !r.hidden)).toBe(true);
});

test('runs again without error and without duplicate rows (FR-014)', async () => {
	await up(db);
	await up(db);

	expect(await fieldRows()).toHaveLength(3);
});

// CI 40298326039: two processes without a shared lock run up at once (profile schema-cache-nomsg, no Redis).
test('concurrent runs: a column another process added first and its duplicate field rows are not errors', async () => {
	// This process read "no column" just before the other one added it.
	await db.schema.alterTable('directus_collections', (table) => table.boolean('bo_show_search').defaultTo(true));
	const hasColumn = vi.spyOn(db.schema, 'hasColumn').mockResolvedValueOnce(false);
	// Both processes inserted the row of bo_show_import.
	const row = { collection: 'directus_collections', field: 'bo_show_import', interface: 'boolean' };
	await db.insert([row, row]).into('directus_fields');

	await up(db);
	hasColumn.mockRestore();

	expect(await fieldRows()).toHaveLength(3);
	const columns = (await createInspector(db).columnInfo('directus_collections')).map((c) => c.name);
	expect(columns).toEqual(expect.arrayContaining(COLUMNS));
});

test('a column created before (schema apply) is kept; the missing ones and the rows are added', async () => {
	await db.schema.alterTable('directus_collections', (table) => table.boolean('bo_show_search').defaultTo(false));

	await up(db);

	const columns = (await createInspector(db).columnInfo('directus_collections')).map((c) => c.name);
	expect(columns).toEqual(expect.arrayContaining(COLUMNS));
	expect(await fieldRows()).toHaveLength(3);
});
