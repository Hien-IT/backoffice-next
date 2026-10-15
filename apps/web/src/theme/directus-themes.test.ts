// The committed theme data matches directus/packages/themes 11.17.4 (spec FR-084, FR-085, D-89, FR-121): the script
// runs again under jiti into a temporary file, which must equal the committed one apart from the date.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import data from './directus-themes.json';

const WEB = join(import.meta.dirname, '../..');
const OUT = join(import.meta.dirname, 'directus-themes.json');
const tmp = mkdtempSync(join(tmpdir(), 'sync-themes-'));

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const withoutDate = (text: string) => text.replace(/"\$generated": "[^"]*"/, '"$generated": ""');

describe('directus-themes.json', () => {
	test('a new run of the script gives the committed file', () => {
		const out = join(tmp, 'themes.json');

		execFileSync(join(WEB, '../../node_modules/.bin/jiti'), ['scripts/sync-directus-themes.mjs', out], { cwd: WEB });

		expect(withoutDate(readFileSync(out, 'utf8'))).toBe(withoutDate(readFileSync(OUT, 'utf8')));
	});

	test('three light themes and one dark theme with id, name, appearance and rules', () => {
		expect(data.light.map((theme) => theme.id)).toEqual([
			'Directus Default',
			'Directus Minimal',
			'Directus Color Match',
		]);
		expect(data.dark.map((theme) => theme.id)).toEqual(['Directus Default']);
		expect(data.$source).toContain('directus/packages/themes/src/themes/**');
		expect(data.$generated).toMatch(/^\d{4}-\d{2}-\d{2}$/);

		for (const [appearance, themes] of [
			['light', data.light],
			['dark', data.dark],
		] as const) {
			for (const theme of themes) {
				expect(Object.keys(theme)).toEqual(['id', 'name', 'appearance', 'rules']);
				expect(theme.appearance).toBe(appearance);
				expect(theme.name).toMatch(/^\$t:theme_directus_/);
				expect(typeof theme.rules).toBe('object');
			}
		}
	});
});
