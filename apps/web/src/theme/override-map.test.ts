import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { OVERRIDE_MAP, overridesToCss } from './override-map.ts';

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	warn.mockRestore();
});

describe('overridesToCss', () => {
	test('maps primary on the light scope', () => {
		expect(overridesToCss({ primary: '#aa0000' }, ':root.light')).toBe(':root.light { --color-brand-500: #aa0000; }');
	});

	test('maps on the dark scope', () => {
		expect(overridesToCss({ danger: 'rgb(10, 10, 10)' }, ':root.dark')).toBe(
			':root.dark { --color-error-500: rgb(10, 10, 10); }',
		);
	});

	test('nested keys use dot paths (fonts)', () => {
		expect(overridesToCss({ fonts: { sans: { fontFamily: '"Inter", sans-serif' } } }, ':root.light')).toBe(
			':root.light { --font-outfit: "Inter", sans-serif; }',
		);
	});

	test('the keys of FR-063 map to TailAdmin theme variables', () => {
		expect(OVERRIDE_MAP).toEqual({
			primary: '--color-brand-500',
			success: '--color-success-500',
			warning: '--color-warning-500',
			danger: '--color-error-500',
			'fonts.sans.fontFamily': '--font-outfit',
		});
	});

	test('numbers become text', () => {
		expect(overridesToCss({ primary: 0 }, ':root.light')).toBe(':root.light { --color-brand-500: 0; }');
	});

	test('Directus keys without a theme variable are dropped (background, navigation.background...)', () => {
		expect(overridesToCss({ background: 'red', navigation: { background: 'blue' } }, ':root.light')).toBe('');
	});

	test('unmapped keys are dropped with a warning', () => {
		expect(overridesToCss({ unmappedA: 'red', form: { columnGap: '4px' } }, ':root.light')).toBe('');
		expect(warn).toHaveBeenCalledWith('[theme] override "unmappedA" ignored: no design-system theme variable');
		expect(warn).toHaveBeenCalledWith('[theme] override "form.columnGap" ignored: no design-system theme variable');
	});

	test('var(--theme--*) values are dropped', () => {
		expect(overridesToCss({ success: 'var(--theme--primary)' }, ':root.light')).toBe('');
		expect(overridesToCss({ warning: 'color-mix(in srgb, var(--theme--primary), white)' }, ':root.light')).toBe('');
		expect(warn).toHaveBeenCalledTimes(2);
	});

	test('values that could break out of the rule are dropped', () => {
		const css = overridesToCss(
			{
				primary: 'red; } body { display: none',
				danger: 'red</style><script>',
				success: 'url(https://x.test/a)',
				warning: '   ',
			},
			':root.dark',
		);

		expect(css).toBe('');
	});

	test('non-text values are dropped', () => {
		expect(overridesToCss({ primary: ['red'], success: true, warning: null }, ':root.dark')).toBe('');
	});

	test('warns once per key', () => {
		overridesToCss({ onceKey: 'red' }, ':root.light');
		overridesToCss({ onceKey: 'blue' }, ':root.dark');
		expect(warn.mock.calls.filter(([message]) => String(message).includes('"onceKey"'))).toHaveLength(1);
	});

	test('null, empty or non-object overrides give an empty string', () => {
		expect(overridesToCss(null, ':root.light')).toBe('');
		expect(overridesToCss(undefined, ':root.light')).toBe('');
		expect(overridesToCss({}, ':root.light')).toBe('');
		expect(overridesToCss('primary', ':root.light')).toBe('');
		expect(overridesToCss(['#aa0000'], ':root.light')).toBe('');
	});

	test('keeps valid keys next to dropped ones', () => {
		expect(overridesToCss({ primary: '#123456', nope: 'red', danger: 'red;' }, ':root.light')).toBe(
			':root.light { --color-brand-500: #123456; }',
		);
	});
});
