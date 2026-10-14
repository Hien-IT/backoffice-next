import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import { i18n } from '../lang/index.ts';
import '../styles/index.css';
import BoIconPicker from './BoIconPicker.vue';

// The virtual scroller needs layout (chromium) and the app CSS (its fixed height): rows render from measured sizes.
enableAutoUnmount(afterEach);

async function openPicker(props: Record<string, unknown> = {}) {
	const wrapper = mount(BoIconPicker, {
		props: { modelValue: null, ...props },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await wrapper.get('button[aria-haspopup="dialog"]').trigger('click');
	await vi.waitFor(() => expect(document.querySelector('[data-icon-button]')).not.toBeNull());

	return wrapper;
}

const search = () => document.querySelector<HTMLInputElement>('input[type="search"]')!;
const iconButtons = () => [...document.querySelectorAll<HTMLButtonElement>('[data-icon-button]')];

async function type(text: string) {
	search().value = text;
	search().dispatchEvent(new Event('input'));
	await flushPromises();
	await nextTick();
}

describe('BoIconPicker', () => {
	test('lists the Directus groups with several icons per row and selects an icon', async () => {
		const wrapper = await openPicker();

		expect(document.body.textContent).toContain('Action');
		const firstRow = iconButtons().filter((button) => button.parentElement === iconButtons()[0]!.parentElement);
		expect(firstRow.length).toBeGreaterThan(4);

		iconButtons()[0]!.click();
		await flushPromises();

		expect(wrapper.emitted('update:modelValue')).toEqual([['abc']]);
		await vi.waitFor(() => expect(search()).toBeNull());
	});

	test('search filters every group and finds the Social brand icons drawn as SVG', async () => {
		await openPicker();
		await type('docker');

		await vi.waitFor(() => expect(iconButtons().map((button) => button.dataset['iconButton'])).toEqual(['docker']));
		expect(document.body.textContent).toContain('Social');
		await vi.waitFor(() => expect(iconButtons()[0]!.querySelector('svg')).not.toBeNull());
	});

	test('the selected icon is pressed', async () => {
		await openPicker({ modelValue: 'abc' });

		expect(document.querySelector('[data-icon-button="abc"]')!.getAttribute('aria-pressed')).toBe('true');
		expect(document.querySelector('[data-icon-button="accessibility"]')!.getAttribute('aria-pressed')).toBe('false');
	});

	test('one Tab stop, arrows move between icons and rows, Enter selects', async () => {
		const wrapper = await openPicker();

		const stops = iconButtons().filter((button) => button.tabIndex === 0);
		expect(stops).toHaveLength(1);

		const first = stops[0]!;
		first.focus();
		first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		await nextTick();
		await nextTick();

		expect(document.activeElement?.getAttribute('data-icon-button')).toBe('accessibility');
		expect(first.tabIndex).toBe(-1);

		(document.activeElement as HTMLElement).dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
		);
		await nextTick();
		await nextTick();

		const below = document.activeElement as HTMLElement;
		expect(below.getAttribute('data-icon-button')).not.toBe('accessibility');
		expect(below.parentElement).not.toBe(first.parentElement);

		below.click();
		expect(wrapper.emitted('update:modelValue')).toEqual([[below.getAttribute('data-icon-button')]]);
	});

	test('opening with the keyboard moves the focus into the popover, on the search input (Reka auto focus)', async () => {
		mount(BoIconPicker, { props: { modelValue: null }, global: { plugins: [i18n] }, attachTo: document.body });
		document.querySelector<HTMLElement>('button[aria-haspopup="dialog"]')!.focus();
		await userEvent.keyboard('{Enter}');

		await vi.waitFor(() => expect(document.activeElement).toBe(search()));
	});
});
