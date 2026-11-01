// Ported from directus/api/src/database/run-ast/lib/apply-query/filter/operator.test.ts
import { InvalidQueryError } from '@backoffice/errors';
import { SchemaBuilder } from '@backoffice/schema-builder';
import knex from 'knex';
import { describe, expect, test, vi } from 'vitest';
import { Client_PG, Client_SQLite3 } from '../mock.js';

const { applyOperator } = await import('./operator.js');

const schema = new SchemaBuilder()
	.collection('articles', (c) => {
		c.field('id').id();
		c.field('title').string();
		c.field('likes').integer();
		c.field('links').o2m('links', 'article_id');
	})
	.build();

for (const { field, operator, value, sql, bindings } of [
	{
		field: 'articles.title',
		operator: '_eq',
		value: 1,
		sql: `select * where "articles"."title" = ?`,
		bindings: [1],
	},
	{
		field: 'articles.title',
		operator: '_eq',
		value: null,
		sql: `select * where "articles"."title" is null`,
		bindings: [],
	},
	{
		field: 'articles.title',
		operator: '_null',
		value: true,
		sql: `select * where "articles"."title" is null`,
		bindings: [],
	},
	{
		field: 'articles.title',
		operator: '_nnull',
		value: false,
		sql: `select * where "articles"."title" is null`,
		bindings: [],
	},
	{
		field: 'articles.title',
		operator: '_empty',
		value: true,
		sql: `select * where ("articles"."title" is null or "articles"."title" = ?)`,
		bindings: [''],
	},
	{
		field: 'articles.count(links)',
		operator: '_eq',
		value: '123',
		sql: `select * where (select count(*) from "links" as "arvsw" where "arvsw"."article_id" = "articles"."id") = ?`,
		bindings: [123],
	},
	{
		field: 'articles.count(links)',
		operator: '_eq',
		value: ['123', '456'],
		sql: `select * where (select count(*) from "links" as "arvsw" where "arvsw"."article_id" = "articles"."id") = ?`,
		bindings: [[123, 456]],
	},
	{
		field: 'articles.title',
		operator: '_in',
		value: '123,abc,wow111',
		sql: `select * where "articles"."title" in (?, ?, ?)`,
		bindings: ['123', 'abc', 'wow111'],
	},
	{
		field: 'articles.likes',
		operator: '_eq',
		value: '123',
		sql: `select * where "articles"."likes" = ?`,
		bindings: [123],
	},
	{
		field: 'articles.likes',
		operator: '_eq',
		value: ['123', '546'],
		sql: `select * where "articles"."likes" = ?`,
		bindings: [[123, 546]],
	},
	{
		field: 'articles.likes',
		operator: '_eq',
		value: [undefined],
		sql: `select * where "articles"."likes" = ?`,
		bindings: [[]],
	},
]) {
	test(`applyOperator on ${field} ${operator} ${value}`, async () => {
		const db = vi.mocked(knex.default({ client: Client_SQLite3 }));
		const queryBuilder = db.queryBuilder();

		applyOperator(db, queryBuilder, schema, field, operator, value);

		const rawQuery = queryBuilder.toSQL();

		expect(rawQuery.sql).toEqual(sql);
		expect(rawQuery.bindings).toEqual(bindings);
	});
}

test('applyOperator throws InvalidQueryError for non-numeric value on function-based numeric field', async () => {
	const db = vi.mocked(knex.default({ client: Client_SQLite3 }));
	const queryBuilder = db.queryBuilder();

	expect(() => applyOperator(db, queryBuilder, schema, 'articles.count(links)', '_eq', 'not-a-number')).toThrow(
		InvalidQueryError,
	);
});

test('applyOperator throws InvalidQueryError for non-numeric array value on function-based numeric field', async () => {
	const db = vi.mocked(knex.default({ client: Client_SQLite3 }));
	const queryBuilder = db.queryBuilder();

	expect(() => applyOperator(db, queryBuilder, schema, 'articles.count(links)', '_eq', ['abc', '123'])).toThrow(
		InvalidQueryError,
	);
});

