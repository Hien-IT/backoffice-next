// Ported from directus/app/src/utils/extract-field-from-function.test.ts
// Backoffice: Directus has no test for system-filter/utils.ts; the cases below follow the code of that file.
import { describe, expect, test } from 'vitest';
import {
	extractFieldFromFunction,
	fieldHasFunction,
	fieldToFilter,
	getComparator,
	getField,
	getNodeName,
} from './utils.ts';

describe('getNodeName', () => {
	test('first key of the node, empty for no node', () => {
		expect(getNodeName({ _and: [] })).toBe('_and');
		expect(getNodeName({ title: { _eq: 'a' } })).toBe('title');
		expect(getNodeName(null as never)).toBe('');
	});
});

describe('getField', () => {
	test('dotted path down to the operator', () => {
		expect(getField({ title: { _contains: 'a' } })).toBe('title');
		expect(getField({ author: { first_name: { _contains: 'a' } } })).toBe('author.first_name');
		expect(getField({ 'year(date_published)': { _eq: '2024' } })).toBe('year(date_published)');
	});

	test('empty for a logical node or a non-object value', () => {
		expect(getField({ _or: [] })).toBe('');
		expect(getField({ title: 'a' })).toBe('');
	});
});

describe('getComparator', () => {
	test('operator of the leaf', () => {
		expect(getComparator({ title: { _contains: 'a' } })).toBe('_contains');
		expect(getComparator({ author: { first_name: { _null: true } } })).toBe('_null');
	});
});

describe('fieldHasFunction', () => {
	test('true when the key has parentheses', () => {
		expect(fieldHasFunction('year(date_published)')).toBe(true);
		expect(fieldHasFunction('author.first_name')).toBe(false);
	});
});

describe('fieldToFilter', () => {
	test('nests the path and puts the operator with its value at the end', () => {
		expect(fieldToFilter('title', '_eq', 'a')).toEqual({ title: { _eq: 'a' } });
		expect(fieldToFilter('author.role.name', '_in', ['a'])).toEqual({ author: { role: { name: { _in: ['a'] } } } });
		expect(fieldToFilter('sort', '_between', null)).toEqual({ sort: { _between: null } });
	});
});

describe('extractFieldFromFunction', () => {
	test('Returns original field if no function is given', () => {
		expect(extractFieldFromFunction('title')).toEqual({ fn: null, field: 'title' });
	});

	test('Returns function extracted', () => {
		expect(extractFieldFromFunction('year(date_created)')).toEqual({ fn: 'year', field: 'date_created' });
	});
});
