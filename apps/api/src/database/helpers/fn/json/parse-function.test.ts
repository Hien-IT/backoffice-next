// Ported from directus/api/src/database/helpers/fn/json/parse-function.test.ts
import { describe, expect, test, vi } from 'vitest';
import { calculateJsonPathDepth, jsonFilterType, parseJsonFunction, splitWildcard } from './parse-function.js';

vi.mock('@backoffice/env', () => ({
	useEnv: vi.fn().mockReturnValue({
		MAX_JSON_QUERY_DEPTH: 10,
	}),
}));

const VALID_TEST_CASES = [
	// Basic json(field, path) syntax
	{ input: 'json(field, path)', expected: { field: 'field', path: '.path' } },
	{ input: 'json(data, user.name)', expected: { field: 'data', path: '.user.name' } },
	{
		input: 'json(metadata, settings.theme.color)',
		expected: { field: 'metadata', path: '.settings.theme.color' },
	},
	{ input: 'json(  field , path  )', expected: { field: 'field', path: '.path' } },
	{ input: 'json(user_data, profile)', expected: { field: 'user_data', path: '.profile' } },
	// Array access with index
	{ input: 'json(data, items[0].name)', expected: { field: 'data', path: '.items[0].name' } },
	{ input: 'json(data, [0].name)', expected: { field: 'data', path: '[0].name' } },
	{ input: 'json(data, [0])', expected: { field: 'data', path: '[0]' } },
	// Depth validation - exactly at limit (depth 10 is allowed)
	{
		input: 'json(data, a.b.c.d.e.f.g.h.i.j)',
		expected: { field: 'data', path: '.a.b.c.d.e.f.g.h.i.j' },
	},
	{
		input: 'json(data, items[0].a.b.c.d.e.f.g.h)',
		expected: { field: 'data', path: '.items[0].a.b.c.d.e.f.g.h' },
	},
];

const INVALID_TEST_CASES = [
	{ input: 'field, path)', expectedError: 'Invalid json() syntax' },
	{ input: 'json(field, path', expectedError: 'Invalid json() syntax' },
	{ input: 'json()', expectedError: 'Invalid json() syntax' },
	{ input: 'json(   )', expectedError: 'Invalid json() syntax' },
	{ input: ' json()', expectedError: 'Invalid json() syntax' },
	{ input: 'json() ', expectedError: 'Invalid json() syntax' },
	{ input: 'json(,,) ', expectedError: 'Invalid json() syntax' },
	// Missing comma delimiter
	{ input: 'json(fieldonly)', expectedError: 'Invalid json() syntax: requires json(field, path) format' },
	{ input: 'json(field.path.no.comma)', expectedError: 'Invalid json() syntax: requires json(field, path) format' },
	// Missing field name
	{ input: 'json(, path)', expectedError: 'Invalid json() syntax: missing field name' },
	{ input: 'json( , path)', expectedError: 'Invalid json() syntax: missing field name' },
	// Missing path
	{ input: 'json(field,)', expectedError: 'Invalid json() syntax: missing path' },
	// Unsupported path expressions
	{ input: 'json(data, items[].name)', expectedError: 'Invalid json() syntax: unsupported path expression' },
	{ input: 'json(data, [])', expectedError: 'Invalid json() syntax: unsupported path expression' },
	{ input: 'json(data, *)', expectedError: 'Invalid json() syntax: unsupported path expression' },
	{ input: 'json(data, items[*].name)', expectedError: 'Invalid json() syntax: unsupported path expression' },
	{ input: 'json(data, items.*)', expectedError: 'Invalid json() syntax: unsupported path expression' },
	{ input: 'json(data, items[?(@.price > 10)])', expectedError: 'Invalid json() syntax: unsupported path expression' },
	{ input: 'json(data, ?.name)', expectedError: 'Invalid json() syntax: unsupported path expression' },
	{ input: 'json(data, @.name)', expectedError: 'Invalid json() syntax: unsupported path expression' },
	{ input: 'json(data, name$value)', expectedError: 'Invalid json() syntax: unsupported path expression' },
	{ input: 'json(data, $.name)', expectedError: 'Invalid json() syntax: unsupported path expression' },
	// Exceeds maximum depth (default is 10)
	{
		input: 'json(data, a.b.c.d.e.f.g.h.i.j.k)',
		expectedError: 'Invalid query. JSON path depth (11) exceeds allowed maximum of 10.',
	},
	{
		input: 'json(data, a[0].b[1].c[2].d[3].e[4].f[5])',
		expectedError: 'Invalid query. JSON path depth (12) exceeds allowed maximum of 10.',
	},
];

const JSON_PATH_DEPTH_TEST_CASES = [
	// Empty string
	{ path: '', expected: 0 },
	// Single property access
	{ path: '.color', expected: 1 },
	{ path: 'color', expected: 0 },
	// Nested property access
	{ path: '.settings.theme', expected: 2 },
	{ path: '.a.b.c', expected: 3 },
	{ path: '.a.b.c.d.e.f.g.h.i.j', expected: 10 },
	// Array access
	{ path: '[0]', expected: 1 },
	{ path: '.items[0]', expected: 2 },
	{ path: '[0][1]', expected: 2 },
	// Mixed property and array access
	{ path: '.items[0].name', expected: 3 },
	{ path: '.data[0].nested[1].value', expected: 5 },
	{ path: '.a.b[0].c[1].d', expected: 6 },
	// Complex paths
	{ path: '.a.b.c.d.e.f.g.h.i.j.k', expected: 11 },
	{ path: '.a[0].b[1].c[2].d[3].e[4].f[5]', expected: 12 },
	// Paths without leading dot
	{ path: 'a.b.c', expected: 2 },
	{ path: 'items[0].name', expected: 2 },
];

