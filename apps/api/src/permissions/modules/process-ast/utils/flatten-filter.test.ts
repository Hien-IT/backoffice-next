// Ported from directus/api/src/permissions/modules/process-ast/utils/flatten-filter.test.ts
import type { Filter, Query } from '@backoffice/types';
import { expect, test } from 'vitest';
import type { FieldKey } from '../types.js';
import { flattenFilter } from './flatten-filter.js';

test('Returns early when no filter is passed', () => {
	const paths: FieldKey[][] = [];

	flattenFilter(paths, undefined);

	expect(paths).toEqual([]);
});

test('Flattens single level', () => {
	const paths: FieldKey[][] = [];

	const filter: Query['filter'] = {
		author: {
			_eq: 1,
		},
	};

	flattenFilter(paths, filter);

	expect(paths).toEqual([['author']]);
});

test('Flattens _eq shortcut', () => {
	const paths: FieldKey[][] = [];

	const filter: Query['filter'] = {
		author: 'Rijk',
	} as Filter;

	flattenFilter(paths, filter);

	expect(paths).toEqual([['author']]);
});

test.todo('Flattens single level and handles underscore in field names', () => {
	const paths: FieldKey[][] = [];

	const filter: Query['filter'] = {
		_author: {
			_eq: 1,
		},
	};

	flattenFilter(paths, filter);

	expect(paths).toEqual([['_author']]);
});

test('Flattens nested fields', () => {
	const paths: FieldKey[][] = [];

	const filter: Query['filter'] = {
		author: {
			name: {
				_eq: 'Rijk',
			},
		},
	};

	flattenFilter(paths, filter);

	expect(paths).toEqual([['author', 'name']]);
});

test('Flattens logical groups', () => {
	const paths: FieldKey[][] = [];

	const filter: Query['filter'] = {
		_and: [
			{
				author: {
					name: {
						_eq: 'Rijk',
					},
				},
			},
			{
				author: {
					age: {
						_eq: 28,
					},
				},
			},
		],
	};

	flattenFilter(paths, filter);

	expect(paths).toEqual([
		['author', 'age'],
		['author', 'name'],
	]);
});

test('Flattens nested logical groups', () => {
	const paths: FieldKey[][] = [];

	const filter: Query['filter'] = {
		_and: [
			{
				_or: [
					{
						author: {
							name: {
								_eq: 'Rijk',
							},
						},
					},
					{
						_and: [
							{
								timestamp: {
									_gte: '2024-04-12',
								},
							},
							{
								author: {
									age: {
										_gt: 21,
									},
								},
							},
						],
					},
				],
			},
		],
	};

	flattenFilter(paths, filter);

	expect(paths).toEqual([['author', 'age'], ['timestamp'], ['author', 'name']]);
});

test('Leaves function usage', () => {
	const paths: FieldKey[][] = [];

	const filter: Query['filter'] = {
		'year(timestamp)': {
			_eq: 2024,
		},
	};

	flattenFilter(paths, filter);

	expect(paths).toEqual([['year(timestamp)']]);
});

test.each(['_and', '_or'])('Checks inside of logical operator (%s)', (operator) => {
	const paths: FieldKey[][] = [];

	const filter = {
		[operator]: [
			{
				author: { _eq: 'Rijk' },
				published: { year: { _eq: 2024 } },
			},
		],
	} as Query['filter'];

	flattenFilter(paths, filter);

	expect(paths).toEqual([['published', 'year'], ['author']]);
});

test.each(['_some', '_none'])('Checks inside of relational operator (%s)', (operator) => {
	const paths: FieldKey[][] = [];

	const filter = {
		[operator]: {
			author: { _eq: 'Rijk' },
			published: { year: { _eq: 2024 } },
		},
	} as Query['filter'];

	flattenFilter(paths, filter);

	expect(paths).toEqual([['published', 'year'], ['author']]);
});

test('Does not look into operators that might contain objects', () => {
	const paths: FieldKey[][] = [];

	const filter = {
		_intersects: {
			type: 'Point',
		},
	} as Query['filter'];

	flattenFilter(paths, filter);

	expect(paths).toEqual([]);
});

// Backoffice (spec 028, D-203): `$FIELD(b)` reads field b of the same collection, so b joins the paths like a key.
test('Adds the field of a $FIELD(b) value next to the key', () => {
	const paths: FieldKey[][] = [];

	flattenFilter(paths, { total: { _gt: '$FIELD(paid_amount)' } } as Filter);

	expect(paths).toEqual([['total'], ['paid_amount']]);
});

test('Adds the field of a $FIELD(b) value in the collection of a nested key', () => {
	const paths: FieldKey[][] = [];

	flattenFilter(paths, {
		_and: [
			{ order: { total: { _lte: '$FIELD(paid_amount)' } } },
			{ lines: { _some: { qty: { _neq: '$FIELD(shipped)' } } } },
		],
	} as Filter);

	expect(paths).toEqual([
		['lines', 'qty'],
		['lines', 'shipped'],
		['order', 'total'],
		['order', 'paid_amount'],
	]);
});

test('Leaves a malformed $FIELD name (relation, empty, spaces) to applyOperator', () => {
	const paths: FieldKey[][] = [];

	flattenFilter(paths, {
		total: { _gt: '$FIELD(customer.credit)' },
		price: { _eq: '$FIELD()' },
		slug: { _neq: '$FIELD(a b)' },
	} as Filter);

	expect(paths).toEqual([['slug'], ['price'], ['total']]);
});

test('Keeps $FIELD(...) strings of other operators and plain strings out of the paths', () => {
	const paths: FieldKey[][] = [];

	flattenFilter(paths, {
		title: { _contains: '$FIELD(slug)' },
		tags: { _in: ['$FIELD(slug)'] },
		owner: { _eq: '$CURRENT_USER' },
		slug: { _eq: '$field(title)' },
	} as Filter);

	expect(paths).toEqual([['slug'], ['owner'], ['tags'], ['title']]);
});
