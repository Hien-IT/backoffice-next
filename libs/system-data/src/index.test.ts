import { expect, test } from 'vitest';
import * as systemData from './index.js';

// The YAML files are read at load time (instead of being embedded at build time like Directus does).
test('loads every system data set from YAML', () => {
	expect(systemData.systemCollectionRows.find((c) => c.collection === 'directus_settings')).toMatchObject({
		singleton: true,
		system: true,
	});
	expect(systemData.systemRelationRows.length).toBeGreaterThan(10);
	expect(systemData.systemRelationRows.every((r) => r.system === true)).toBe(true);
	expect(systemData.schemaPermissions.length).toBeGreaterThan(0);
	expect(systemData.appAccessMinimalPermissions.length).toBeGreaterThan(systemData.schemaPermissions.length);
	expect(systemData.appAccessMinimalPermissions[0]).toMatchObject({ policy: null, fields: ['*'], system: true });
});

test('settings fields carry the casts /server/info relies on', () => {
	const field = (name: string) =>
		systemData.systemFieldRows.find((f) => f.collection === 'directus_settings' && f.field === name);
	expect(field('public_registration')?.special).toEqual(['cast-boolean']);
	expect(field('theme_light_overrides')?.special).toEqual(['cast-json']);
});
