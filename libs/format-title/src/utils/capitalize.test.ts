// Ported from directus/packages/format-title/src/utils/capitalize.test.ts
import { expect, test } from 'vitest';
import { capitalize } from './capitalize.js';

test('Capitalizes input string', () => {
	expect(capitalize('test')).toBe('Test');
	expect(capitalize('Test')).toBe('Test');
	expect(capitalize('TEST')).toBe('TEST');
});
