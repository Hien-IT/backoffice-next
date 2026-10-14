// Keyboard of select-radio (roving focus needs real focus handling, happy-dom does not move it).
import { userEvent } from '@vitest/browser/context';
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import SelectRadio from './SelectRadio.vue';

test('Tab enters at the checked radio, arrows check, Tab reaches the "other" input', async () => {
	const choices = [
		{ text: 'Alpha', value: 'alpha' },
		{ text: 'Beta', value: 'beta' },
	];
	const wrapper = mount(SelectRadio, {
		props: { value: 'beta', choices, allowOther: true },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	const radios = wrapper.findAll('[role="radio"]');

	await userEvent.tab();
	expect(document.activeElement).toBe(radios[1]!.element);
	await userEvent.keyboard('{ArrowUp>}');
	await new Promise((resolve) => setTimeout(resolve, 10));
	await userEvent.keyboard('{/ArrowUp}');
	expect(wrapper.emitted('input')).toEqual([['alpha']]);

	await userEvent.tab();
	await userEvent.tab();
	await userEvent.keyboard('mine');
	expect(wrapper.emitted('input')?.at(-1)).toEqual(['mine']);
	wrapper.unmount();
});
