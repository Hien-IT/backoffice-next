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
		expect(overridesToCss({ primary: '#aa0000' }, ':root.light')).toBe(
			':root.light { --eh-color-action-primary: #aa0000; }',
		);
	});

	test('maps on the dark scope', () => {
		expect(overridesToCss({ background: 'rgb(10, 10, 10)' }, ':root.dark')).toBe(
			':root.dark { --eh-color-surface-default: rgb(10, 10, 10); }',
		);
	});

	test('nested keys use dot paths (navigation, header, sidebar, fonts)', () => {
		const css = overridesToCss(
			{
				navigation: { background: 'hsl(0 0% 90%)' },
				header: { background: 'white' },
				sidebar: { background: 'silver' },
				fonts: { sans: { fontFamily: '"Inter", sans-serif' } },
			},
			':root.light',
		);

		expect(css).toBe(
			':root.light { --bo-navigation-background: hsl(0 0% 90%); --bo-header-background: white; ' +
				'--bo-sidebar-background: silver; --eh-font-family-body: "Inter", sans-serif; }',
		);
	});

	test('every key of research R2 has a token', () => {
		expect(Object.keys(OVERRIDE_MAP)).toHaveLength(16);
		expect(OVERRIDE_MAP['borderRadius']).toBe('--eh-radius-md');
		expect(OVERRIDE_MAP['foregroundSubdued']).toBe('--eh-color-text-secondary');
		expect(OVERRIDE_MAP['danger']).toBe('--eh-color-status-danger');
	});

	test('two keys on one token: the later one wins in CSS order', () => {
		expect(overridesToCss({ foreground: 'black', foregroundAccent: 'navy' }, ':root.light')).toBe(
			':root.light { --eh-color-text-primary: black; --eh-color-text-primary: navy; }',
		);
	});

	test('numbers become text', () => {
		expect(overridesToCss({ borderRadius: 0 }, ':root.light')).toBe(':root.light { --eh-radius-md: 0; }');
	});

	test('unmapped keys are dropped with a warning', () => {
		expect(overridesToCss({ unmappedA: 'red', form: { columnGap: '4px' } }, ':root.light')).toBe('');
		expect(warn).toHaveBeenCalledWith('[theme] override "unmappedA" ignored: no design-system token');
		expect(warn).toHaveBeenCalledWith('[theme] override "form.columnGap" ignored: no design-system token');
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
				background: 'red</style><script>',
				borderColor: 'url(https://x.test/a)',
				backgroundNormal: '   ',
			},
			':root.dark',
		);

		expect(css).toBe('');
	});

	test('non-text values are dropped', () => {
		expect(overridesToCss({ backgroundSubdued: ['red'], foregroundAccent: true, foreground: null }, ':root.dark')).toBe(
			'',
		);
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
			':root.light { --eh-color-action-primary: #123456; }',
		);
	});
});
