// The committed theme data (spec FR-084, FR-085, D-89): its shape. scripts/sync-theme-presets.test.ts checks that it
// equals a new render of the Directus 11.17.4 theme sources.
import { describe, expect, test } from 'vitest';
import data from './theme-presets.json';

describe('theme-presets.json', () => {
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
