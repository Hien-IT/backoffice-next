// The committed theme data matches directus/packages/themes 11.17.4 (spec FR-084, FR-085, D-89, FR-121): the DR
// theme sources are loaded with jiti as the script does (Vite cannot: their tsconfig extends a package of the DR
// workspace) and rendered by `renderThemes`, which must give the committed file apart from the date.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { describe, expect, test } from 'vitest';
import { OUT, renderThemes } from './sync-theme-presets.mjs';

const SOURCES = join(import.meta.dirname, '../../../directus/packages/themes/src/themes/index.ts');

const withoutDate = (text: string) => text.replace(/"\$generated": "[^"]*"/, '"$generated": ""');

describe('sync-theme-presets', () => {
	test('the Directus theme sources give the committed file', async () => {
		const themes = await createJiti(import.meta.url).import(SOURCES);

		expect(withoutDate(renderThemes(themes, ''))).toBe(withoutDate(readFileSync(OUT, 'utf8')));
	});
});
