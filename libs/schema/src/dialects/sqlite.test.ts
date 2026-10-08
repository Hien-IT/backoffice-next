import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createInspector } from '../index.js';
import SQLite, { parseDefaultValue } from './sqlite.js';

let db: Knex;

beforeAll(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
	await db.raw('PRAGMA foreign_keys = ON');
	await db.raw(
		`CREATE TABLE authors (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(100) NOT NULL DEFAULT 'anon')`,
	);

	await db.raw(`CREATE TABLE articles (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT,
		score DECIMAL(10, 2) DEFAULT 0,
		author INTEGER REFERENCES authors(id) ON DELETE SET NULL,
		slug VARCHAR(50) UNIQUE
	)`);

	await db.raw('CREATE TABLE no_pk (a TEXT, b TEXT)');
});

afterAll(() => db.destroy());

describe('SQLite inspector (real in-memory database)', () => {
	test('createInspector picks the SQLite dialect', () => {
		expect(createInspector(db)).toBeInstanceOf(SQLite);
	});

	test('tables, tableInfo, hasTable', async () => {
		const inspector = createInspector(db);
		expect((await inspector.tables()).sort()).toEqual(['articles', 'authors', 'no_pk']);
		expect(await inspector.tableInfo('authors')).toMatchObject({ name: 'authors' });
		expect((await inspector.tableInfo()).map((t) => t.name).sort()).toEqual(['articles', 'authors', 'no_pk']);
		expect(await inspector.hasTable('authors')).toBe(true);
		expect(await inspector.hasTable('nope')).toBe(false);
	});

	test('columns, columnInfo, hasColumn, primary', async () => {
		const inspector = createInspector(db);
		expect(await inspector.columns('authors')).toEqual([
			{ table: 'authors', column: 'id' },
			{ table: 'authors', column: 'name' },
		]);
		expect((await inspector.columns()).length).toBe(9);

		const name = await inspector.columnInfo('authors', 'name');
		expect(name).toMatchObject({
			name: 'name',
			table: 'authors',
			data_type: 'varchar',
			max_length: 100,
			is_nullable: false,
			default_value: 'anon',
		});

		const author = await inspector.columnInfo('articles', 'author');
		expect(author).toMatchObject({ foreign_key_table: 'authors', foreign_key_column: 'id' });

		const score = await inspector.columnInfo('articles', 'score');
		// Directus' SQLite inspector does not read precision/scale from the declared type.
		expect(score).toMatchObject({ data_type: 'decimal', numeric_precision: null, numeric_scale: null });

		expect((await inspector.columnInfo('articles')).find((c) => c.name === 'slug')).toMatchObject({ is_unique: true });
		expect((await inspector.columnInfo()).length).toBe(9);
		expect(await inspector.hasColumn('authors', 'name')).toBe(true);
		expect(await inspector.hasColumn('authors', 'nope')).toBe(false);
		expect(await inspector.primary('authors')).toBe('id');
		expect(await inspector.primary('no_pk')).toBe(null);
	});

	test('foreignKeys', async () => {
		const inspector = createInspector(db);
		const fks = await inspector.foreignKeys('articles');
		expect(fks).toEqual([
			expect.objectContaining({
				table: 'articles',
				column: 'author',
				foreign_key_table: 'authors',
				foreign_key_column: 'id',
				on_delete: 'SET NULL',
			}),
		]);
		expect(await inspector.foreignKeys()).toEqual(fks);
	});

	test('overview', async () => {
		const overview = await createInspector(db).overview();
		expect(Object.keys(overview).sort()).toEqual(['articles', 'authors', 'no_pk']);
		expect(overview['authors']).toMatchObject({
			primary: 'id',
			columns: { name: { default_value: 'anon', is_nullable: false } },
		});
	});

	test('parseDefaultValue', () => {
		expect(parseDefaultValue(null)).toBe(null);
		expect(parseDefaultValue("'x'")).toBe('x');
		expect(parseDefaultValue('null')).toBe(null);
	});
});

test('createInspector rejects an unknown client', () => {
	expect(() => createInspector({ client: { constructor: { name: 'Client_Unknown' } } } as never)).toThrow(
		'Unsupported driver used: Client_Unknown',
	);
});
