// Ported from directus/api/src/database/run-ast/lib/apply-query/filter/get-filter-type.test.ts
import { SchemaBuilder } from '@backoffice/schema-builder';
import { describe, expect, test } from 'vitest';
import { getFilterType } from './get-filter-type.js';

test(`filter type for string field`, async () => {
	const schema = new SchemaBuilder()
		.collection('articles', (c) => {
			c.field('id').id();
			c.field('title').string();
		})
		.build();

	const { type, special } = getFilterType(schema.collections['articles']!.fields, 'title', 'articles');

	expect(type).toEqual('string');
	expect(special).toEqual([]);
});

test(`filter type for integer field`, async () => {
	const schema = new SchemaBuilder()
		.collection('articles', (c) => {
			c.field('id').id();
			c.field('likes').integer();
		})
		.build();

	const { type, special } = getFilterType(schema.collections['articles']!.fields, 'likes', 'articles');

	expect(type).toEqual('integer');
	expect(special).toEqual([]);
});

test(`filter type for year(created) field`, async () => {
	const schema = new SchemaBuilder()
		.collection('articles', (c) => {
			c.field('id').id();
			c.field('created').dateTime();
		})
		.build();

	const { type, special } = getFilterType(schema.collections['articles']!.fields, 'year(created)', 'articles');

	expect(type).toEqual('integer');
	expect(special).toEqual(undefined);
});

test(`filter type unapplicable function count(created)`, async () => {
	const schema = new SchemaBuilder()
		.collection('articles', (c) => {
			c.field('id').id();
			c.field('created').dateTime();
		})
		.build();

	expect(() => {
		getFilterType(schema.collections['articles']!.fields, 'count(created)', 'articles');
	}).toThrowError('Invalid query. Invalid filter key "count(created)" on "articles".');
});

// Backoffice (spec 023, R1): json(field, path, type) filters by the type of the value at the path.
describe('json path keys', () => {
	const schema = new SchemaBuilder()
		.collection('articles', (c) => {
			c.field('id').id();
			c.field('meta').json();
			c.field('title').string();
		})
		.build();

	const fields = schema.collections['articles']!.fields;

	test.each([
		{ key: 'json(meta, a)', type: 'string' },
		{ key: 'json(meta, a, text)', type: 'string' },
		{ key: 'json(meta, a.b, number)', type: 'float' },
		{ key: 'json(meta, items[*].ok, boolean)', type: 'boolean' },
	])('$key → $type', ({ key, type }) => {
		expect(getFilterType(fields, key, 'articles')).toEqual({ type });
	});

	test('unknown type → 400', () => {
		expect(() => getFilterType(fields, 'json(meta, a, money)', 'articles')).toThrow('unknown type "money"');
	});

	test('json() on a field that is not json → Invalid filter key, as for other functions', () => {
		expect(() => getFilterType(fields, 'json(title, a, text)', 'articles')).toThrow(
			'Invalid filter key "json(title, a, text)" on "articles"',
		);
	});

	test('the json field itself keeps type json (only _null/_nnull)', () => {
		expect(getFilterType(fields, 'meta', 'articles')).toEqual({ type: 'json', special: [] });
	});
});
