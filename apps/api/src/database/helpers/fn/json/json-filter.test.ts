// Backoffice (spec 023, research R4): typed json path SQL per vendor.
import { SchemaBuilder } from '@backoffice/schema-builder';
import knex from 'knex';
import { MockClient } from 'knex-mock-client';
import { describe, expect, test } from 'vitest';
import { Client_PG, Client_SQLite3 } from '../../../run-ast/lib/apply-query/mock.js';
import { getFunctions } from '../../index.js';
import type { FnHelperOptions } from '../types.js';
import { normalizeTypedJsonValue } from '../types.js';

class Client_MySQL2 extends MockClient {}
class Client_CockroachDB extends MockClient {}
class Client_Redshift extends MockClient {}

const schema = (dbType: string) => {
	const built = new SchemaBuilder()
		.collection('products', (c) => {
			c.field('id').id();
			c.field('meta').json();
		})
		.build();

	built.collections['products']!.fields['meta']!.dbType = dbType;
	return built;
};

const options = (jsonPath: string, jsonType: FnHelperOptions['jsonType']): FnHelperOptions => ({
	type: 'json',
	originalCollectionName: undefined,
	relationalCountOptions: undefined,
	jsonPath,
	jsonType,
});

const sql = (raw: { toSQL(): { sql: string; bindings: readonly unknown[] } }) => {
	const { sql, bindings } = raw.toSQL();
	return { sql, bindings };
};

describe('Postgres', () => {
	const db = knex({ client: Client_PG });

	test('number on a json column', () => {
		expect(sql(getFunctions(db, schema('json')).json('products', 'meta', options('.Amount', 'number'))))
			.toMatchInlineSnapshot(`
			{
			  "bindings": [
			    "Amount",
			    "Amount",
			  ],
			  "sql": "CASE WHEN json_typeof("products"."meta" #> ARRAY[?]::text[]) = 'number' THEN ("products"."meta" #>> ARRAY[?]::text[])::numeric END",
			}
		`);
	});

	test('text and boolean on a jsonb column, array index as a text key', () => {
		const fn = getFunctions(db, schema('jsonb'));
		expect(sql(fn.json('products', 'meta', options('.items[0].sku', 'text')))).toMatchInlineSnapshot(`
			{
			  "bindings": [
			    "items",
			    "0",
			    "sku",
			    "items",
			    "0",
			    "sku",
			  ],
			  "sql": "CASE WHEN jsonb_typeof("products"."meta" #> ARRAY[?, ?, ?]::text[]) = 'string' THEN ("products"."meta" #>> ARRAY[?, ?, ?]::text[]) END",
			}
		`);
		expect(sql(fn.json('products', 'meta', options('.flag', 'boolean')))).toMatchInlineSnapshot(`
			{
			  "bindings": [
			    "flag",
			    "flag",
			  ],
			  "sql": "CASE WHEN jsonb_typeof("products"."meta" #> ARRAY[?]::text[]) = 'boolean' THEN ("products"."meta" #>> ARRAY[?]::text[])::boolean END",
			}
		`);
	});

	test('[*]: elements of the array (no row when not an array) and the element value', () => {
		const fn = getFunctions(db, schema('json'));
		expect(sql(fn.jsonArrayElements('products', 'meta', options('.items', 'text')))).toMatchInlineSnapshot(`
			{
			  "bindings": [
			    "items",
			    "items",
			  ],
			  "sql": "json_array_elements(CASE WHEN json_typeof("products"."meta" #> ARRAY[?]::text[]) = 'array' THEN "products"."meta" #> ARRAY[?]::text[] ELSE '[]'::json END) AS "bo_json_elem"("v")",
			}
		`);
		expect(sql(fn.jsonElement('products', 'meta', options('.sku', 'text')))).toMatchInlineSnapshot(`
			{
			  "bindings": [
			    "sku",
			    "sku",
			  ],
			  "sql": "CASE WHEN json_typeof("bo_json_elem"."v" #> ARRAY[?]::text[]) = 'string' THEN ("bo_json_elem"."v" #>> ARRAY[?]::text[]) END",
			}
		`);
		expect(sql(fn.jsonElement('products', 'meta', options('', 'number')))).toMatchInlineSnapshot(`
			{
			  "bindings": [],
			  "sql": "CASE WHEN json_typeof("bo_json_elem"."v") = 'number' THEN ("bo_json_elem"."v" #>> '{}')::numeric END",
			}
		`);
	});

	test('[*] at the root of a jsonb column', () => {
		const fn = getFunctions(db, schema('jsonb'));
		expect(sql(fn.jsonArrayElements('products', 'meta', options('', 'text')))).toMatchInlineSnapshot(`
			{
			  "bindings": [],
			  "sql": "jsonb_array_elements(CASE WHEN jsonb_typeof("products"."meta") = 'array' THEN "products"."meta" ELSE '[]'::jsonb END) AS "bo_json_elem"("v")",
			}
		`);
	});

	test('json() without a type keeps the DR SQL', () => {
		expect(sql(getFunctions(db, schema('json')).json('products', 'meta', options('.color', undefined)))).toEqual({
			sql: '"products"."meta"::json->?',
			bindings: ['color'],
		});
	});
});

