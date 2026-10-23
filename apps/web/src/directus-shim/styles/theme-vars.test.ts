// Spec 020 (T107, data-model §8): theme-vars.css declares under :root every rule of the DR ThemeSchema
// (@directus/types, 173 names after rules-to-css-vars), the 11 variables the DR app uses without a rule, the
// palette of _colors.scss and the .type-* / .form-grid classes; no raw color (design-system tokens only).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ThemeSchema } from '@directus/types';
import { expect, test } from 'vitest';

// Read from disk: the Tailwind Vite plugin processes CSS imports, `?raw` included.
const css = readFileSync(join(import.meta.dirname, 'theme-vars.css'), 'utf8');

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function names(schema: any, prefix = ''): string[] {
	let s = schema;
	while (s?.def?.innerType ?? s?._def?.innerType) s = s.def?.innerType ?? s._def.innerType;
	const shape = s?.shape ?? s?.def?.shape;

	if (shape && typeof shape === 'object' && !Array.isArray(shape)) {
		return Object.entries(shape).flatMap(([key, child]) =>
			names(child, prefix ? `${prefix}--${kebab(key)}` : kebab(key)),
		);
	}

	return [`--theme--${prefix}`];
}

const root = css.slice(css.indexOf(':root {'), css.indexOf(':root.dark {'));
const declared = (block: string) => new Set([...block.matchAll(/^\t(--[\w-]+):/gm)].map((m) => m[1]));

test('every ThemeSchema rule is declared under :root', () => {
	const expected = names((ThemeSchema as any).shape.rules);
	expect(expected).toHaveLength(173);
	expect(expected.filter((name) => !declared(root).has(name))).toEqual([]);
});

test('the variables the Directus app uses without a rule, the palette and the classes', () => {
	const vars = declared(root);

	for (const name of [
		'--theme--banner--foreground',
		// In the default themes of directus/packages/themes, not in the ThemeSchema (E2E extensions-runtime-parity).
		'--theme--sidebar--section--form--label--foreground',
		'--theme--sidebar--section--form--label--font-family',
		'--theme--public--form--label--foreground',
		'--theme--public--form--label--font-family',
		'--theme--card--shadow',
		'--theme--primary-75',
		'--theme--shadow',
		'--transition',
		'--fast',
		'--content-padding',
		'--input-height-md',
		'--focus-ring-color',
		'--foreground-inverted',
		'--background-inverted',
		'--overlay-color',
		'--purple',
		'--primary-10',
		'--danger-190',
	])
		expect(vars.has(name), name).toBe(true);

	for (const selector of ['.type-title', '.type-label', '.type-text', '.type-note', '.form-grid']) {
		expect(css).toContain(`${selector} {`);
	}
});

test('dark values override the light ones; no raw hex color', () => {
	expect(declared(css.slice(css.indexOf(':root.dark {'))).has('--theme--background')).toBe(true);
	expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
});

test('.type-* and .form-grid are in the components layer, so utilities on shim components win', () => {
	const layer = css.slice(css.indexOf('@layer components {'));
	expect(css.indexOf('@layer components {')).toBeGreaterThan(-1);
	for (const selector of ['.type-title {', '.type-label {', '.type-text {', '.type-note {', '.form-grid {']) {
		expect(layer).toContain(selector);
	}
});
