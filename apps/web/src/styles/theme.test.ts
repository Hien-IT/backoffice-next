import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const appTheme = readFileSync(join(here, 'theme.css'), 'utf8');
const designSystemTheme = readFileSync(join(here, '../../../../design-system/tokens/theme.css'), 'utf8');

/** `--color-*` hex values of the @theme block. */
const colors = Object.fromEntries(
	[...appTheme.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6});/g)].map(([, name, value]) => [name!, value!]),
);

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});

	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(fg: string, bg: string): number {
	const [a, b] = [luminance(colors[fg]!), luminance(colors[bg]!)].sort((x, y) => y - x);
	return (a! + 0.05) / (b! + 0.05);
}

describe('theme.css', () => {
	it('is the design-system theme, copied verbatim (constitution XII)', () => {
		expect(appTheme).toBe(designSystemTheme);
	});

	it('has only the TailAdmin colors (the Tailwind palette is reset)', () => {
		expect(appTheme).toContain('--color-*: initial;');
		expect(colors['brand-500']?.toLowerCase()).toBe('#465fff');
	});
});

// FR-067 with the recipes of design-system/docs/component-specs.md: text >= 4.5:1, borders and focus >= 3:1.
const TEXT = 4.5;
const UI = 3;

describe('contrast of the design-system recipes', () => {
	it.each([
		['white', 'brand-500', TEXT, 'primary button text'],
		['brand-500', 'white', TEXT, 'link'],
		['brand-600', 'brand-50', TEXT, 'active menu item'],
		['gray-800', 'white', TEXT, 'body text'],
		['gray-500', 'white', TEXT, 'secondary text, placeholder'],
		['gray-500', 'gray-50', TEXT, 'secondary text on the page background'],
		['error-600', 'white', TEXT, 'field error text'],
		['success-700', 'success-50', TEXT, 'success badge'],
		['white', 'error-600', TEXT, 'danger button'],
		['gray-400', 'gray-900', TEXT, 'dark secondary text'],
		['brand-400', 'gray-900', TEXT, 'dark link'],
		['gray-500', 'white', UI, 'input border'],
		['brand-500', 'white', UI, 'focus outline'],
	])('%s on %s >= %s (%s)', (fg, bg, min) => {
		expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
	});
});
