import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoCheckboxGroup from './BoCheckboxGroup.vue';

const global = { plugins: [i18n] };
const items = Array.from({ length: 10 }, (_, i) => ({ text: `Item ${i + 1}`, value: `item${i + 1}` }));

describe('BoCheckboxGroup', () => {
	test('labelled group; each checkbox has its label; click toggles the value', async () => {
		const wrapper = mount(BoCheckboxGroup, {
			props: { items: items.slice(0, 3), label: 'Tags', modelValue: ['item1'] },
			global,
		});
		const group = wrapper.get('[role="group"]');
		const boxes = wrapper.findAll('[role="checkbox"]');

		expect(group.attributes('aria-labelledby')).toBe(wrapper.get('span').attributes('id'));
		expect(wrapper.findAll('label').map((l) => l.attributes('for'))).toEqual(boxes.map((b) => b.attributes('id')));
		expect(boxes.map((b) => b.attributes('aria-checked'))).toEqual(['true', 'false', 'false']);

		await boxes[1]!.trigger('click');
		await boxes[0]!.trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([[['item1', 'item2']], [[]]]);
	});

	test('itemsShown: "Show N more" expands and collapses the list', async () => {
		const wrapper = mount(BoCheckboxGroup, { props: { items, itemsShown: 8, modelValue: null }, global });
		const toggle = wrapper.get('button[aria-controls]');

		expect(wrapper.findAll('[role="checkbox"]')).toHaveLength(8);
		expect(toggle.text()).toContain('Show 2 more');
		expect(toggle.attributes('aria-expanded')).toBe('false');
		expect(toggle.attributes('aria-controls')).toBe(wrapper.get('[role="group"]').attributes('id'));

		await toggle.trigger('click');
		expect(wrapper.findAll('[role="checkbox"]')).toHaveLength(10);
		expect(toggle.text()).toContain('Show Less');
		expect(toggle.attributes('aria-expanded')).toBe('true');
	});

	test('allowOther: existing custom values get rows; add, edit and remove', async () => {
		const wrapper = mount(BoCheckboxGroup, {
			props: {
				items: items.slice(0, 2),
				modelValue: ['item1', 'custom'],
				allowOther: true,
				'onUpdate:modelValue': (modelValue: (string | number)[] | null) => wrapper.setProps({ modelValue }),
			},
			global,
			attachTo: document.body,
		});

		const input = wrapper.get('input[aria-label="Other..."]');
		expect((input.element as HTMLInputElement).value).toBe('custom');

		await input.setValue('custom2');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['item1', 'custom2']]);

		const add = wrapper.findAll('button').find((b) => b.text().includes('Other...'))!;
		await add.trigger('click');
		await flushPromises();
		const inputs = wrapper.findAll('input[aria-label="Other..."]');
		expect(inputs).toHaveLength(2);
		expect(document.activeElement).toBe(inputs[1]!.element);
		await inputs[1]!.trigger('blur');
		expect(wrapper.findAll('input[aria-label="Other..."]')).toHaveLength(1);

		await wrapper.get('button[aria-label="Remove Item"]').trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['item1']]);
		wrapper.unmount();
	});

	test('custom icons and data color; invalid, hint, disabled, empty', async () => {
		const wrapper = mount(BoCheckboxGroup, {
			props: {
				id: 'g',
				items: [...items.slice(0, 2), { text: 'Off', value: 'off', disabled: true }],
				modelValue: ['item2'],
				iconOn: 'star',
				iconOff: 'star_border',
				color: 'var(--color-orange-500)',
				columns: 2,
				error: 'Required',
				hint: 'Pick some',
			},
			global,
		});
		const boxes = wrapper.findAll('[role="checkbox"]');

		expect(boxes.map((b) => b.text())).toEqual(['star_border', 'star', 'star_border']);
		expect(boxes[1]!.attributes('style')).toContain('color: var(--color-orange-500)');
		expect(boxes[2]!.attributes('disabled')).toBeDefined();
		expect(boxes[0]!.attributes('aria-invalid')).toBe('true');
		expect(wrapper.get('[role="group"]').attributes('aria-describedby')).toBe('g-hint g-error');
		expect(wrapper.get('[role="group"]').classes()).toContain('sm:grid-cols-2');

		await wrapper.setProps({ items: [] });
		expect(wrapper.text()).toContain('No options available');
	});
});
