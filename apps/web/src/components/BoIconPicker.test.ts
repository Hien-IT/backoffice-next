// Ported from directus/app/src/interfaces/select-icon/select-icon.test.ts
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoIconPicker from './BoIconPicker.vue';

enableAutoUnmount(afterEach);

const global = { plugins: [i18n] };

function mountPicker(props: Record<string, unknown> = {}) {
	return mount(BoIconPicker, { props: { modelValue: null, ...props }, global, attachTo: document.body });
}

describe('Interface', () => {
	it('should mount', () => {
		const wrapper = mountPicker();

		expect(wrapper.exists()).toBe(true);
	});

	it('should render icon when null', () => {
		const wrapper = mountPicker();

		expect(wrapper.get('.item-actions span').text()).toBe('expand_more');
		expect(wrapper.text()).toContain('Search for icon...');
	});

	it('should render remove button when value is set', () => {
		const wrapper = mountPicker({ modelValue: 'launch' });

		expect(wrapper.get('.item-actions button').attributes('aria-label')).toBe('Clear Value');
		// Backoffice: the trigger shows the icon and its formatted name.
		expect(wrapper.get('button[aria-haspopup="dialog"]').text()).toContain('Launch');
	});

	it('should render action buttons disabled when disabled is true', () => {
		const wrapper = mountPicker({ modelValue: 'launch', disabled: true });

		expect(wrapper.get('.item-actions button').attributes('disabled')).toBe('');
		expect(wrapper.get('button[aria-haspopup="dialog"]').attributes('disabled')).toBe('');
	});

	it('should hide action buttons when nonEditable is true', () => {
		const wrapper = mountPicker({ modelValue: 'launch', nonEditable: true, disabled: true });

		expect(wrapper.find('.item-actions button').exists()).toBe(false);
	});
});

describe('BoIconPicker', () => {
	it('clears the value', async () => {
		const wrapper = mountPicker({ modelValue: 'launch' });

		await wrapper.get('.item-actions button').trigger('click');

		expect(wrapper.emitted('update:modelValue')).toEqual([[null]]);
	});

	it('shows the empty state when the search matches nothing', async () => {
		const wrapper = mountPicker();
		await wrapper.get('button[aria-haspopup="dialog"]').trigger('click');
		await flushPromises();

		const search = document.body.querySelector<HTMLInputElement>('input[type="search"]')!;
		expect(search.labels?.[0]?.textContent).toBe('Search');

		search.value = 'no-such-icon-anywhere';
		search.dispatchEvent(new Event('input'));
		await flushPromises();

		expect(document.body.textContent).toContain('No Results');
	});
});

describe('BoIconPicker form linking', () => {
	it('keeps the id on the trigger and names it by the label and the value', () => {
		const wrapper = mountPicker({
			modelValue: 'home',
			id: 'f-input',
			ariaLabelledby: 'f-label',
			ariaDescribedby: 'f-error',
			invalid: true,
		});
		const trigger = wrapper.get('#f-input');

		expect(trigger.element.tagName).toBe('BUTTON');
		expect(trigger.attributes('aria-haspopup')).toBe('dialog');
		expect(trigger.attributes('aria-labelledby')).toBe('f-label f-input-value');
		expect(wrapper.get('#f-input-value').text()).toBe('Home');
		expect(trigger.attributes('aria-describedby')).toBe('f-error');
		expect(trigger.attributes('aria-invalid')).toBe('true');
		expect(trigger.classes()).toContain('border-error-600');
	});
});