describe('SQLite', () => {
	const db = knex({ client: Client_SQLite3 });

	test('number, text, boolean guarded by json_valid', () => {
		const fn = getFunctions(db, schema('json'));
		expect(sql(fn.json('products', 'meta', options('.Amount', 'number')))).toMatchInlineSnapshot(`
			{
			  "bindings": [
			    "$.Amount",
			    "$.Amount",
			  ],
			  "sql": "CASE WHEN json_type(CASE WHEN json_valid("products"."meta") THEN "products"."meta" END, ?) IN ('integer', 'real') THEN json_extract(CASE WHEN json_valid("products"."meta") THEN "products"."meta" END, ?) END",
			}
		`);
		expect(sql(fn.json('products', 'meta', options('.items[0].sku', 'text')))).toMatchInlineSnapshot(`
			{
			  "bindings": [
			    "$.items[0].sku",
			    "$.items[0].sku",
			  ],
			  "sql": "CASE WHEN json_type(CASE WHEN json_valid("products"."meta") THEN "products"."meta" END, ?) = 'text' THEN json_extract(CASE WHEN json_valid("products"."meta") THEN "products"."meta" END, ?) END",
			}
		`);
		expect(sql(fn.json('products', 'meta', options('.flag', 'boolean')))).toMatchInlineSnapshot(`
			{
			  "bindings": [
			    "$.flag",
			  ],
			  "sql": "CASE json_type(CASE WHEN json_valid("products"."meta") THEN "products"."meta" END, ?) WHEN 'true' THEN 1 WHEN 'false' THEN 0 END",
			}
		`);
	});

	test('[*]: json_each of the array and the element read from the column at its fullkey', () => {
		const fn = getFunctions(db, schema('json'));
		expect(sql(fn.jsonArrayElements('products', 'meta', options('.items', 'text')))).toMatchInlineSnapshot(`
			{
			  "bindings": [
			    "$.items",
			    "$.items",
			  ],
			  "sql": "json_each(CASE WHEN json_type(CASE WHEN json_valid("products"."meta") THEN "products"."meta" END, ?) = 'array' THEN CASE WHEN json_valid("products"."meta") THEN "products"."meta" END END, ?) AS "bo_json_elem"",
			}
		`);
		expect(sql(fn.jsonElement('products', 'meta', options('.sku', 'text')))).toMatchInlineSnapshot(`
			{
			  "bindings": [
			    ".sku",
			    ".sku",
			  ],
			  "sql": "CASE WHEN json_type(CASE WHEN json_valid("products"."meta") THEN "products"."meta" END, "bo_json_elem"."fullkey" || ?) = 'text' THEN json_extract(CASE WHEN json_valid("products"."meta") THEN "products"."meta" END, "bo_json_elem"."fullkey" || ?) END",
			}
		`);
		expect(sql(fn.jsonArrayElements('products', 'meta', options('', 'text'))).bindings).toContain('$');
	});
});

describe('other vendors (FR-008)', () => {
	test.each([
		['mysql', Client_MySQL2],
		['cockroachdb', Client_CockroachDB],
		['redshift', Client_Redshift],
	])('%s refuses a typed json path', (name, client) => {
		const fn = getFunctions(knex({ client }), schema('json'));
		const message = `Filtering by a JSON path is not supported on ${name}`;

		expect(() => fn.json('products', 'meta', options('.a', 'number'))).toThrow(message);
		expect(() => fn.jsonArrayElements('products', 'meta', options('.a', 'text'))).toThrow(message);
		expect(() => fn.jsonElement('products', 'meta', options('.a', 'text'))).toThrow(message);
	});

	test('json() without a type still works on mysql', () => {
		const fn = getFunctions(knex({ client: Client_MySQL2 }), schema('json'));
		expect(() => fn.json('products', 'meta', options('.a', undefined))).not.toThrow();
	});
});

describe('normalizeTypedJsonValue (D-184.2)', () => {
	test.each([
		[null, 'number', null],
		['6000.5', 'number', 6000.5],
		[6000, 'number', 6000],
		[1, 'boolean', true],
		[0, 'boolean', false],
		[true, 'boolean', true],
		['x', 'text', 'x'],
	] as const)('%j as %s → %j', (value, type, expected) => {
		expect(normalizeTypedJsonValue(value, type)).toBe(expected);
	});

	test('parseJsonResult normalizes on Postgres and SQLite when the type is known', () => {
		expect(getFunctions(knex({ client: Client_PG }), schema('json')).parseJsonResult('12', 'number')).toBe(12);
		expect(getFunctions(knex({ client: Client_SQLite3 }), schema('json')).parseJsonResult(1, 'boolean')).toBe(true);
		expect(getFunctions(knex({ client: Client_SQLite3 }), schema('json')).parseJsonResult('{"a":1}')).toEqual({ a: 1 });
	});
});
