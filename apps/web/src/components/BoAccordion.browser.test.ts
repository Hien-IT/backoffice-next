import { userEvent } from '@vitest/browser/context';
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import BoAccordion from './BoAccordion.vue';
import BoDetail from './BoDetail.vue';

// Native button activation and Reka header navigation need real focus and key handling.
test('accordion: Enter toggles the focused header, ArrowDown and End move between headers', async () => {
	const items = [
		{ value: 'a', label: 'Alpha' },
		{ value: 'b', label: 'Beta' },
		{ value: 'c', label: 'Gamma' },
	];
	const wrapper = mount(BoAccordion, { props: { items, modelValue: [] }, attachTo: document.body });
	const buttons = wrapper.findAll('h3 > button');

	await userEvent.tab();
	expect(document.activeElement).toBe(buttons[0]!.element);
	await userEvent.keyboard('{Enter}');
	expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a']]);

	await userEvent.keyboard('{ArrowDown}');
	expect(document.activeElement).toBe(buttons[1]!.element);
	await userEvent.keyboard('{End}');
	expect(document.activeElement).toBe(buttons[2]!.element);
	wrapper.unmount();
});

test('detail: Space toggles the header', async () => {
	const wrapper = mount(BoDetail, { props: { title: 'Details' }, attachTo: document.body });

	await userEvent.tab();
	await userEvent.keyboard(' ');
	expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
	wrapper.unmount();
});
