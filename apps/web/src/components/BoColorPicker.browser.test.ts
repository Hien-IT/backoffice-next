import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { i18n } from '../lang/index.ts';
import '../styles/index.css';
import BoColorPicker from './BoColorPicker.vue';

// The native color input (chromium) and the theme variables used for the low-contrast check.
enableAutoUnmount(afterEach);

async function openPicker(props: Record<string, unknown>) {
	const wrapper = mount(BoColorPicker, { props, global: { plugins: [i18n] }, attachTo: document.body });
	await wrapper.get('button.swatch').trigger('click');
	await flushPromises();
	return wrapper;
}

test('the browser picker button opens the native color input; its value keeps the alpha', async () => {
	const wrapper = await openPicker({ modelValue: '#FF000080', opacity: true });
	const native = document.querySelector<HTMLInputElement>('input[type="color"]')!;
	const click = vi.spyOn(native, 'click').mockImplementation(() => {});

	expect(native.value).toBe('#ff0000');
	document.querySelector<HTMLButtonElement>('button[aria-label="Browser picker"]')!.click();
	expect(click).toHaveBeenCalledOnce();

	native.value = '#00ff00';
	native.dispatchEvent(new Event('input'));

	expect(wrapper.emitted('update:modelValue')).toEqual([['#00FF0080']]);
});

test('low contrast follows the theme field background', async () => {
	const white = mount(BoColorPicker, { props: { modelValue: '#FFFFFF' }, global: { plugins: [i18n] } });
	const brand = mount(BoColorPicker, { props: { modelValue: '#6644FF' }, global: { plugins: [i18n] } });

	expect(white.get('button.swatch').classes()).toContain('ring-1');
	expect(brand.get('button.swatch').classes()).not.toContain('ring-1');
	expect((brand.get('button.swatch').element as HTMLElement).style.background).toContain('rgb(102, 68, 255)');
});

test('opening with the keyboard moves the focus into the popover (Reka auto focus, first control)', async () => {
	mount(BoColorPicker, { props: { modelValue: '#FF0000' }, global: { plugins: [i18n] }, attachTo: document.body });
	document.querySelector<HTMLElement>('button.swatch')!.focus();
	await userEvent.keyboard('{Enter}');

	await vi.waitFor(() =>
		expect(document.activeElement?.closest('[data-reka-popper-content-wrapper]')).not.toBeNull(),
	);
	expect(document.activeElement?.getAttribute('role')).toBe('combobox');
});

test('the channel rows fit the panel: sliders keep their width, number inputs stay narrow', async () => {
	await openPicker({ modelValue: '#2ECDA7' }); // raw-color-allowed: test value
	const panel = document.querySelector<HTMLElement>('[data-reka-popper-content-wrapper] > *')!;

	expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
	const sliders = panel.querySelectorAll('[data-slider-impl]');
	expect(sliders).toHaveLength(3);
	for (const slider of sliders) {
		expect(slider.getBoundingClientRect().width).toBeGreaterThan(100);
	}
	for (const input of panel.querySelectorAll<HTMLElement>('input[type="number"]')) {
		expect(input.getBoundingClientRect().width).toBe(64);
	}
});