describe('JsonHelper', () => {
	describe('calculateJsonPathDepth', () => {
		test.each(JSON_PATH_DEPTH_TEST_CASES)('returns $expected for "$path"', ({ path, expected }) => {
			expect(calculateJsonPathDepth(path)).toBe(expected);
		});
	});

	describe('parseJsonFunction', () => {
		describe('valid inputs', () => {
			test.each(VALID_TEST_CASES)(
				'parses "$input" to field="$expected.field" path="$expected.path"',
				({ input, expected }) => {
					expect(parseJsonFunction(input)).toEqual(expected);
				},
			);
		});

		describe('invalid inputs', () => {
			test.each(INVALID_TEST_CASES)('throws for "$input"', ({ input, expectedError }) => {
				expect(() => parseJsonFunction(input)).toThrow(expectedError);
			});
		});
	});
});

// Backoffice (spec 023, D-184): json(field, path, type) in filters, one [*] (FR-001, FR-002).
describe('parseJsonFunction with a type and [*] (spec 023)', () => {
	test.each([
		{ input: 'json(a, b)', expected: { field: 'a', path: '.b', type: 'text' } },
		{ input: 'json(a, b.c, number)', expected: { field: 'a', path: '.b.c', type: 'number' } },
		{ input: 'json(a, b, boolean)', expected: { field: 'a', path: '.b', type: 'boolean' } },
		{ input: 'json(a, b, text)', expected: { field: 'a', path: '.b', type: 'text' } },
		{ input: 'json( a , items[0].sku , number )', expected: { field: 'a', path: '.items[0].sku', type: 'number' } },
		{ input: 'json(a, items[*].sku, text)', expected: { field: 'a', path: '.items[*].sku', type: 'text' } },
		{ input: 'json(a, [*], text)', expected: { field: 'a', path: '[*]', type: 'text' } },
		{ input: 'json(a, [*].b, number)', expected: { field: 'a', path: '[*].b', type: 'number' } },
		{ input: "json(a, a'b;--, text)", expected: { field: 'a', path: ".a'b;--", type: 'text' } },
	])('filter mode parses "$input"', ({ input, expected }) => {
		expect(parseJsonFunction(input, { filter: true })).toEqual(expected);
	});

	test.each([
		{ input: 'json(a, b, money)', error: 'Invalid json() syntax: unknown type "money"' },
		{ input: 'json(a, b, c, d)', error: 'Invalid json() syntax: unknown type "d"' },
		{ input: 'json(a, b,)', error: 'Invalid json() syntax: unknown type ""' },
		{ input: 'json(a, a[*].b[*], text)', error: 'Invalid json() syntax: only one [*] is allowed' },
		{ input: 'json(a, items[, number)', error: 'Invalid json() syntax: unsupported path expression' },
		{ input: 'json(a, items[x].b, text)', error: 'Invalid json() syntax: unsupported path expression' },
		{ input: 'json(a, a..b, text)', error: 'Invalid json() syntax: unsupported path expression' },
		{ input: 'json(a, items.*, text)', error: 'Invalid json() syntax: unsupported path expression' },
		{ input: 'json(a, $.b, text)', error: 'Invalid json() syntax: unsupported path expression' },
		{ input: 'json(a, "x, text)', error: 'Invalid json() syntax: unsupported path expression' },
		{ input: 'json(a)', error: 'Invalid json() syntax: requires json(field, path) format' },
		{
			input: 'json(a, a[*].b.c.d.e.f.g.h.i.j, number)',
			error: 'Invalid query. JSON path depth (11) exceeds allowed maximum of 10.',
		},
	])('filter mode throws for "$input"', ({ input, error }) => {
		expect(() => parseJsonFunction(input, { filter: true })).toThrow(error);
	});

	test('outside filters a known type is read, [*] is refused and an unknown third part stays in the path (DR)', () => {
		expect(parseJsonFunction('json(a, b, number)')).toEqual({ field: 'a', path: '.b', type: 'number' });
		expect(parseJsonFunction('json(a, b)')).toEqual({ field: 'a', path: '.b' });
		expect(parseJsonFunction('json(a, b, c)')).toEqual({ field: 'a', path: '.b, c' });
		expect(() => parseJsonFunction('json(a, items[*].sku, text)')).toThrow('unsupported path expression');
	});

	test.each([
		{ path: '.items[*].sku', expected: { before: '.items', after: '.sku' } },
		{ path: '[*]', expected: { before: '', after: '' } },
		{ path: '[*].b', expected: { before: '', after: '.b' } },
		{ path: '.a.b[*]', expected: { before: '.a.b', after: '' } },
		{ path: '.items[0].sku', expected: null },
	])('splitWildcard("$path")', ({ path, expected }) => {
		expect(splitWildcard(path)).toEqual(expected);
	});

	test('jsonFilterType maps to the field types whose operators apply', () => {
		expect(jsonFilterType('text')).toBe('string');
		expect(jsonFilterType('number')).toBe('float');
		expect(jsonFilterType('boolean')).toBe('boolean');
	});
});
