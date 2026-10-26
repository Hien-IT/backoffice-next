// Backoffice (spec 023): cases mirror apps/api/src/database/helpers/fn/json/parse-function.test.ts (filter mode).
import { describe, expect, test } from 'vitest';
import {
	formatJsonPathKey,
	isJsonPathPlaceholder,
	isValidJsonPath,
	jsonFilterType,
	parseJsonPathKey,
} from './json-path.ts';

describe('parseJsonPathKey', () => {
	test.each([
		['json(meta, Amount, number)', { field: 'meta', path: 'Amount', type: 'number' }],
		['json(meta, a.b)', { field: 'meta', path: 'a.b', type: 'text' }],
		['json( meta , items[*].sku , boolean )', { field: 'meta', path: 'items[*].sku', type: 'boolean' }],
		['json(meta, [*], text)', { field: 'meta', path: '[*]', type: 'text' }],
	])('%s', (key, expected) => {
		expect(parseJsonPathKey(key)).toEqual(expected);
	});

	test.each(['json(meta)', 'json(meta, a, money)', 'year(date)', 'title', 'author.json(meta, a, text)'])(
		'%s → null',
		(key) => {
			expect(parseJsonPathKey(key)).toBeNull();
		},
	);
});

test('isJsonPathPlaceholder', () => {
	expect(isJsonPathPlaceholder('json(meta)')).toBe(true);
	expect(isJsonPathPlaceholder('json(author.tags)')).toBe(true);
	expect(isJsonPathPlaceholder('json(meta, a, text)')).toBe(false);
	expect(isJsonPathPlaceholder('count(meta)')).toBe(false);
});

describe('isValidJsonPath', () => {
	test.each(['Amount', 'a.b', 'items[0].sku', 'items[*].sku', '[*]', '[0]', "a'b;--", 'a b'])('%s is valid', (path) => {
		expect(isValidJsonPath(path)).toBe(true);
	});

	test.each([
		'',
		' ',
		'items[',
		'a..b',
		'a[*].b[*]',
		'items[x]',
		'items.*',
		'$.a',
		'@a',
		'a?b',
		'a"b',
		'a,b',
		'a(b)',
		'items[]',
		'a.b.c.d.e.f.g.h.i.j.k',
	])('%s is invalid', (path) => {
		expect(isValidJsonPath(path)).toBe(false);
	});
});

test('formatJsonPathKey and jsonFilterType', () => {
	expect(formatJsonPathKey('meta', ' Amount ', 'number')).toBe('json(meta, Amount, number)');
	expect(parseJsonPathKey(formatJsonPathKey('meta', 'items[*].sku', 'text'))).toEqual({
		field: 'meta',
		path: 'items[*].sku',
		type: 'text',
	});
	expect(jsonFilterType('text')).toBe('string');
	expect(jsonFilterType('number')).toBe('float');
	expect(jsonFilterType('boolean')).toBe('boolean');
});
