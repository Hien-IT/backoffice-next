import { SchemaBuilder } from '@backoffice/schema-builder';
import { expect, test } from 'vitest';
import { reduceSchema } from './reduce-schema.js';

const schema = new SchemaBuilder()
	.collection('articles', (c) => {
		c.field('id').id();
		c.field('title').string();
		c.field('secret').string();
		c.field('author').m2o('authors', 'articles');
	})
	.collection('authors', (c) => {
		c.field('id').id();
		c.field('name').string();
	})
	.collection('hidden', (c) => c.field('id').id())
	.build();

test('keeps only allowed collections and fields', () => {
	const reduced = reduceSchema(schema, { articles: ['id', 'title', 'author'], authors: ['*'] });
	expect(Object.keys(reduced.collections)).toEqual(['articles', 'authors']);
	expect(Object.keys(reduced.collections['articles']!.fields)).toEqual(['id', 'title', 'author']);
	expect(Object.keys(reduced.collections['authors']!.fields)).toEqual(['id', 'name']);
	expect(reduced.relations).toHaveLength(1);
});

test('drops relations whose collections or fields are not allowed', () => {
	expect(reduceSchema(schema, { articles: ['id', 'title'] }).relations).toEqual([]);
	expect(reduceSchema(schema, { articles: ['*'], authors: [] }).relations).toEqual([]);
	expect(reduceSchema(schema, { articles: ['*'], authors: ['id'] }).relations).toEqual([]);
});
