import { userEvent } from '@vitest/browser/context';
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import '../styles/index.css';
import BoCheckboxTree from './BoCheckboxTree.vue';

// Roving focus and Reka's Right/Left handling need real focus.
test('keyboard: Down moves, Right opens and enters, Left goes back, Space checks', async () => {
	const choices = [
		{ text: 'Fruit', value: 'a', children: [{ text: 'Apple', value: 'a1' }] },
		{ text: 'Bread', value: 'b' },
	];
	const wrapper = mount(BoCheckboxTree, {
		props: { choices, modelValue: [] },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	const focused = () => document.activeElement?.querySelector('.truncate')?.textContent;

	await userEvent.tab();
	expect(focused()).toBe('Fruit');
	await userEvent.keyboard('{ArrowDown}');
	expect(focused()).toBe('Bread');
	await userEvent.keyboard('{ArrowUp}{ArrowRight}');
	expect(document.activeElement?.getAttribute('aria-expanded')).toBe('true');
	await userEvent.keyboard('{ArrowRight}');
	expect(focused()).toBe('Apple');
	await userEvent.keyboard(' ');
	expect(wrapper.emitted('update:modelValue')).toEqual([[['a1', 'a']]]);
	await userEvent.keyboard('{ArrowLeft}');
	expect(focused()).toBe('Fruit');
	wrapper.unmount();
});

// T093 (axe color-contrast): `bg-transparent` on the box won over the checked `bg-brand-500`, hiding the white check.
test('a checked box has the brand background behind its white check', () => {
	const wrapper = mount(BoCheckboxTree, {
		props: { choices: [{ text: 'Bread', value: 'b' }], modelValue: ['b'] },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	const box = wrapper.get('.bg-brand-500').element;

	expect(getComputedStyle(box).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
	wrapper.unmount();
});
