// Backoffice (spec 028, D-203): the `$FIELD(b)` dynamic value, its type groups and the schema checks (research R1, R2).
import { InvalidQueryError } from '@backoffice/errors';
import { SchemaBuilder } from '@backoffice/schema-builder';
import { describe, expect, test } from 'vitest';
import {
	assertFieldCompare,
	fieldCompareGroup,
	hasFieldCompare,
	isFieldCompareName,
	isFieldCompareOperator,
	parseFieldCompare,
} from './field-compare.js';

const schema = new SchemaBuilder()
	.collection('orders', (c) => {
		c.field('id').id();
		c.field('total').integer();
		c.field('paid_amount').integer();
		c.field('price').decimal();
		c.field('title').string();
		c.field('slug').text();
		c.field('published_at').timestamp();
		c.field('updated_at').timestamp();
		c.field('created_on').dateTime();
		c.field('day').date();
		c.field('active').boolean();
		c.field('featured').boolean();
		c.field('owner').uuid();
		c.field('meta').json();
		c.field('secret').hash();
		c.field('lines').o2m('order_lines', 'order_id');
	})
	.build();

describe('parseFieldCompare', () => {
	test.each([
		['$FIELD(b)', 'b'],
		['$FIELD( b )', 'b'],
		['$FIELD(a.b)', 'a.b'],
		['$FIELD()', ''],
		['$FIELD(b);--)', 'b);--'],
	])('%s is the dynamic value %s', (value, field) => {
		expect(parseFieldCompare(value)).toBe(field);
	});

	test.each(['$FIELD', '$FIELD(b', '$field(b)', 'b', '$NOW', 1, null, undefined, { field: 'b' }, ['$FIELD(b)']])(
		'%s is a plain value',
		(value) => {
			expect(parseFieldCompare(value)).toBeNull();
		},
	);
});

test('isFieldCompareName: a plain field key only', () => {
	expect(['b', 'paid_amount', 'Field-1', '1'].every(isFieldCompareName)).toBe(true);
	expect(['', 'a.b', 'a b', 'a,b', 'a(b)', 'b);--', ' b'].some(isFieldCompareName)).toBe(false);
});

test('isFieldCompareOperator: the six comparison operators only', () => {
	expect(['_eq', '_neq', '_gt', '_gte', '_lt', '_lte'].every(isFieldCompareOperator)).toBe(true);
	expect(['_in', '_contains', '_null', '_between', '_starts_with', 'eq'].some(isFieldCompareOperator)).toBe(false);
});

describe('fieldCompareGroup', () => {
	test.each([
		['integer', 'number'],
		['bigInteger', 'number'],
		['float', 'number'],
		['decimal', 'number'],
		['string', 'string'],
		['text', 'string'],
		['boolean', 'boolean'],
		['uuid', 'uuid'],
		['date', 'date'],
		['dateTime', 'dateTime'],
		['timestamp', 'timestamp'],
	] as const)('%s → %s', (type, group) => {
		expect(fieldCompareGroup(type)).toBe(group);
	});

	test.each(['time', 'hash', 'json', 'csv', 'geometry', 'geometry.Point', 'binary', 'alias', 'unknown'] as const)(
		'%s has no group',
		(type) => {
			expect(fieldCompareGroup(type)).toBeNull();
		},
	);

	test('undefined has no group', () => {
		expect(fieldCompareGroup(undefined)).toBeNull();
	});
});

describe('assertFieldCompare', () => {
	test.each([
		['total', 'paid_amount'],
		['total', 'price'],
		['price', 'total'],
		['title', 'slug'],
		['published_at', 'updated_at'],
		['active', 'featured'],
		['owner', 'owner'],
		['total', 'total'],
	])('%s with %s passes', (a, b) => {
		expect(() => assertFieldCompare(schema, 'orders', a, b)).not.toThrow();
	});

	test.each([
		['total', 'title', 'must be a number field like "total" (got string)'],
		['title', 'total', 'must be a string field like "title" (got integer)'],
		['published_at', 'created_on', 'must be a timestamp field like "published_at" (got dateTime)'],
		['day', 'published_at', 'must be a date field like "day" (got timestamp)'],
		['active', 'total', 'must be a boolean field like "active" (got integer)'],
		['meta', 'title', '"meta" (json) cannot be compared with another field'],
		['total', 'meta', 'must be a number field like "total" (got json)'],
		['total', 'secret', 'must be a number field like "total" (got hash)'],
		['total', 'nope', 'unknown field "nope" in collection "orders"'],
		['total', 'lines', 'must be a column field'],
		['total', '', 'a field of the same collection is expected (no relation, no spaces)'],
		['total', 'author.age', 'a field of the same collection is expected'],
		['total', 'a b', 'a field of the same collection is expected'],
		['total', 'b);--', 'a field of the same collection is expected'],
		['total', 'b,c', 'a field of the same collection is expected'],
	])('%s with %s is refused: %s', (a, b, message) => {
		expect(() => assertFieldCompare(schema, 'orders', a, b)).toThrow(InvalidQueryError);
		expect(() => assertFieldCompare(schema, 'orders', a, b)).toThrow(message);
	});

	test('an unknown collection is refused like an unknown field', () => {
		expect(() => assertFieldCompare(schema, 'nope', 'total', 'paid_amount')).toThrow('unknown field "paid_amount"');
	});
});

describe('hasFieldCompare', () => {
	test.each([
		[{ total: { _gt: '$FIELD(paid_amount)' } }],
		[{ _and: [{ title: { _nnull: true } }, { total: { _eq: '$FIELD(price)' } }] }],
		[{ _or: [{ order: { total: { _lte: '$FIELD(paid_amount)' } } }] }],
		[{ lines: { _some: { qty: { _neq: '$FIELD(shipped)' } } } }],
		[{ lines: { _none: { qty: { _gte: '$FIELD(shipped)' } } } }],
	])('%j compares two fields', (filter) => {
		expect(hasFieldCompare(filter)).toBe(true);
	});

	test.each([
		[{ total: { _gt: 1 } }],
		[{ total: { _in: ['$FIELD(paid_amount)'] } }],
		[{ title: { _contains: '$FIELD(slug)' } }],
		[{ title: { _eq: '$field(slug)' } }],
		[{ total: { _null: '$FIELD(x)' } }],
		[{ id: { _eq: '$CURRENT_USER' } }],
		[null],
		[undefined],
		['$FIELD(b)'],
	])('%j does not', (filter) => {
		expect(hasFieldCompare(filter)).toBe(false);
	});
});
