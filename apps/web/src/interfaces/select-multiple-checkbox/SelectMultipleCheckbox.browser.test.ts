// Keyboard of select-multiple-checkbox (real focus and Space on buttons need chromium).
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import SelectMultipleCheckbox from './SelectMultipleCheckbox.vue';

enableAutoUnmount(afterEach);

test('Tab moves between choices and Space checks: emits the array', async () => {
	const choices = [
		{ text: 'Alpha', value: 'alpha' },
		{ text: 'Beta', value: 'beta' },
	];
	const wrapper = mount(SelectMultipleCheckbox, {
		props: { value: ['alpha'], choices },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await userEvent.tab();
	await userEvent.tab();
	await userEvent.keyboard(' ');

	expect(wrapper.emitted('input')).toEqual([[['alpha', 'beta']]]);
});
