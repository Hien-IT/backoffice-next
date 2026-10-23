// Compressed cache values (task T014): what setCacheValue stores is what getCacheValue reads, in the DR format
// (JSON compression of @directus/utils, then snappy). Byte equality with values DR wrote is checked by the
// parity test of the filter-context-* keys (tasks T069).
import Keyv from 'keyv';
import { describe, expect, test } from 'vitest';
import { getCacheValue, setCacheValue } from '../cache.js';
import { compress, decompress } from './compress.js';

describe('compress', () => {
	test('round trip of objects and arrays', async () => {
		const value = { id: 'a', roles: ['r1', 'r2'], nested: { n: 1, b: true, z: null } };
		expect(await decompress(await compress(value))).toEqual(value);
		expect(await decompress(await compress([value, value]))).toEqual([value, value]);
	});

	test('empty values pass through', async () => {
		expect(await compress(undefined as any)).toBeUndefined();
		expect(await decompress(undefined as any)).toBeUndefined();
	});
});

describe('setCacheValue / getCacheValue', () => {
	test('store a compressed value and read it back; a missing key reads undefined', async () => {
		const cache = new Keyv();
		await setCacheValue(cache, 'filter-context-CURRENT_USER-abc', { department: 'sales' });

		expect(Buffer.isBuffer(await cache.get('filter-context-CURRENT_USER-abc'))).toBe(true);
		expect(await getCacheValue(cache, 'filter-context-CURRENT_USER-abc')).toEqual({ department: 'sales' });
		expect(await getCacheValue(cache, 'missing')).toBeUndefined();
	});
});
