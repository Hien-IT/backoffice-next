import { userEvent } from '@vitest/browser/context';
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import BoRadio from './BoRadio.vue';

// Roving focus needs real focus handling (happy-dom does not move it).
test('Tab enters at the checked radio, arrows move and check', async () => {
	const items = [
		{ text: 'Draft', value: 'draft' },
		{ text: 'Published', value: 'published' },
	];
	const wrapper = mount(BoRadio, { props: { items, modelValue: 'published' }, attachTo: document.body });
	const radios = wrapper.findAll('[role="radio"]');

	await userEvent.tab();
	expect(document.activeElement).toBe(radios[1]!.element);
	// Held key: Reka checks the focused radio in a timeout while an arrow key is down.
	await userEvent.keyboard('{ArrowUp>}');
	await new Promise((resolve) => setTimeout(resolve, 10));
	await userEvent.keyboard('{/ArrowUp}');
	expect(document.activeElement).toBe(radios[0]!.element);
	expect(wrapper.emitted('update:modelValue')).toEqual([['draft']]);
	wrapper.unmount();
});
