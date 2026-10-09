import { expect, test } from 'vitest';
import { castBoolean, castCsv, castJson } from './cast-on-read.js';

test.each([
	[true, true],
	[1, true],
	['1', true],
	[false, false],
	[0, false],
	['0', false],
	[null, null],
	['', null],
	['yes', 'yes'],
])('castBoolean(%o) = %o', (value, expected) => {
	expect(castBoolean(value)).toBe(expected);
});

test('castJson parses strings, drops __proto__, keeps invalid JSON and non-strings', () => {
	expect(castJson('{"a":1}')).toEqual({ a: 1 });
	expect(castJson('{"__proto__":{"x":1},"b":2}')).toEqual({ b: 2 });
	expect(castJson('{bad')).toBe('{bad');
	expect(castJson({ a: 1 })).toEqual({ a: 1 });
	expect(castJson(null)).toBe(null);
});

test('castCsv splits strings, keeps arrays, empty string is []', () => {
	expect(castCsv('a,b')).toEqual(['a', 'b']);
	expect(castCsv('')).toEqual([]);
	expect(castCsv(['x'])).toEqual(['x']);
	expect(castCsv(null)).toBe(null);
});
