import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import BoRadio from './BoRadio.vue';

const items = [
	{ text: 'Draft', value: 'draft' },
	{ text: 'Published', value: 'published' },
	{ text: 'Archived', value: 'archived', disabled: true },
];

afterEach(() => {
	document.body.innerHTML = '';
});

describe('BoRadio', () => {
	test('group is labelled; each radio has its label; click selects', async () => {
		const wrapper = mount(BoRadio, { props: { items, label: 'Status', modelValue: 'draft' }, attachTo: document.body });
		const group = wrapper.get('[role="radiogroup"]');
		const radios = wrapper.findAll('[role="radio"]');

		expect(group.attributes('aria-labelledby')).toBe(wrapper.get('span').attributes('id'));
		expect(wrapper.findAll('label').map((l) => l.attributes('for'))).toEqual(radios.map((r) => r.attributes('id')));
		expect(radios[0]!.attributes('aria-checked')).toBe('true');
		expect(radios[2]!.attributes('disabled')).toBeDefined();

		await radios[1]!.trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([['published']]);
		wrapper.unmount();
	});

	test('custom icons, data color on the checked item, grid columns, invalid and hint', () => {
		const wrapper = mount(BoRadio, {
			props: {
				id: 'r',
				items,
				modelValue: 'published',
				iconOn: 'star',
				iconOff: 'star_border',
				color: 'var(--color-orange-500)',
				columns: 3,
				hint: 'Pick one',
				error: 'Required',
				required: true,
			},
		});
		const group = wrapper.get('[role="radiogroup"]');
		const radios = wrapper.findAll('[role="radio"]');

		expect(radios.map((r) => r.text())).toEqual(['star_border', 'star', 'star_border']);
		expect(radios[1]!.attributes('style')).toContain('color: var(--color-orange-500)');
		expect(radios[0]!.attributes('style')).toBeUndefined();
		expect(group.classes()).toContain('sm:grid-cols-3');
		expect(group.attributes('aria-describedby')).toBe('r-hint r-error');
		expect(group.attributes('aria-invalid')).toBe('true');
		expect(group.attributes('aria-required')).toBe('true');
	});
});
