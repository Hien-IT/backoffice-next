// Ported from directus/api/src/database/get-ast-from-query/lib/convert-wildcards.test.ts
import { SchemaBuilder } from '@backoffice/schema-builder';
import type { Accountability } from '@backoffice/types';
import { getRelation } from '@backoffice/utils';
import knex from 'knex';
import { expect, test, vi } from 'vitest';
import { fetchAllowedFields } from '../../../permissions/modules/fetch-allowed-fields/fetch-allowed-fields.js';
import { Client_SQLite3 } from '../../run-ast/lib/apply-query/mock.js';
import { getHiddenFields } from '../../../utils/hidden-fields.js';
import { convertWildcards } from './convert-wildcards.js';

vi.mock('../../../permissions/modules/fetch-allowed-fields/fetch-allowed-fields.js');
// Backoffice (spec 005, D-209): no hidden field unless a test says so.
vi.mock('../../../utils/hidden-fields.js', () => ({ getHiddenFields: vi.fn(async () => ({})) }));

const fetchAllowedFieldsMock = vi.mocked(fetchAllowedFields);

const accountability = {
	admin: false,
} as Accountability;

const db = vi.mocked(knex.default({ client: Client_SQLite3 }));

const schema = new SchemaBuilder()
	.collection('articles', (c) => {
		c.field('id').id();
		c.field('title').string();
		c.field('date').dateTime();
	})
	.build();

test('converting nothing without any permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce([]);

	const result = await convertWildcards(
		{ collection: 'articles', fields: [], alias: {}, accountability, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual([]);
});

test('converting * without any permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce([]);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*'], alias: {}, accountability, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual([]);
});

test('converting * without any permissions and alias is null', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce([]);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*'], alias: null, accountability, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual([]);
});

test('converting * with * permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['*']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*'], alias: {}, accountability, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual(['id', 'title', 'date']);
});

test('converting * with just id permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['id']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*'], alias: {}, accountability, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual(['id']);
});

test('converting title with any permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['title']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['title'], alias: {}, accountability, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual(['title']);
});

test('converting invalid field with any permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['*']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['invalid'], alias: {}, accountability, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual(['invalid']);
});

test('converting invalid field with id, title permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['id', 'title']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['invalid'], alias: {}, accountability, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual(['invalid']);
});

test('converting * with admin permissions', async () => {
	const result = await convertWildcards(
		{
			collection: 'articles',
			fields: ['*'],
			alias: {},
			accountability: { admin: true } as Accountability,
			backlink: true,
		},
		{ knex: db, schema },
	);

	expect(result).toEqual(['id', 'title', 'date']);
});

test('converting title with admin permissions', async () => {
	const result = await convertWildcards(
		{
			collection: 'articles',
			fields: ['title'],
			alias: {},
			accountability: { admin: true } as Accountability,
			backlink: true,
		},
		{ knex: db, schema },
	);

	expect(result).toEqual(['title']);
});

test('converting alias field with * permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['*']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*'], alias: { alias: 'id' }, accountability, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual(['id', 'title', 'date', 'alias']);
});

test('converting invalid alias field with * permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['*']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*'], alias: { alias: 'invalid' }, accountability, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual(['id', 'title', 'date']);
});

const schemaRelational = new SchemaBuilder()
	.collection('articles', (c) => {
		c.field('id').id();
		c.field('title').string();
		c.field('date').dateTime();
		c.field('author').m2o('users');
		c.field('tags').m2m('tags');
	})
	.collection('users', (c) => {
		c.field('id').id();
		c.field('name').string();
	})
	.build();

test('converting *.* with * permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['*']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*.*'], alias: {}, accountability, backlink: true },
		{ knex: db, schema: schemaRelational },
	);

	expect(result).toEqual(['author.*', 'tags.*', 'id', 'title', 'date']);
});

test('converting *.*.* with * permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['*']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*.*.*'], alias: {}, accountability, backlink: true },
		{ knex: db, schema: schemaRelational },
	);

	expect(result).toEqual(['author.*.*', 'tags.*.*', 'id', 'title', 'date']);
});

test('converting *.* and alias with * permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['*']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*.*'], alias: { alias: 'title' }, accountability, backlink: true },
		{ knex: db, schema: schemaRelational },
	);

	expect(result).toEqual(['author.*', 'tags.*', 'id', 'title', 'date', 'alias']);
});

test('converting alias as year(date) with * permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['*']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*.*'], alias: { alias: 'year(date)' }, accountability, backlink: true },
		{ knex: db, schema: schemaRelational },
	);

	expect(result).toEqual(['author.*', 'tags.*', 'id', 'title', 'date', 'alias']);
});

test('converting year(alias) as date with * permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['*']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*.*'], alias: { 'year(alias)': 'date' }, accountability, backlink: true },
		{ knex: db, schema: schemaRelational },
	);

	expect(result).toEqual(['author.*', 'tags.*', 'id', 'title', 'date', 'year(alias)']);
});

test('converting *.* and alias with id, title and author permissions', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['id', 'title', 'author']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*.*'], alias: { alias: 'title' }, accountability, backlink: true },
		{ knex: db, schema: schemaRelational },
	);

	expect(result).toEqual(['author.*', 'id', 'title', 'alias']);
});

