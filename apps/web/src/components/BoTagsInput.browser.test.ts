import { userEvent } from '@vitest/browser/context';
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoTagsInput from './BoTagsInput.vue';

// Reka reads the caret position, which happy-dom does not track.
test('Backspace in the empty input selects the last tag, a second one removes it', async () => {
	const wrapper = mount(BoTagsInput, {
		props: { modelValue: ['a', 'b'] },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await userEvent.click(wrapper.get('input').element);
	await userEvent.keyboard('{Backspace}');
	expect(wrapper.findAll('[data-state="active"]')[0]?.text()).toContain('b');
	await userEvent.keyboard('{Backspace}');
	expect(wrapper.emitted('update:modelValue')).toEqual([[['a']]]);
	wrapper.unmount();
});
