import { expect, test } from 'vitest';
import * as types from './index.js';

test('exports the runtime values of the type package', () => {
	expect(types.DatabaseClients).toContain('postgres');
});

test('exports UserIntegrityCheckFlag like Directus', () => {
	expect(types.UserIntegrityCheckFlag.None).toBe(0);
	expect(types.UserIntegrityCheckFlag.RemainingAdmins).toBe(1);
	expect(types.UserIntegrityCheckFlag.UserLimits).toBe(2);
	expect(types.UserIntegrityCheckFlag.All).toBe(3);
});

test('exports DiffKind like Directus', () => {
	expect(types.DiffKind).toEqual({ NEW: 'N', DELETE: 'D', EDIT: 'E', ARRAY: 'A' });
});
