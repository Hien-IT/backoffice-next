import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import ResizeHandle from './ResizeHandle.vue';

describe('ResizeHandle', () => {
	test('window splitter semantics', () => {
		const wrapper = mount(ResizeHandle, { props: { modelValue: 225, min: 198, max: 306, label: 'Navigation' } });

		expect(wrapper.attributes()).toMatchObject({
			role: 'separator',
			tabindex: '0',
			'aria-orientation': 'vertical',
			'aria-label': 'Navigation',
			'aria-valuenow': '225',
			'aria-valuemin': '198',
			'aria-valuemax': '306',
		});
	});

	test.each([
		['start', 'ArrowRight', 241],
		['start', 'ArrowLeft', 209],
		['end', 'ArrowLeft', 241],
		['end', 'ArrowRight', 209],
	] as const)('%s handle: %s changes the size by 16 px', async (location, key, size) => {
		const wrapper = mount(ResizeHandle, { props: { modelValue: 225, min: 198, max: 306, label: 'x', location } });

		await wrapper.trigger('keydown', { key });
		expect(wrapper.emitted('update:modelValue')).toEqual([[size]]);
	});

	test('clamps to min and max, ignores other keys', async () => {
		const wrapper = mount(ResizeHandle, { props: { modelValue: 300, min: 198, max: 306, label: 'x' } });

		await wrapper.trigger('keydown', { key: 'ArrowRight' });
		await wrapper.trigger('keydown', { key: 'Enter' });
		expect(wrapper.emitted('update:modelValue')).toEqual([[306]]);
	});

	test('pointer drag resizes from the start size', async () => {
		const wrapper = mount(ResizeHandle, { props: { modelValue: 225, min: 198, max: 306, label: 'x' } });
		const el = wrapper.element as HTMLElement;

		el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, pointerId: 1 }));
		el.dispatchEvent(new PointerEvent('pointermove', { clientX: 130, pointerId: 1 }));
		el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
		el.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, pointerId: 1 }));

		expect(wrapper.emitted('update:modelValue')).toEqual([[255]]);
	});
});