test('backlink set to true', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['*']);

	const result = await convertWildcards(
		{ collection: 'articles_tags_junction', fields: ['*.*'], alias: {}, accountability, backlink: true },
		{
			knex: db,
			schema: schemaRelational,
			parentRelation: getRelation(schemaRelational.relations, 'articles', 'tags')!,
		},
	);

	expect(result).toEqual(['articles_id.*', 'tags_id.*', 'id']);
});

test('backlink set to false', async () => {
	fetchAllowedFieldsMock.mockResolvedValueOnce(['*']);

	const result = await convertWildcards(
		{ collection: 'articles_tags_junction', fields: ['*.*'], alias: {}, accountability, backlink: false },
		{
			knex: db,
			schema: schemaRelational,
			parentRelation: getRelation(schemaRelational.relations, 'articles', 'tags')!,
		},
	);

	expect(result).toEqual(['tags_id.*', 'id', 'articles_id']);
});

// Backoffice (spec 005, D-209): hidden fields of the collection and wildcards.
test('D-209: * leaves out the hidden fields but the primary key; a named hidden field stays', async () => {
	vi.mocked(getHiddenFields).mockResolvedValueOnce({ articles: ['id', 'date'] });

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*', 'date'], alias: { when: 'date' }, accountability: null, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual(['id', 'title', 'when', 'date']);
});

test('D-209: * of a user with explicit fields leaves out the hidden ones; an alias of a hidden field stays', async () => {
	vi.mocked(getHiddenFields).mockResolvedValueOnce({ articles: ['date'] });
	fetchAllowedFieldsMock.mockResolvedValueOnce(['title', 'date']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*'], alias: { when: 'date' }, accountability, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual(['title', 'when']);
});

// Owner 2026-11-03 (option C widened): relational fields and the four system fields stay in a wildcard.
test('D-209 C: hidden m2a junction fields and system fields stay in *; other hidden fields go', async () => {
	const m2a = new SchemaBuilder()
		.collection('shapes', (c) => {
			c.field('id').id();
			c.field('children').m2a(['circles']);
			c.field('user_created').uuid().options({ special: ['user-created'] });
			c.field('date_updated').timestamp().options({ special: ['date-updated'] });
			c.field('secret').string();
		})
		.collection('circles', (c) => {
			c.field('id').id();
		})
		.build();
	const junction = m2a.relations.find((r) => r.meta?.one_collection_field)!;
	const junctionName = junction.collection;
	const junctionFields = Object.keys(m2a.collections[junctionName]!.fields).filter((f) => f !== 'id');

	vi.mocked(getHiddenFields).mockResolvedValueOnce({ [junctionName]: junctionFields });
	const inJunction = await convertWildcards(
		{ collection: junctionName, fields: ['*'], alias: {}, accountability: null, backlink: true },
		{ knex: db, schema: m2a },
	);
	expect(inJunction.sort()).toEqual(['id', ...junctionFields].sort());

	vi.mocked(getHiddenFields).mockResolvedValueOnce({ shapes: ['user_created', 'date_updated', 'secret'] });
	const inShapes = await convertWildcards(
		{ collection: 'shapes', fields: ['*'], alias: {}, accountability: null, backlink: true },
		{ knex: db, schema: m2a },
	);
	expect(inShapes).toContain('user_created');
	expect(inShapes).toContain('date_updated');
	expect(inShapes).not.toContain('secret');
});

test('D-209 C: hidden m2o (o2o) keys and o2m aliases stay in * and *.*', async () => {
	const rel = new SchemaBuilder()
		.collection('posts', (c) => {
			c.field('id').id();
			c.field('author').m2o('authors');
			c.field('note').string();
		})
		.collection('authors', (c) => {
			c.field('id').id();
			c.field('posts').o2m('posts', 'author');
			c.field('token').string();
		})
		.build();

	vi.mocked(getHiddenFields).mockResolvedValueOnce({ posts: ['author', 'note'] });
	const posts = await convertWildcards(
		{ collection: 'posts', fields: ['*'], alias: {}, accountability: null, backlink: true },
		{ knex: db, schema: rel },
	);
	expect(posts).toContain('author');
	expect(posts).not.toContain('note');

	vi.mocked(getHiddenFields).mockResolvedValueOnce({ authors: ['posts', 'token'] });
	const authors = await convertWildcards(
		{ collection: 'authors', fields: ['*.*'], alias: {}, accountability: null, backlink: true },
		{ knex: db, schema: rel },
	);
	expect(authors).toContain('posts.*');
	expect(authors).not.toContain('token');
});

test('D-209: a user allowed hidden fields only gets nothing from *, the named field stays', async () => {
	vi.mocked(getHiddenFields).mockResolvedValueOnce({ articles: ['date'] });
	fetchAllowedFieldsMock.mockResolvedValueOnce(['date']);

	const result = await convertWildcards(
		{ collection: 'articles', fields: ['*', 'date'], alias: {}, accountability, backlink: true },
		{ knex: db, schema },
	);

	expect(result).toEqual(['date']);
});
