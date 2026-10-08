import { expect, test } from 'vitest';
import * as constants from './index.js';

test('exports the Directus 11.17.4 constants', () => {
	expect(constants.JAVASCRIPT_FILE_EXTS).toEqual(['js', 'mjs', 'cjs']);
	expect(constants.DEFAULT_CHUNK_SIZE).toBe(8_388_608);
	expect(constants.PERMISSION_ACTIONS).toEqual(['create', 'read', 'update', 'delete', 'share']);
	expect(Object.keys(constants).length).toBeGreaterThan(20);
});
