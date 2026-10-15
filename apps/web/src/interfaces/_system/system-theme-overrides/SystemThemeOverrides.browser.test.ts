// Feature 015 (T071, FR-085, CHK025, CHK082): system-theme-overrides in chromium (getComputedStyle for var() swatches,
// the color parser, disclosure keyboard).
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { i18n } from '../../../lang/index.ts';
import '../../../styles/index.css';
import SystemThemeOverrides from './SystemThemeOverrides.vue';

enableAutoUnmount(afterEach);

function mountOverrides(props: Record<string, unknown> = {}) {
	return mount(SystemThemeOverrides, {
		props: { value: null, appearance: 'light', ...props },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

const input = (path: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${path}"]`);
const row = (path: string) => input(path)!.closest<HTMLElement>('[data-has-value], div')!;
const group = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find(
		(button) => button.textContent?.replace('expand_more', '').trim() === name,
	)!;

beforeEach(() => setActivePinia(createPinia()));

afterEach(() => document.body.style.removeProperty('--project-color'));

describe('system-theme-overrides', () => {
	test('the $root rules ("globals") first, then the groups, all collapsed; lang en-US and ltr', async () => {
		const wrapper = mountOverrides();
		const root = wrapper.get('[data-theme-overrides]');

		expect(root.attributes('lang')).toBe('en-US');
		expect(root.attributes('dir')).toBe('ltr');
		expect(
			[...document.querySelectorAll('button[aria-expanded]')].map((b) =>
				b.textContent?.replace('expand_more', '').trim(),
			),
		).toEqual(['globals', 'fonts', 'navigation', 'header', 'form', 'sidebar', 'public', 'popover', 'banner']);
		expect(group('navigation').getAttribute('aria-expanded')).toBe('false');
		expect(input('navigation.background')).toBeNull();
		expect(input('borderRadius')).toBeNull();

		await userEvent.click(group('globals'));
		expect(input('borderRadius')!.placeholder).toBe('0.3125rem');
		expect(input('foreground')!.placeholder).toBe('#4f5464');
	});

	test('a group opens by keyboard and shows nested groups; every leaf is a text input (CHK025)', async () => {
		mountOverrides();

		group('fonts').focus();
		await userEvent.keyboard('{Enter}');
		expect(group('fonts').getAttribute('aria-expanded')).toBe('true');
		await userEvent.click(group('display'));

		expect(input('fonts.display.fontFamily')!.type).toBe('text');
		expect(input('fonts.display.fontFamily')!.placeholder).toBe('"Inter", system-ui');
		expect(input('fonts.display.fontWeight')!.placeholder).toBe('700');
		expect(document.getElementById(group('fonts').getAttribute('aria-controls')!)).not.toBeNull();
	});

	test('a swatch only for values that parse as a color', async () => {
		document.body.style.setProperty('--project-color', '#6644ff');
		mountOverrides({ value: { borderWidth: 'not-a-color' } });
		await userEvent.click(group('globals'));

		const swatch = (path: string) => input(path)!.parentElement!.querySelector<HTMLElement>('[data-swatch]');

		expect(swatch('foreground')?.style.backgroundColor).toBe('rgb(79, 84, 100)');
		expect(swatch('borderRadius')).toBeNull();
		expect(swatch('borderWidth')).toBeNull();
		// var() resolving to a hex color, and color-mix(), are rendered as they are.
		expect(swatch('primary')?.style.backgroundColor).toBe('var(--project-color)');
		expect(swatch('primaryBackground')).not.toBeNull();
	});

	test('no swatch for a var() that does not resolve to a hex color', async () => {
		mountOverrides({ value: { primary: 'var(--not-defined)' } });
		await userEvent.click(group('globals'));

		expect(input('primary')!.parentElement!.querySelector('[data-swatch]')).toBeNull();
	});

	test('typing sets the value at its path; clearing unsets it and removes the empty groups', async () => {
		const wrapper = mountOverrides();
		await userEvent.click(group('navigation'));
		await userEvent.type(input('navigation.background')!, '#000');

		expect(wrapper.emitted('input')?.at(-1)).toEqual([{ navigation: { background: '#000' } }]);

		const value = { foreground: '#111111', navigation: { background: '#000', modules: { background: '#222' } } };
		await wrapper.setProps({ value });
		await userEvent.clear(input('navigation.background')!);
		expect(wrapper.emitted('input')?.at(-1)).toEqual([
			{ foreground: '#111111', navigation: { modules: { background: '#222' } } },
		]);

		await wrapper.setProps({ value: { navigation: { modules: { background: '#222' } } } });
		await userEvent.click(group('modules'));
		await userEvent.clear(input('navigation.modules.background')!);
		expect(wrapper.emitted('input')?.at(-1)).toEqual([{}]);
		// The current value is not changed in place.
		expect(value.navigation.background).toBe('#000');
	});

	test('stored values show in the inputs and mark their groups', async () => {
		mountOverrides({ value: { navigation: { background: '#000' } } });

		expect(group('navigation').hasAttribute('data-has-value')).toBe(true);
		expect(group('header').hasAttribute('data-has-value')).toBe(false);
		await userEvent.click(group('navigation'));
		expect(input('navigation.background')!.value).toBe('#000');
		expect(row('navigation.background').hasAttribute('data-has-value')).toBe(true);
	});

	test('the dark appearance shows the dark theme defaults', async () => {
		mountOverrides({ appearance: 'dark' });
		await userEvent.click(group('globals'));

		expect(input('background')!.placeholder).toBe('#0d1117');
	});

	test('a value that is not an object shows an empty block and is kept (CHK082)', () => {
		for (const value of ['oops', ['a'], 42]) {
			const wrapper = mountOverrides({ value });

			expect(wrapper.get('[data-theme-overrides]').element.children).toHaveLength(0);
			expect(wrapper.emitted('input')).toBeUndefined();
			wrapper.unmount();
		}
	});

	test('no serious axe issue with a group open', async () => {
		const wrapper = mountOverrides({ value: { foreground: '#111' } });
		await userEvent.click(group('navigation'));

		const { violations } = await axe.run(wrapper.element, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
		expect(
			violations
				.filter((v) => v.impact === 'serious' || v.impact === 'critical')
				.map((v) => `${v.id}: ${v.nodes.map((node) => node.html).join(' | ')}`),
		).toEqual([]);
	});
});
