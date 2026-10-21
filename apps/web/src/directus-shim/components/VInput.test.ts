// Spec 020 (T111, data-model §7 row 28): VInput keeps the v-input value rules (nullable, slug, dbSafe, number,
// integer, float, trim, step arrows), the key events, the slots and the attrs split (input / root class).
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import VInput from './VInput.vue';

enableAutoUnmount(afterEach);

const global = { plugins: [i18n] };

const emitted = (wrapper: ReturnType<typeof mount>) => wrapper.emitted('update:modelValue')?.map((args) => args[0]);

async function type(props: Record<string, unknown>, value: string) {
	const wrapper = mount(VInput, { props, global });
	await wrapper.get('input').setValue(value);
	return emitted(wrapper);
}

describe('VInput', () => {
	test('nullable: an empty input is null, unless nullable is false', async () => {
		expect(await type({ modelValue: 'a' }, '')).toEqual([null]);
		expect(await type({ modelValue: 'a', nullable: false }, '')).toEqual(['']);
	});

	test('slug, dbSafe and float normalise the text', async () => {
		expect(await type({ slug: true }, 'Hello World')).toEqual(['hello-world']);
		expect(await type({ slug: true, slugSeparator: '_' }, 'Hello ')).toEqual(['hello_']);
		expect(await type({ dbSafe: true }, 'Héllo wörld!')).toEqual(['Hello_world']);
		expect(await type({ float: true }, '1,5')).toEqual(['1.5']);
	});

	test('number: a Number, integer drops the point while typing, not re-emitted when unchanged', async () => {
		expect(await type({ type: 'number' }, '42')).toEqual([42]);
		expect(await type({ type: 'number', integer: true }, '2.7')).toEqual([27]);
		expect(await type({ type: 'number', modelValue: 3 }, '3')).toBeUndefined();
	});

	test('step arrows emit the next step, stop at max; nonEditable or hideArrows hide them', async () => {
		const wrapper = mount(VInput, { props: { type: 'number', modelValue: 4, step: 2, max: 6 }, global });

		await wrapper.get('[data-step-up]').trigger('click');
		expect(emitted(wrapper)).toEqual([6]);

		await wrapper.setProps({ modelValue: 6 });
		expect(wrapper.get('[data-step-up]').attributes('disabled')).toBeDefined();
		await wrapper.get('[data-step-down]').trigger('click');
		expect(emitted(wrapper)).toEqual([6, 4]);

		// Out of range: the inline warning shows.
		expect(wrapper.find('[data-inline-warning]').exists()).toBe(false);
		await wrapper.setProps({ modelValue: 8 });
		expect(wrapper.find('[data-inline-warning]').exists()).toBe(true);

		await wrapper.setProps({ nonEditable: true });
		expect(wrapper.find('[data-step-up]').exists()).toBe(false);
		expect(wrapper.find('[data-inline-warning]').exists()).toBe(false);
		await wrapper.setProps({ nonEditable: false, hideArrows: true });
		expect(wrapper.find('[data-step-up]').exists()).toBe(false);
	});

	test('trim on blur (null when only spaces and nullable)', async () => {
		const wrapper = mount(VInput, { props: { modelValue: '  a  ', trim: true }, global });
		await wrapper.get('input').trigger('blur');
		await wrapper.setProps({ modelValue: '   ' });
		await wrapper.get('input').trigger('blur');
		expect(emitted(wrapper)).toEqual(['a', null]);
	});

	test('keydown, keydown:space, keydown:enter; dbSafe and integer block characters', async () => {
		const wrapper = mount(VInput, { props: { dbSafe: true }, global });
		const input = wrapper.get('input');

		await input.trigger('keydown', { key: 'Enter' });
		await input.trigger('keydown', { key: ' ' });
		expect(wrapper.emitted('keydown:enter')).toHaveLength(1);
		expect(wrapper.emitted('keydown:space')).toHaveLength(1);
		expect(wrapper.emitted('keydown')).toHaveLength(2);

		const bang = new KeyboardEvent('keydown', { key: '!', cancelable: true });
		input.element.dispatchEvent(bang);
		expect(bang.defaultPrevented).toBe(true);
		// No leading digit.
		const digit = new KeyboardEvent('keydown', { key: '1', cancelable: true });
		input.element.dispatchEvent(digit);
		expect(digit.defaultPrevented).toBe(true);

		const integer = mount(VInput, { props: { integer: true }, global });
		const letter = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
		integer.get('input').element.dispatchEvent(letter);
		expect(letter.defaultPrevented).toBe(true);
	});

	test('attrs go to the input, class to the root; focus and click are emitted', async () => {
		const wrapper = mount(VInput, {
			props: { modelValue: 'x', clickable: true, small: true, fullWidth: false },
			attrs: { class: 'my-input', 'aria-label': 'Name', 'data-testid': 'name' },
			global,
		});
		const input = wrapper.get('input');

		expect(wrapper.classes()).toEqual(expect.arrayContaining(['my-input', 'inline-flex', 'cursor-pointer']));
		expect(input.attributes('aria-label')).toBe('Name');
		expect(input.attributes('data-testid')).toBe('name');
		expect(input.attributes('autocomplete')).toBe('off');
		expect(input.classes()).not.toContain('my-input');
		expect(wrapper.get('[data-input-frame]').classes()).toContain('h-9');

		await input.trigger('focus');
		await wrapper.trigger('click');
		expect(wrapper.emitted('focus')).toHaveLength(1);
		expect(wrapper.emitted('click')).toHaveLength(1);
	});

	test('prefix, suffix and the five slots with { value, disabled }; the input slot replaces the input', () => {
		const slot = (name: string) =>
			`<template #${name}="{ value, disabled }">${name}:{{ value }}:{{ disabled }}</template>`;
		const wrapper = mount(
			{
				components: { VInput },
				template: `<VInput model-value="v" disabled prefix="$" suffix="kg">${[
					'prepend-outer',
					'prepend',
					'append',
					'append-outer',
				]
					.map(slot)
					.join('')}</VInput>`,
			},
			{ global },
		);

		expect(wrapper.text()).toBe('prepend-outer:v:trueprepend:v:true$kgappend:v:trueappend-outer:v:true');
		expect(wrapper.get('input').attributes('disabled')).toBeDefined();
		expect(wrapper.get('[data-input-frame]').classes()).toContain('bg-gray-50');

		const custom = mount(VInput, { slots: { input: '<textarea data-custom />' }, global });
		expect(custom.find('input').exists()).toBe(false);
		expect(custom.find('[data-custom]').exists()).toBe(true);
	});

	test('nonEditable keeps a disabled input from being greyed; active forces the focus look', () => {
		const wrapper = mount(VInput, { props: { disabled: true, nonEditable: true, active: true }, global });
		expect(wrapper.get('[data-input-frame]').classes()).not.toContain('bg-gray-50');
		expect(wrapper.get('[data-input-frame]').classes()).not.toContain('ring-3');

		const active = mount(VInput, { props: { active: true }, global });
		expect(active.get('[data-input-frame]').classes()).toContain('ring-3');
	});
});
