import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import InterfaceInput from './InterfaceInput.vue';

// With the app CSS: the icon font rule must not beat `group-focus-within/input:hidden` (Directus input.vue swaps the
// right icon for the character counter while the field has focus and 20% or less is left).
enableAutoUnmount(afterEach);

test('the right icon gives way to the character counter on focus', async () => {
	const wrapper = mount(InterfaceInput, {
		props: { value: '123456789', length: 10, iconRight: 'edit' },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	const icon = wrapper.get('[data-icon-right]').element;

	expect(getComputedStyle(icon).display).not.toBe('none');
	wrapper.get('input').element.focus();
	await vi.waitFor(() => expect(getComputedStyle(icon).display).toBe('none'));
});
