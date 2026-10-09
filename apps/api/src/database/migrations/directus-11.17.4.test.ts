import { readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { DIRECTUS_MIGRATIONS } from './directus-11.17.4.js';

// Fails when the bundled list drifts from directus/api/src/database/migrations (e.g. after a Directus upgrade).
test('equals the 101 versions of directus/api/src/database/migrations', () => {
	const dir = new URL('../../../../../directus/api/src/database/migrations', import.meta.url);

	const versions = [
		...new Set(
			readdirSync(dir)
				.filter((f) => /^[0-9]+[A-Z]-[^.]+\.(?:js|ts)$/.test(f))
				.map((f) => f.split('-')[0]!),
		),
	].sort();

	expect(versions).toHaveLength(101);
	expect(versions[0]).toBe('20201028A');
	expect(versions.at(-1)).toBe('20260211A');
	expect([...DIRECTUS_MIGRATIONS]).toEqual(versions);
});
