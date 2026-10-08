// Ported from directus/packages/env/src/utils/remove-file-suffix.test.ts
import { expect, test } from 'vitest';
import { removeFileSuffix } from './remove-file-suffix.js';

test('Removes the last 5 characters from the given string', () => {
	expect(removeFileSuffix('TEST_123_FILE')).toBe('TEST_123');
});
