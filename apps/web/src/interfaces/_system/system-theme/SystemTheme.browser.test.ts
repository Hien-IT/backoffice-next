// Feature 015 (T071, FR-084, D-88, CHK024, CHK026, CHK042): system-theme in chromium (radio keyboard, inline CSS
// variables of the previews).
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { i18n } from '../../../lang/index.ts';
import '../../../styles/index.css';
import { useServerStore } from '../../../stores/server.ts';
import { useUserStore } from '../../../stores/user.ts';
import SystemTheme from './SystemTheme.vue';

enableAutoUnmount(afterEach);

function mountTheme(props: Record<string, unknown>) {
	return mount(SystemTheme, {
		props: { appearance: 'light', value: null, disabled: false, ...props },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

const radios = () => [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
// The radio icon is aria-hidden; its ligature text is not part of the name.
const label = (radio: HTMLElement) => radio.textContent!.replace(/radio_button_(un)?checked/, '').trim();
const labels = () => radios().map(label);
const checked = () => radios().filter((radio) => radio.getAttribute('aria-checked') === 'true');
const previewVar = (radio: HTMLElement, name: string) =>
	radio.querySelector<HTMLElement>('.theme-preview')!.style.getPropertyValue(name);

beforeEach(() => {
	setActivePinia(createPinia());
	useServerStore().info.project = { default_theme_light: 'Directus Minimal', default_theme_dark: null } as never;
});

describe('system-theme', () => {
	test('lists the light themes with Backoffice labels; choosing one stores the Directus id (D-88)', async () => {
		const wrapper = mountTheme({ value: 'Directus Default' });

		expect(labels()).toEqual(['Backoffice Default', 'Backoffice Minimal', 'Backoffice Color Match']);
		expect(checked().map(label)).toEqual(['Backoffice Default']);

		radios()[1]!.click();
		expect(wrapper.emitted('input')).toEqual([['Directus Minimal']]);
	});

	test('the dark appearance lists the dark theme only', () => {
		mountTheme({ appearance: 'dark' });

		expect(labels()).toEqual(['Backoffice Default']);
		expect(previewVar(radios()[0]!, '--theme--background')).toBe('#0d1117');
	});

	test('null without includeNull checks the first theme', () => {
		mountTheme({ value: null });

		expect(checked()).toEqual([radios()[0]]);
	});

	test('includeNull: "Default (Sync with Project)" first, previewed with the project default theme; it emits null', async () => {
		const wrapper = mountTheme({ value: 'Directus Color Match', includeNull: true });

		expect(labels()[0]).toBe('Default (Sync with Project)');
		expect(checked().map(label)).toEqual(['Backoffice Color Match']);
		// The project default is Directus Minimal: its navigation background, not the default theme's var().
		expect(previewVar(radios()[0]!, '--theme--navigation--background')).toBe('#FFFFFF');
		expect(previewVar(radios()[1]!, '--theme--navigation--background')).toBe('var(--theme--background-normal)');

		radios()[0]!.click();
		expect(wrapper.emitted('input')).toEqual([[null]]);
		await wrapper.setProps({ value: null });
		expect(checked()).toEqual([radios()[0]]);
	});

	test('an unknown id checks nothing and is not changed (CHK024)', () => {
		const wrapper = mountTheme({ value: 'Custom Extension Theme' });

		expect(checked()).toEqual([]);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('previews use the theme rules plus the saved overrides of the user (CHK026)', () => {
		useUserStore().currentUser = {
			id: 'me',
			appearance: null,
			theme_light_overrides: { primary: '#123456', navigation: { background: '#abcdef' } },
		} as never;
		mountTheme({ value: null });

		for (const radio of radios()) {
			expect(previewVar(radio, '--theme--primary')).toBe('#123456');
			expect(previewVar(radio, '--theme--navigation--background')).toBe('#abcdef');
		}

		expect(previewVar(radios()[0]!, '--theme--border-radius')).toBe('0.3125rem');
		// The Backoffice page itself does not get the variables (D-88).
		expect(document.documentElement.style.getPropertyValue('--theme--primary')).toBe('');
	});

	test('the note says the theme applies in the other app, linked to the group (CHK042)', () => {
		mountTheme({});
		const note = [...document.querySelectorAll('p')].find((p) => p.textContent?.includes('Backoffice look'))!;
		const group = document.querySelector('[role="radiogroup"]')!;

		expect(note.textContent).toBe('The theme is saved to your profile. The Backoffice look does not change.');
		expect(group.getAttribute('aria-describedby')).toContain(note.id);
	});

	test('keyboard: Tab enters at the checked card, arrows choose; no serious axe issue', async () => {
		const wrapper = mountTheme({ value: 'Directus Minimal' });

		await userEvent.tab();
		expect(document.activeElement).toBe(radios()[1]);
		await userEvent.keyboard('{ArrowRight>}');
		await new Promise((resolve) => setTimeout(resolve, 10));
		await userEvent.keyboard('{/ArrowRight}');
		expect(wrapper.emitted('input')).toEqual([['Directus Color Match']]);

		const { violations } = await axe.run(wrapper.element, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
		expect(
			violations
				.filter((v) => v.impact === 'serious' || v.impact === 'critical')
				.map((v) => `${v.id}: ${v.nodes.map((node) => node.html).join(' | ')}`),
		).toEqual([]);
	});

	test('disabled: the cards cannot be chosen', () => {
		const wrapper = mountTheme({ disabled: true });

		expect(radios().every((radio) => radio.disabled)).toBe(true);
		radios()[1]!.click();
		expect(wrapper.emitted('input')).toBeUndefined();
	});
});
