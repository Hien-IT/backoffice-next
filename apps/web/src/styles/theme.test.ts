import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(join(here, 'tokens.css'), 'utf8');
const themeCss = readFileSync(join(here, 'theme.css'), 'utf8');

/** Declarations of every block whose selector is exactly `selector`, later blocks win. */
function declarations(css: string, selector: string): Record<string, string> {
	const result: Record<string, string> = {};
	const blocks = css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g);

	for (const [, head, body] of blocks) {
		if (head!.trim() !== selector) continue;

		for (const [, name, value] of body!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) result[name!] = value!.trim();
	}

	return result;
}

const light = declarations(tokensCss, ':root');
const dark = { ...light, ...declarations(tokensCss, ':root.dark') };

function resolve(vars: Record<string, string>, name: string): string {
	const value = vars[name];
	if (value === undefined) throw new Error(`unknown token ${name}`);
	const ref = /^var\((--[\w-]+)\)$/.exec(value);
	return ref ? resolve(vars, ref[1]!) : value;
}

function luminance(hex: string): number {
	const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(full.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});

	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(vars: Record<string, string>, fg: string, bg: string): number {
	const [a, b] = [luminance(resolve(vars, fg)), luminance(resolve(vars, bg))].sort((x, y) => y - x);
	return (a! + 0.05) / (b! + 0.05);
}

describe('theme.css', () => {
	it('maps every --eh-* token of tokens.css in @theme', () => {
		const missing = Object.keys(light)
			.filter((name) => name.startsWith('--eh-') && !name.startsWith('--eh-shadow'))
			.filter((name) => !themeCss.includes(`var(${name})`));

		expect(missing).toEqual([]);
		expect(themeCss).toContain('var(--eh-shadow-sm)');
	});

	it('removes the Tailwind palette (no gray-*, sky-*...)', () => {
		expect(themeCss).toContain('--color-*: initial;');
	});
});

// FR-067: text >= 4.5:1, UI components >= 3:1. Pairs already listed in Q-8 fail on purpose (it.fails): the test
// reports when the design owner changes the token, every other pair must pass.
const TEXT = 4.5;
const UI = 3;

describe.each([
	['light', light],
	['dark', dark],
])('contrast (%s)', (theme, vars) => {
	it('primary text on surfaces', () => {
		expect(contrast(vars, '--eh-color-text-primary', '--eh-color-surface-default')).toBeGreaterThanOrEqual(TEXT);
		expect(contrast(vars, '--eh-color-text-primary', '--eh-color-surface-subtle')).toBeGreaterThanOrEqual(TEXT);
	});

	it('focus ring (action primary) on the default surface', () => {
		expect(contrast(vars, '--eh-color-action-primary', '--eh-color-surface-default')).toBeGreaterThanOrEqual(UI);
	});

	// Q-8: white on #1890ff is 3.24:1 in both themes.
	it.fails('text on the primary button (Q-8)', () => {
		expect(contrast(vars, '--eh-color-neutral-0', '--eh-color-action-primary')).toBeGreaterThanOrEqual(TEXT);
	});

	if (theme === 'light') {
		// Q-8: secondary text 3.77:1 (3.46:1 on subtle), link 3.24:1, input border 1.23:1.
		it.fails('secondary text on surface default (Q-8)', () => {
			expect(contrast(vars, '--eh-color-text-secondary', '--eh-color-surface-default')).toBeGreaterThanOrEqual(TEXT);
		});
		it.fails('secondary text on surface subtle (Q-8)', () => {
			expect(contrast(vars, '--eh-color-text-secondary', '--eh-color-surface-subtle')).toBeGreaterThanOrEqual(TEXT);
		});
		it.fails('link on surface default (Q-8)', () => {
			expect(contrast(vars, '--eh-color-action-primary', '--eh-color-surface-default')).toBeGreaterThanOrEqual(TEXT);
		});
		it.fails('input border on surface default (Q-8)', () => {
			expect(contrast(vars, '--eh-color-border', '--eh-color-surface-default')).toBeGreaterThanOrEqual(UI);
		});
	} else {
		it('secondary text, link and input border', () => {
			expect(contrast(vars, '--eh-color-text-secondary', '--eh-color-surface-default')).toBeGreaterThanOrEqual(TEXT);
			expect(contrast(vars, '--eh-color-text-secondary', '--eh-color-surface-subtle')).toBeGreaterThanOrEqual(TEXT);
			expect(contrast(vars, '--eh-color-action-primary', '--eh-color-surface-default')).toBeGreaterThanOrEqual(TEXT);
			expect(contrast(vars, '--eh-color-border', '--eh-color-surface-default')).toBeGreaterThanOrEqual(UI);
		});
	}
});
