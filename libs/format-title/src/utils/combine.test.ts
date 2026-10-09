// Ported from directus/packages/format-title/src/utils/combine.test.ts
import { expect, test } from 'vitest';
import { combine } from './combine.js';

test('Combines two strings with a space', () => {
	expect(combine('Hello', 'World')).toBe('Hello World');
});