test('applyOperator throws InvalidQueryError for non-numeric value on integer field', async () => {
	const db = vi.mocked(knex.default({ client: Client_SQLite3 }));
	const queryBuilder = db.queryBuilder();

	expect(() => applyOperator(db, queryBuilder, schema, 'articles.likes', '_eq', 'not-a-number')).toThrow(
		InvalidQueryError,
	);
});

test('applyOperator throws InvalidQueryError for non-numeric array value on integer field', async () => {
	const db = vi.mocked(knex.default({ client: Client_SQLite3 }));
	const queryBuilder = db.queryBuilder();

	expect(() => applyOperator(db, queryBuilder, schema, 'articles.likes', '_eq', ['abc', '123'])).toThrow(
		InvalidQueryError,
	);
});

// Backoffice (spec 023, research R3, R4): operators on the typed value at a json path, `[*]`, first-dot split.
describe('json path keys (spec 023)', async () => {
	const jsonSchema = (dbType: string) => {
		const built = new SchemaBuilder()
			.collection('products', (c) => {
				c.field('id').id();
				c.field('meta').json();
				c.field('title').string();
			})
			.build();

		built.collections['products']!.fields['meta']!.dbType = dbType;
		return built;
	};

	const run = (client: any, dbType: string, key: string, operator: string, value: unknown) => {
		const db = knex.default({ client });
		const query = db.queryBuilder();
		applyOperator(db, query, jsonSchema(dbType), key, operator, value, 'and', 'products');
		const { sql, bindings } = query.toSQL();
		return { sql, bindings };
	};

	const PG_NUMBER = `CASE WHEN json_typeof("products"."meta" #> ARRAY[?, ?]::text[]) = 'number' THEN ("products"."meta" #>> ARRAY[?, ?]::text[])::numeric END`;
	const PG_TEXT = `CASE WHEN json_typeof("products"."meta" #> ARRAY[?]::text[]) = 'string' THEN ("products"."meta" #>> ARRAY[?]::text[]) END`;

	test('the path after the first dot is kept and the value is cast to a number', () => {
		expect(run(Client_PG, 'json', 'products.json(meta, a.b, number)', '_eq', '6000')).toEqual({
			sql: `select * where ${PG_NUMBER} = ?`,
			bindings: ['a', 'b', 'a', 'b', 6000],
		});
	});

	test.each([
		['_neq', 'x', `select * where not ${PG_TEXT} = ?`, ['x']],
		['_in', 'x,y', `select * where ${PG_TEXT} in (?, ?)`, ['x', 'y']],
		['_nin', ['x'], `select * where ${PG_TEXT} not in (?)`, ['x']],
		['_contains', 'x', `select * where ${PG_TEXT} like ?`, ['%x%']],
		['_icontains', 'X', `select * where LOWER(${PG_TEXT}) LIKE ?`, ['%x%']],
		['_starts_with', 'x', `select * where ${PG_TEXT} like ?`, ['x%']],
		['_nends_with', 'x', `select * where not ${PG_TEXT} like ?`, ['%x']],
		['_null', true, `select * where ${PG_TEXT} is null`, []],
		['_nnull', true, `select * where ${PG_TEXT} is not null`, []],
		['_empty', true, `select * where (${PG_TEXT} is null or ${PG_TEXT} = ?)`, ['']],
		['_nempty', true, `select * where (${PG_TEXT} is not null and ${PG_TEXT} != ?)`, ['']],
	])('text %s', (operator, value, sql, bindings) => {
		const result = run(Client_PG, 'json', 'products.json(meta, a)', operator, value);
		expect(result.sql).toBe(sql);
		expect(result.bindings.filter((b) => b !== 'a')).toEqual(bindings);
	});

	test.each([
		['_gt', '5', '>'],
		['_lte', 5, '<='],
	])('number %s', (operator, value, sign) => {
		const result = run(Client_PG, 'jsonb', 'products.json(meta, n, number)', operator, value);
		expect(result.sql).toContain(`jsonb_typeof("products"."meta" #> ARRAY[?]::text[]) = 'number'`);
		expect(result.sql).toContain(`::numeric END ${sign} ?`);
		expect(result.bindings.at(-1)).toBe(5);
	});

	test('_in keeps the path bindings before the values (knex orders them the other way for a raw column)', () => {
		expect(run(Client_PG, 'json', 'products.json(meta, n, number)', '_in', [6000, 7000]).bindings).toEqual([
			'n',
			'n',
			6000,
			7000,
		]);
		expect(run(Client_PG, 'json', 'products.json(meta, n, number)', '_nin', ['1', '2']).bindings).toEqual([
			'n',
			'n',
			1,
			2,
		]);
	});

	test('number _between and boolean _eq', () => {
		expect(run(Client_PG, 'json', 'products.json(meta, n, number)', '_between', ['1', '9']).bindings.slice(-2)).toEqual(
			[1, 9],
		);
		expect(run(Client_PG, 'json', 'products.json(meta, f, boolean)', '_eq', true).sql).toContain(`::boolean END = ?`);
	});

	test('[*] → exists over the array elements, any operator inside', () => {
		const result = run(Client_PG, 'json', 'products.json(meta, items[*].sku, text)', '_neq', 'A');

		expect(result.sql).toBe(
			`select * where exists (select 1 from json_array_elements(CASE WHEN json_typeof("products"."meta" #> ARRAY[?]::text[]) = 'array' THEN "products"."meta" #> ARRAY[?]::text[] ELSE '[]'::json END) AS "bo_json_elem"("v") where not CASE WHEN json_typeof("bo_json_elem"."v" #> ARRAY[?]::text[]) = 'string' THEN ("bo_json_elem"."v" #>> ARRAY[?]::text[]) END = ?)`,
		);

		expect(result.bindings).toEqual(['items', 'items', 'sku', 'sku', 'A']);

		expect(run(Client_PG, 'json', 'products.json(meta, items[*].sku, text)', '_null', true).sql).toContain(
			'END is null)',
		);
	});

	test('[*] without a value adds nothing, as other operators do', () => {
		expect(run(Client_PG, 'json', 'products.json(meta, items[*].sku, text)', '_eq', undefined).sql).toBe('select *');
		expect(run(Client_PG, 'json', 'products.json(meta, items[*], number)', '_between', [1]).sql).toBe('select *');
	});

	test('SQLite [*] at the root of the array', () => {
		const result = run(Client_SQLite3, 'json', 'products.json(meta, [*], text)', '_eq', 'x');
		expect(result.sql).toContain('select 1 from json_each(');
		expect(result.sql).toContain(`"bo_json_elem"."fullkey" || ?`);
		expect(result.bindings).toEqual(['$', '$', '', '', 'x']);
	});

	test('a plain column keeps the DR SQL for _starts_with and _ends_with', () => {
		const db = knex.default({ client: Client_SQLite3 });
		const query = db.queryBuilder();
		applyOperator(db, query, jsonSchema('json'), 'products.title', '_ends_with', 'x');
		expect(query.toSQL().sql).toBe(`select * where "products"."title" like ?`);
	});

	test('unknown type and operators of another type are refused', () => {
		expect(() => run(Client_PG, 'json', 'products.json(meta, a, money)', '_eq', 1)).toThrow('unknown type "money"');
		expect(() => run(Client_PG, 'json', 'products.json(meta, n, number)', '_eq', 'abc')).toThrow(
			'Invalid numeric value',
		);
	});
});

