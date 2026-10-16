// The committed app permission data (spec 016 FR-055): its shape. scripts/sync-permissions-data.test.ts checks that it
// equals a new render of the Directus 11.17.4 sources.
import { describe, expect, test } from 'vitest';
import data from './app-permissions-data.json';

describe('app-permissions-data.json', () => {
	test('minimal rows are system rows without policy; recommended rows have no policy; five actions', () => {
		expect(data.minimal.length).toBeGreaterThan(10);
		for (const row of data.minimal) {
			expect(row).toMatchObject({ policy: null, system: true });
			expect(typeof row.collection).toBe('string');
			expect(['create', 'read', 'update', 'delete', 'share']).toContain(row.action);
		}
		for (const row of data.recommended) expect(row).not.toHaveProperty('policy');
		expect(data.actions).toEqual(['create', 'read', 'update', 'delete', 'share']);
		expect(data.disabledActions).toEqual({ directus_extensions: ['create', 'delete'] });
	});
});
