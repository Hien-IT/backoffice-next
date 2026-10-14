import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import BoDivider from './BoDivider.vue';

describe('BoDivider', () => {
	test('without a title it is a decorative line', () => {
		const wrapper = mount(BoDivider);

		expect(wrapper.find('h3').exists()).toBe(false);
		expect(wrapper.find('[role="separator"]').exists()).toBe(false);
		expect(wrapper.get('[role="none"]').classes()).toContain('w-full');
	});

	test('inline title: icon, h3 and the line on one row', () => {
		const wrapper = mount(BoDivider, { props: { title: 'Section', icon: 'title' } });

		expect(wrapper.classes()).toContain('flex');
		expect(wrapper.get('h3').text()).toBe('Section');
		expect(wrapper.text()).toContain('title');
		expect(wrapper.get('[role="separator"]').classes()).toContain('flex-1');
	});

	test('title above the line when inlineTitle is false', () => {
		const wrapper = mount(BoDivider, { props: { title: 'Section', inlineTitle: false } });

		expect(wrapper.classes()).not.toContain('flex');
		expect(wrapper.get('[role="separator"]').classes()).toEqual(expect.arrayContaining(['mt-2', 'w-full']));
	});

	test('a data color is applied with style, else theme classes', () => {
		const colored = mount(BoDivider, { props: { title: 'Section', color: 'rgb(102, 68, 255)' } }); // raw-color-allowed: test data color
		const label = colored.get('h3').element.parentElement!;

		expect(label.getAttribute('style')).toContain('color: rgb(102, 68, 255)'); // raw-color-allowed: test data color
		expect(label.className).not.toContain('text-gray-800');

		const plain = mount(BoDivider, { props: { title: 'Section' } });
		expect(plain.get('h3').element.parentElement!.className).toContain('text-gray-800');
	});

	test('the default slot replaces the title; vertical renders a vertical line', () => {
		expect(
			mount(BoDivider, { slots: { default: 'Slot title' } })
				.get('h3')
				.text(),
		).toBe('Slot title');

		const vertical = mount(BoDivider, { props: { vertical: true, title: 'Ignored' } });
		expect(vertical.attributes('aria-orientation') ?? vertical.attributes('data-orientation')).toBe('vertical');
		expect(vertical.find('h3').exists()).toBe(false);
	});
});
