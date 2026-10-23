// The committed permission data matches DR 11.17.4 (spec 016 FR-055, FR-105): app-permissions.ts is loaded with
// jiti as the script does and rendered by `renderPermissions` with the yaml rows, which must give the committed file
// apart from the date.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { describe, expect, test } from 'vitest';
import { APP_PERMISSIONS, minimalPermissions, OUT, renderPermissions } from './sync-permissions-data.mjs';

const withoutDate = (text: string) => text.replace(/"\$generated": "[^"]*"/, '"$generated": ""');

describe('sync-permissions-data', () => {
	test('the Directus sources give the committed file', async () => {
		const app = await createJiti(import.meta.url).import(join(import.meta.dirname, '../../..', APP_PERMISSIONS));

		expect(withoutDate(renderPermissions(minimalPermissions(), app, ''))).toBe(withoutDate(readFileSync(OUT, 'utf8')));
	});

	test('minimal rows: the defaults first, then the row (app-access-permissions/index.ts)', () => {
		const rows = minimalPermissions((path) =>
			path.endsWith('schema-access-permissions.yaml')
				? '- collection: directus_fields\n  action: read\n'
				: '- collection: directus_presets\n  action: read\n  fields: [id]\n',
		);

		expect(rows).toEqual([
			{
				policy: null,
				permissions: {},
				validation: null,
				presets: null,
				fields: ['*'],
				system: true,
				collection: 'directus_fields',
				action: 'read',
			},
			{
				policy: null,
				permissions: {},
				validation: null,
				presets: null,
				fields: ['id'],
				system: true,
				collection: 'directus_presets',
				action: 'read',
			},
		]);
	});
});
