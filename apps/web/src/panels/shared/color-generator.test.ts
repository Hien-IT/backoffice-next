import { expect, test } from 'vitest';
import { monoThemeGenerator } from './color-generator.ts';

test('starts with the base color and returns distinct colors', () => {
	const theme = monoThemeGenerator('#465fff', 5);

	expect(theme).toHaveLength(5);
	expect(theme[0]).toBe('#465fff');
	expect(new Set(theme).size).toBe(5);
	for (const color of theme.slice(1)) expect(color).toMatch(/^#[0-9a-f]{6}$/);
});

test('one color is the base color only', () => {
	expect(monoThemeGenerator('#12b76a', 1)).toEqual(['#12b76a']);
});
