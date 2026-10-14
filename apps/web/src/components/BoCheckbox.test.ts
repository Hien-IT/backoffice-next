// Ported from directus/app/src/components/v-checkbox.test.ts
// Backoffice: the boolean cases of the Directus test on the Reka checkbox, plus label, attributes and invalid.
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import BoCheckbox from './BoCheckbox.vue';

function button(wrapper: ReturnType<typeof mount>) {
	return wrapper.get('button[role="checkbox"]');
}

describe('BoCheckbox', () => {
	test('shows the checked, unchecked and indeterminate states', async () => {
		const wrapper = mount(BoCheckbox, { props: { modelValue: true } });
		expect(button(wrapper).attributes('aria-checked')).toBe('true');

		await wrapper.setProps({ modelValue: false });
		expect(button(wrapper).attributes('aria-checked')).toBe('false');

		await wrapper.setProps({ modelValue: null });
		expect(button(wrapper).attributes('aria-checked')).toBe('mixed');

		await wrapper.setProps({ modelValue: true, indeterminate: true });
		expect(button(wrapper).attributes('aria-checked')).toBe('mixed');
	});

	test('emits the toggled value and clears indeterminate', async () => {
		const wrapper = mount(BoCheckbox, { props: { modelValue: false } });

		await button(wrapper).trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);

		const mixed = mount(BoCheckbox, { props: { modelValue: false, indeterminate: true } });
		await button(mixed).trigger('click');
		expect(mixed.emitted('update:indeterminate')).toEqual([[false]]);
		expect(mixed.emitted('update:modelValue')).toEqual([[true]]);
	});

	test('does not toggle when disabled', async () => {
		const wrapper = mount(BoCheckbox, { props: { modelValue: false, disabled: true } });

		expect(button(wrapper).attributes('disabled')).toBeDefined();
		await button(wrapper).trigger('click');
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	test('links the label (prop or slot) and passes attributes to the checkbox', () => {
		const withProp = mount(BoCheckbox, { props: { modelValue: true, label: 'Active', id: 'cb' } });
		expect(withProp.get('label').attributes('for')).toBe('cb');
		expect(withProp.get('label').text()).toBe('Active');
		expect(button(withProp).attributes('id')).toBe('cb');

		const withSlot = mount(BoCheckbox, { props: { modelValue: true }, slots: { default: 'Slot label' } });
		expect(withSlot.get('label').attributes('for')).toBe(button(withSlot).attributes('id'));

		const bare = mount(BoCheckbox, { props: { modelValue: true }, attrs: { 'aria-label': 'Select Item' } });
		expect(bare.find('label').exists()).toBe(false);
		expect(button(bare).attributes('aria-label')).toBe('Select Item');
	});

	test('marks an invalid checkbox', () => {
		const wrapper = mount(BoCheckbox, { props: { modelValue: false, invalid: true } });
		expect(button(wrapper).attributes('aria-invalid')).toBe('true');
		expect(button(wrapper).classes()).toContain('border-error-600');
	});
});
