import { useEnv } from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createDirectusDb } from '../../test/directus-db.js';
import { useLogger } from '../logger/index.js';
import { getDatabaseSchema, getSchema } from './get-database-schema.js';

vi.mock('@backoffice/env');
vi.mock('../logger/index.js');

const logger = { warn: vi.fn(), trace: vi.fn() };
let db: Knex;

beforeEach(async () => {
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(useEnv).mockReturnValue({ DB_EXCLUDE_TABLES: ['spatial_ref_sys'] });
	db = await createDirectusDb();

	await db.schema.createTable('articles', (t) => {
		t.increments('id');
		t.string('title').notNullable().defaultTo('untitled');
		t.decimal('price', 10, 2);
		t.uuid('author').references('id').inTable('directus_users');
	});

	await db.schema.createTable('no_pk', (t) => t.string('a'));
	await db.raw('create table "with space" (id integer primary key)');
	await db.schema.createTable('spatial_ref_sys', (t) => t.increments('id'));

	await db('directus_collections').insert({
		collection: 'articles',
		note: 'Articles',
		singleton: false,
		sort_field: 'title',
		accountability: null,
	});

	await db('directus_fields').insert([
		{
			collection: 'articles',
			field: 'title',
			special: null,
			note: 'The title',
			validation: JSON.stringify({ title: { _nnull: true } }),
			searchable: true,
		},
		{ collection: 'articles', field: 'comments', special: 'o2m', note: null, validation: null, searchable: false },
		{ collection: 'articles', field: 'divider', special: 'alias,no-data', note: null },
		{ collection: 'articles', field: 'ghost', special: null },
		{ collection: 'missing', field: 'x', special: null },
	]);

	await db('directus_relations').insert({
		many_collection: 'articles',
		many_field: 'author',
		one_collection: 'directus_users',
		one_allowed_collections: 'a,b',
	});
});

afterEach(() => db.destroy());

describe('getDatabaseSchema (SQLite, real queries)', () => {
	test('collections: user and system tables, metadata, excluded/no-pk/space tables skipped', async () => {
		const schema = await getDatabaseSchema(db, createInspector(db));
		expect(Object.keys(schema.collections)).toContain('articles');
		expect(Object.keys(schema.collections)).toContain('directus_settings');
		expect(schema.collections).not.toHaveProperty('no_pk');
		expect(schema.collections).not.toHaveProperty('with space');
		expect(schema.collections).not.toHaveProperty('spatial_ref_sys');
		expect(logger.warn).toHaveBeenCalledWith(
			`Collection "no_pk" doesn't have a primary key column and will be ignored`,
		);
		expect(logger.warn).toHaveBeenCalledWith(`Collection "with space" has a space in the name and will be ignored`);
		expect(logger.trace).toHaveBeenCalledWith(
			`Collection "spatial_ref_sys" is configured to be excluded and will be ignored`,
		);

		expect(schema.collections['articles']).toMatchObject({
			primary: 'id',
			singleton: false,
			note: 'Articles',
			sortField: 'title',
			accountability: null,
		});
		expect(schema.collections['directus_settings']).toMatchObject({ singleton: true });
	});

	test('fields: columns, directus_fields metadata, alias fields; no-data and unknown fields skipped', async () => {
		const { fields } = (await getDatabaseSchema(db, createInspector(db))).collections['articles']!;

		expect(fields['title']).toMatchObject({
			type: 'string',
			defaultValue: 'untitled',
			nullable: false,
			note: 'The title',
			validation: { title: { _nnull: true } },
			alias: false,
		});
		// knex creates decimal columns as `float` on SQLite.
		expect(fields['price']).toMatchObject({ type: 'float', dbType: 'float' });
		expect(fields['comments']).toMatchObject({ type: 'alias', alias: true, special: ['o2m'], searchable: false });
		expect(fields).not.toHaveProperty('divider');
		expect(fields).not.toHaveProperty('ghost');
	});

	test('relations: directus_relations (cast-csv) stitched with foreign keys, plus system relations', async () => {
		const { relations } = await getDatabaseSchema(db, createInspector(db));
		const author = relations.find((r) => r.collection === 'articles' && r.field === 'author')!;
		expect(author.related_collection).toBe('directus_users');
		expect(author.schema).toMatchObject({ table: 'articles', column: 'author', foreign_key_table: 'directus_users' });
		expect(author.meta).toMatchObject({ one_allowed_collections: ['a', 'b'] });
		expect(relations.some((r) => r.collection === 'directus_users' && r.field === 'role')).toBe(true);
	});

	test('getSchema() builds a fresh schema from the given database', async () => {
		expect(Object.keys((await getSchema({ database: db })).collections)).toContain('articles');
	});
});
