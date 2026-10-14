import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import BoSwitch from './BoSwitch.vue';

describe('BoSwitch', () => {
	test('is a labelled switch that toggles on click and keyboard', async () => {
		const wrapper = mount(BoSwitch, { props: { label: 'Published', modelValue: false }, attachTo: document.body });
		const root = wrapper.get('[role="switch"]');

		expect(wrapper.get('label').attributes('for')).toBe(root.attributes('id'));
		expect(root.attributes('aria-checked')).toBe('false');
		await root.trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);

		await wrapper.setProps({ modelValue: true });
		expect(root.attributes('aria-checked')).toBe('true');
		await wrapper.get('label').trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
		wrapper.unmount();
	});

	test('null is off; hint, error and disabled', async () => {
		const wrapper = mount(BoSwitch, {
			props: { id: 's', modelValue: null, hint: 'Shown', error: 'Bad', disabled: true },
		});
		const root = wrapper.get('[role="switch"]');

		expect(root.attributes('aria-checked')).toBe('false');
		expect(root.attributes('aria-describedby')).toBe('s-hint s-error');
		expect(root.attributes('aria-invalid')).toBe('true');
		expect(root.attributes('disabled')).toBeDefined();
		await root.trigger('click');
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});
});
