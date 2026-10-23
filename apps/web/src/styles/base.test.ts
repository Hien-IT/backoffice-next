// base.css: the project color tint of the page (D-152, shared with the field detail tab content, D-167) and the
// defaults of the text and tiles on the project color (D-163), which the app head overrides.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const css = readFileSync(join(import.meta.dirname, 'base.css'), 'utf8').replace(/\s+/g, ' ');

test('the light page background is --project-tint, 5% project color into white; dark keeps gray-900 (D-152)', () => {
	expect(css).toContain('--project-tint: color-mix(in srgb, var(--color-white), var(--project-color) 5%);');
	expect(css).toMatch(/body \{[^}]*background-color: var\(--project-tint\);[^}]*dark:bg-gray-900/);
});

test('white text and darker tiles on the theme primary until the app head knows the project color (D-163)', () => {
	expect(css).toContain('--project-foreground: var(--color-white);');
	expect(css).toContain('--project-tile: color-mix(in srgb, var(--project-color), var(--color-gray-950) 10%);');
	expect(css).toContain('--project-tile-hover: color-mix(in srgb, var(--project-color), var(--color-gray-950) 20%);');
});
