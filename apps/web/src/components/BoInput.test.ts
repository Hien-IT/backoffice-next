import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import BoInput from './BoInput.vue';

describe('BoInput', () => {
	test('label is linked to the input by for/id; attrs go to the input', () => {
		const wrapper = mount(BoInput, {
			props: { label: 'Email', type: 'email', autocomplete: 'username' },
			attrs: { name: 'email' },
		});
		const input = wrapper.get('input');

		expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'));
		expect(input.attributes('id')).toBeTruthy();
		expect(input.attributes('name')).toBe('email');
		expect(input.attributes('type')).toBe('email');
		expect(input.attributes('autocomplete')).toBe('username');
		expect(input.attributes('aria-invalid')).toBeUndefined();
		expect(input.attributes('aria-describedby')).toBeUndefined();
	});

	test('v-model: shows modelValue and emits update:modelValue', async () => {
		const wrapper = mount(BoInput, { props: { modelValue: 'a' } });

		expect(wrapper.get('input').element.value).toBe('a');
		await wrapper.get('input').setValue('ab');
		expect(wrapper.emitted('update:modelValue')).toEqual([['ab']]);
	});

	test('error sets aria-invalid and is linked with aria-describedby as an alert', () => {
		const wrapper = mount(BoInput, { props: { label: 'Password', error: 'Wrong password', id: 'pw' } });
		const input = wrapper.get('input');
		const error = wrapper.get('[role="alert"]');

		expect(input.attributes('id')).toBe('pw');
		expect(input.attributes('aria-invalid')).toBe('true');
		expect(input.attributes('aria-describedby')).toBe('pw-error');
		expect(error.attributes('id')).toBe('pw-error');
		expect(error.text()).toContain('Wrong password');
	});

	test('invalid without error, disabled, readonly, maxlength, inputmode', () => {
		const input = mount(BoInput, {
			props: { invalid: true, disabled: true, readonly: true, maxlength: 6, inputmode: 'numeric' },
		}).get('input');

		expect(input.attributes('aria-invalid')).toBe('true');
		expect(input.attributes('aria-describedby')).toBeUndefined();
		expect(input.attributes('disabled')).toBeDefined();
		expect(input.attributes('readonly')).toBeDefined();
		expect(input.attributes('maxlength')).toBe('6');
		expect(input.attributes('inputmode')).toBe('numeric');
	});

	test('autofocus focuses the input on mount', () => {
		const wrapper = mount(BoInput, { props: { autofocus: true }, attachTo: document.body });

		expect(document.activeElement).toBe(wrapper.get('input').element);
		wrapper.unmount();
	});
});
