// Keyboard of the select-dropdown search row (more than 10 choices): needs real focus handling (chromium).
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import SelectDropdown from './SelectDropdown.vue';

enableAutoUnmount(afterEach);

test('the search input gets the focus on open, typing filters and the arrows reach the list', async () => {
	const choices = Array.from({ length: 12 }, (_, index) => ({ text: `Item ${index}`, value: `v${index}` }));
	const wrapper = mount(SelectDropdown, { props: { value: 'v2', choices }, global: { plugins: [i18n] }, attachTo: document.body });

	(wrapper.get('button').element as HTMLButtonElement).focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('type')).toBe('search'));

	await userEvent.keyboard('item 11');
	await vi.waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(1));
	expect((document.activeElement as HTMLInputElement).value).toBe('item 11');

	await userEvent.keyboard('{ArrowDown}');
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('option'));
	await userEvent.keyboard('{Enter}');

	expect(wrapper.emitted('input')).toEqual([['v11']]);
});
