import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import BoSlider from './BoSlider.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

async function key(el: Element, key: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	await flushPromises();
}

describe('BoSlider', () => {
	test('thumb is labelled, has the value and bounds; arrows, Home and End change it', async () => {
		const wrapper = mount(BoSlider, {
			props: { label: 'Volume', modelValue: 4, min: 0, max: 10, step: 2 },
			attachTo: document.body,
		});
		await flushPromises();
		const thumb = wrapper.get('[role="slider"]');

		expect(thumb.attributes('aria-labelledby')).toBe(wrapper.get('span').attributes('id'));
		expect(thumb.attributes('aria-valuenow')).toBe('4');
		expect(thumb.attributes('aria-valuetext')).toBe('4');
		expect(thumb.attributes('aria-valuemin')).toBe('0');
		expect(thumb.attributes('aria-valuemax')).toBe('10');

		await key(thumb.element, 'ArrowRight');
		await key(thumb.element, 'End');
		await key(thumb.element, 'Home');
		expect(wrapper.emitted('update:modelValue')).toEqual([[6], [10], [0]]);
		wrapper.unmount();
	});

	test('value bubble: hidden until hover/focus unless alwaysShowValue', async () => {
		const wrapper = mount(BoSlider, { props: { modelValue: 30 } });
		const bubble = wrapper.get('[role="slider"] span[aria-hidden="true"]');

		expect(bubble.text()).toBe('30');
		expect(bubble.classes()).toContain('hidden');
		await wrapper.setProps({ alwaysShowValue: true });
		expect(bubble.classes()).not.toContain('hidden');
	});

	test('ticks only up to 20 steps; null sits on the middle step without a value', async () => {
		const wrapper = mount(BoSlider, { props: { modelValue: null, min: 0, max: 10, step: 3 } });
		await flushPromises();

		expect(wrapper.findAll('.w-px')).toHaveLength(4);
		expect(wrapper.get('[role="slider"]').attributes('aria-valuenow')).toBe('6');
		expect(wrapper.get('[role="slider"]').attributes('aria-valuetext')).toBeUndefined();
		expect(wrapper.text()).not.toContain('6');

		await wrapper.setProps({ max: 100, step: 1 });
		expect(wrapper.findAll('.w-px')).toHaveLength(0);
	});

	test('invalid, hint, error and disabled', () => {
		const wrapper = mount(BoSlider, {
			props: { id: 's', modelValue: 1, hint: 'Pick', error: 'Too low', disabled: true },
		});
		const thumb = wrapper.get('[role="slider"]');

		expect(thumb.attributes('aria-describedby')).toBe('s-hint s-error');
		expect(thumb.attributes('aria-invalid')).toBe('true');
		expect(thumb.classes()).toContain('border-error-600');
		expect(thumb.attributes('data-disabled')).toBeDefined();
	});
});

describe('BoSlider form linking', () => {
	test('id, aria-labelledby and aria-describedby land on the thumb', async () => {
		const wrapper = mount(BoSlider, {
			props: { modelValue: 3, id: 'f-input', ariaLabelledby: 'f-label', ariaDescribedby: 'f-note', invalid: true },
		});
		await flushPromises();
		const thumb = wrapper.get('[role="slider"]');

		expect(thumb.attributes('id')).toBe('f-input');
		expect(thumb.attributes('aria-labelledby')).toBe('f-label');
		expect(thumb.attributes('aria-describedby')).toBe('f-note');
		expect(thumb.attributes('aria-invalid')).toBe('true');
	});
});
