// Keyboard of select-icon: the virtual scroller needs layout (chromium) and the app CSS.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import SelectIcon from './SelectIcon.vue';

enableAutoUnmount(afterEach);

test('opens from the focused trigger with Enter, searches and picks an icon: emits its name', async () => {
	const wrapper = mount(SelectIcon, { props: { value: null }, global: { plugins: [i18n] }, attachTo: document.body });

	(wrapper.get('button[aria-haspopup="dialog"]').element as HTMLButtonElement).focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.querySelector('input[type="search"]')).not.toBeNull());
	const search = document.querySelector('input[type="search"]') as HTMLInputElement;
	search.value = 'rocket_launch';
	search.dispatchEvent(new Event('input'));
	await vi.waitFor(() => expect(document.querySelector('[data-icon-button="rocket_launch"]')).not.toBeNull());

	(document.querySelector('[data-icon-button="rocket_launch"]') as HTMLButtonElement).focus();
	await userEvent.keyboard('{Enter}');

	expect(wrapper.emitted('input')).toEqual([['rocket_launch']]);
});
