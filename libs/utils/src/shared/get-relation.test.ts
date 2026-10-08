// Ported from directus/packages/utils/shared/get-relation.test.ts
import type { Relation } from '@backoffice/types';
import { expect, test } from 'vitest';
import { getRelation, getRelations, getRelationsForCollection } from './get-relation.js';

// Fixtures equal to what @directus/schema-builder builds for these collections (not ported: test-only, 2k lines).
const relation = (
	collection: string,
	field: string,
	related: string,
	oneField: string,
	column: string,
	table: string,
): Relation =>
	({
		collection,
		field,
		related_collection: related,
		meta: {
			id: 0,
			junction_field: null,
			many_collection: collection,
			many_field: field,
			one_allowed_collections: null,
			one_collection: related,
			one_collection_field: null,
			one_deselect_action: 'nullify',
			one_field: oneField,
			sort_field: null,
		},
		schema: {
			column,
			constraint_name: `${table}_${column}_foreign`,
			foreign_key_schema: 'public',
			foreign_key_table: table === collection ? related : collection,
			on_delete: 'SET NULL',
			on_update: 'NO ACTION',
			table,
		},
	}) as Relation;

const m2oSchema = { relations: [relation('article', 'author', 'users', 'articles', 'author', 'article')] };
const o2mSchema = { relations: [relation('tags', 'article_id', 'article', 'tags', 'tags', 'article')] };

test('relations on m2o field', () => {
	const schema = m2oSchema;

	const result = getRelations(schema.relations, 'article', 'author');

	expect(result).toMatchInlineSnapshot(`
		[
		  {
		    "collection": "article",
		    "field": "author",
		    "meta": {
		      "id": 0,
		      "junction_field": null,
		      "many_collection": "article",
		      "many_field": "author",
		      "one_allowed_collections": null,
		      "one_collection": "users",
		      "one_collection_field": null,
		      "one_deselect_action": "nullify",
		      "one_field": "articles",
		      "sort_field": null,
		    },
		    "related_collection": "users",
		    "schema": {
		      "column": "author",
		      "constraint_name": "article_author_foreign",
		      "foreign_key_schema": "public",
		      "foreign_key_table": "users",
		      "on_delete": "SET NULL",
		      "on_update": "NO ACTION",
		      "table": "article",
		    },
		  },
		]
	`);

	expect(result).toEqual(getRelations(schema.relations, 'users', 'articles'));
});

test('relations on o2m field', () => {
	const schema = o2mSchema;

	const result = getRelations(schema.relations, 'article', 'tags');

	expect(result).toMatchInlineSnapshot(`
		[
		  {
		    "collection": "tags",
		    "field": "article_id",
		    "meta": {
		      "id": 0,
		      "junction_field": null,
		      "many_collection": "tags",
		      "many_field": "article_id",
		      "one_allowed_collections": null,
		      "one_collection": "article",
		      "one_collection_field": null,
		      "one_deselect_action": "nullify",
		      "one_field": "tags",
		      "sort_field": null,
		    },
		    "related_collection": "article",
		    "schema": {
		      "column": "tags",
		      "constraint_name": "article_tags_foreign",
		      "foreign_key_schema": "public",
		      "foreign_key_table": "tags",
		      "on_delete": "SET NULL",
		      "on_update": "NO ACTION",
		      "table": "article",
		    },
		  },
		]
	`);

	expect(result).toEqual(getRelations(schema.relations, 'tags', 'article_id'));
});

test('relation on m2o field', () => {
	const schema = m2oSchema;

	const result = getRelation(schema.relations, 'article', 'author');

	expect(result).toMatchInlineSnapshot(`
		{
		  "collection": "article",
		  "field": "author",
		  "meta": {
		    "id": 0,
		    "junction_field": null,
		    "many_collection": "article",
		    "many_field": "author",
		    "one_allowed_collections": null,
		    "one_collection": "users",
		    "one_collection_field": null,
		    "one_deselect_action": "nullify",
		    "one_field": "articles",
		    "sort_field": null,
		  },
		  "related_collection": "users",
		  "schema": {
		    "column": "author",
		    "constraint_name": "article_author_foreign",
		    "foreign_key_schema": "public",
		    "foreign_key_table": "users",
		    "on_delete": "SET NULL",
		    "on_update": "NO ACTION",
		    "table": "article",
		  },
		}
	`);

	expect(result).toEqual(getRelation(schema.relations, 'users', 'articles'));
});

test('relation on o2m field', () => {
	const schema = o2mSchema;

	const result = getRelation(schema.relations, 'article', 'tags');

	expect(result).toMatchInlineSnapshot(`
		{
		  "collection": "tags",
		  "field": "article_id",
		  "meta": {
		    "id": 0,
		    "junction_field": null,
		    "many_collection": "tags",
		    "many_field": "article_id",
		    "one_allowed_collections": null,
		    "one_collection": "article",
		    "one_collection_field": null,
		    "one_deselect_action": "nullify",
		    "one_field": "tags",
		    "sort_field": null,
		  },
		  "related_collection": "article",
		  "schema": {
		    "column": "tags",
		    "constraint_name": "article_tags_foreign",
		    "foreign_key_schema": "public",
		    "foreign_key_table": "tags",
		    "on_delete": "SET NULL",
		    "on_update": "NO ACTION",
		    "table": "article",
		  },
		}
	`);

	expect(result).toEqual(getRelation(schema.relations, 'tags', 'article_id'));
});

test('relations on wrong collection', () => {
	const schema = o2mSchema;

	const result = getRelations(schema.relations, 'wrong', 'tags');

	expect(result).toEqual([]);
});

test('relations on wrong field', () => {
	const schema = o2mSchema;

	const result = getRelations(schema.relations, 'article', 'wrong');

	expect(result).toEqual([]);
});

test('relation on wrong collection', () => {
	const schema = o2mSchema;

	const result = getRelation(schema.relations, 'wrong', 'tags');

	expect(result).toBeUndefined();
});

test('relation on wrong field', () => {
	const schema = o2mSchema;

	const result = getRelation(schema.relations, 'article', 'wrong');

	expect(result).toBeUndefined();
});

test('relational fields for a collection (getRelationsForCollection)', () => {
	const field = {} as never;

	const schema = {
		collections: {
			article: { fields: { author: field, tags: field } },
			users: { fields: { articles: field } },
		},
		relations: [...m2oSchema.relations, ...o2mSchema.relations],
	} as never;

	expect(getRelationsForCollection(schema, 'article')).toEqual(['author', 'tags']);
	expect(getRelationsForCollection(schema, 'users')).toEqual(['articles']);
	expect(getRelationsForCollection(schema, 'missing')).toEqual([]);
});