// Backoffice (spec 028, D-203): `$FIELD(b)` compares the column with field b of the same collection (research R1).
describe('$FIELD(b) compares two fields of the same collection', () => {
	const orders = new SchemaBuilder()
		.collection('orders', (c) => {
			c.field('id').id();
			c.field('total').integer();
			c.field('paid_amount').integer();
			c.field('price').decimal();
			c.field('title').string();
			c.field('slug').text();
			c.field('published_at').timestamp();
			c.field('created_on').dateTime();
			c.field('active').boolean();
			c.field('lines').o2m('order_lines', 'order_id');
		})
		.build();

	test.each([
		['_eq', '='],
		['_neq', '<>'],
		['_gt', '>'],
		['_gte', '>='],
		['_lt', '<'],
		['_lte', '<='],
	])('%s becomes a column comparison without bindings', (operator, sql) => {
		for (const client of [Client_SQLite3, Client_PG]) {
			const db = vi.mocked(knex.default({ client }));
			const queryBuilder = db.queryBuilder();

			applyOperator(db, queryBuilder, orders, 'orders.total', operator, '$FIELD(paid_amount)');

			expect(queryBuilder.toSQL().sql).toEqual(`select * where "orders"."total" ${sql} "orders"."paid_amount"`);
			expect(queryBuilder.toSQL().bindings).toEqual([]);
		}
	});

	test('a table alias of a related collection is used on both sides', () => {
		const db = vi.mocked(knex.default({ client: Client_SQLite3 }));
		const queryBuilder = db.queryBuilder();

		applyOperator(db, queryBuilder, orders, 'xyzab.total', '_gt', '$FIELD(paid_amount)', 'or', 'orders');

		expect(queryBuilder.toSQL().sql).toEqual(`select * where "xyzab"."total" > "xyzab"."paid_amount"`);
	});

	test.each([
		['integer with decimal', 'orders.total', '$FIELD(price)', `"orders"."total" = "orders"."price"`],
		['string with text', 'orders.title', '$FIELD(slug)', `"orders"."title" = "orders"."slug"`],
		['a field with itself', 'orders.total', '$FIELD(total)', `"orders"."total" = "orders"."total"`],
		[
			'spaces inside the parentheses',
			'orders.total',
			'$FIELD( paid_amount )',
			`"orders"."total" = "orders"."paid_amount"`,
		],
	])('%s', (_name, field, value, sql) => {
		const db = vi.mocked(knex.default({ client: Client_SQLite3 }));
		const queryBuilder = db.queryBuilder();

		applyOperator(db, queryBuilder, orders, field, '_eq', value);

		expect(queryBuilder.toSQL().sql).toEqual(`select * where ${sql}`);
	});

	test.each([
		[
			'_contains keeps the string as a plain value',
			'orders.title',
			'_contains',
			'$FIELD(slug)',
			`"orders"."title" like ?`,
			['%$FIELD(slug)%'],
		],
		[
			'_in keeps the string as a plain value',
			'orders.title',
			'_in',
			'$FIELD(slug)',
			`"orders"."title" in (?)`,
			['$FIELD(slug)'],
		],
		[
			'a lowercase $field is a plain value',
			'orders.title',
			'_eq',
			'$field(slug)',
			`"orders"."title" = ?`,
			['$field(slug)'],
		],
		[
			'an unclosed $FIELD( is a plain value',
			'orders.title',
			'_eq',
			'$FIELD(slug',
			`"orders"."title" = ?`,
			['$FIELD(slug'],
		],
	])('%s', (_name, field, operator, value, sql, bindings) => {
		const db = vi.mocked(knex.default({ client: Client_SQLite3 }));
		const queryBuilder = db.queryBuilder();

		applyOperator(db, queryBuilder, orders, field, operator, value);

		expect(queryBuilder.toSQL().sql).toEqual(`select * where ${sql}`);
		expect(queryBuilder.toSQL().bindings).toEqual(bindings);
	});

	test.each([
		['a function key', 'orders.year(published_at)', '$FIELD(created_on)', 'only allowed on a plain field'],
		['a json path key', 'orders.json(meta, a, number)', '$FIELD(total)', 'only allowed on a plain field'],
		['another type group', 'orders.total', '$FIELD(title)', 'must be a number field like "total" (got string)'],
		['timestamp with dateTime', 'orders.published_at', '$FIELD(created_on)', 'must be a timestamp field'],
		['an unknown field', 'orders.total', '$FIELD(nope)', 'unknown field "nope" in collection "orders"'],
		['an alias field', 'orders.total', '$FIELD(lines)', 'must be a column field'],
		['a relational path', 'orders.total', '$FIELD(author.age)', 'a field of the same collection is expected'],
		['an empty name', 'orders.total', '$FIELD()', 'a field of the same collection is expected'],
	])('%s is refused with 400', (_name, field, value, message) => {
		const db = vi.mocked(knex.default({ client: Client_SQLite3 }));
		const queryBuilder = db.queryBuilder();

		expect(() => applyOperator(db, queryBuilder, orders, field, '_eq', value)).toThrow(InvalidQueryError);
		expect(() => applyOperator(db, queryBuilder, orders, field, '_eq', value)).toThrow(message);
	});
});
