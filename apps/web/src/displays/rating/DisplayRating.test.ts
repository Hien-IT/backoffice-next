// Ported from directus/app/src/displays/rating/rating.test.ts
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import DisplayRating from './DisplayRating.vue';

// Backoffice: real BoIcon instead of a v-icon stub (filled = FILL 1 style), BoTooltip instead of v-tooltip.
const icons = (wrapper: ReturnType<typeof mount>, selector: string) => wrapper.find(selector).findAll('span');
const filled = (el: { attributes: (name: string) => string | undefined }) =>
	(el.attributes('style') ?? '').includes(`'FILL' 1`);

test('Mount component', () => {
	expect(DisplayRating).toBeTruthy();

	const wrapper = mount(DisplayRating, {
		props: {
			value: 3,
		},
	});

	expect(wrapper.find('.rating.detailed').attributes('aria-label')).toBe('3 / 5');
	expect(wrapper.find('.active').attributes('style')).toBe('inline-size: 60%;');
	expect(icons(wrapper, '.active').every(filled)).toBe(true);
	expect(icons(wrapper, '.inactive').some(filled)).toBe(false);
});

describe('simple mode', () => {
	test('option:rating.simple renders simple rating with icon and value', () => {
		const wrapper = mount(DisplayRating, { props: { value: 4, simple: true } });

		expect(wrapper.find('.rating.simple').exists()).toBe(true);
		expect(wrapper.find('.material-symbols-rounded').exists()).toBe(true);
		expect(wrapper.text()).toContain('4');
	});

	test('renders star icon in simple mode', () => {
		const wrapper = mount(DisplayRating, { props: { value: 3, simple: true } });

		const icon = wrapper.find('.material-symbols-rounded');
		expect(icon.text()).toBe('star');
		expect(filled(icon)).toBe(true);
	});
});

describe('detailed mode', () => {
	test('renders detailed rating by default', () => {
		const wrapper = mount(DisplayRating, { props: { value: 3 } });

		expect(wrapper.find('.rating.detailed').exists()).toBe(true);
	});

	test('renders 5 stars by default', () => {
		const wrapper = mount(DisplayRating, { props: { value: 3 } });

		expect(icons(wrapper, '.active').length).toBe(5);
		expect(icons(wrapper, '.inactive').length).toBe(5);
	});

	test('has active and inactive star layers', () => {
		const wrapper = mount(DisplayRating, { props: { value: 3 } });

		expect(wrapper.find('.active').exists()).toBe(true);
		expect(wrapper.find('.inactive').exists()).toBe(true);
	});

	test('active stars are filled', () => {
		const wrapper = mount(DisplayRating, { props: { value: 3 } });

		expect(filled(icons(wrapper, '.active')[0]!)).toBe(true);
	});

	test('inactive stars are not filled', () => {
		const wrapper = mount(DisplayRating, { props: { value: 3 } });

		expect(filled(icons(wrapper, '.inactive')[0]!)).toBe(false);
	});
});

describe('rating percentage calculation', () => {
	test('calculates correct percentage for value 3 out of 5', () => {
		const wrapper = mount(DisplayRating, { props: { value: 3 } });

		expect(wrapper.find('.active').attributes('style')).toContain('60%');
	});

	test('calculates correct percentage for value 5 out of 5', () => {
		const wrapper = mount(DisplayRating, { props: { value: 5 } });

		expect(wrapper.find('.active').attributes('style')).toContain('100%');
	});

	test('calculates correct percentage for value 0', () => {
		const wrapper = mount(DisplayRating, { props: { value: 0 } });

		expect(wrapper.find('.active').attributes('style')).toContain('0%');
	});
});

describe('interfaceOptions', () => {
	test('respects custom maxValue from interfaceOptions', () => {
		const wrapper = mount(DisplayRating, {
			props: { value: 5, interfaceOptions: { minValue: 0, maxValue: 10, stepInterval: 1 } },
		});

		expect(icons(wrapper, '.active').length).toBe(10);
		expect(wrapper.find('.rating').attributes('aria-label')).toBe('5 / 10');
	});

	test('calculates percentage based on custom maxValue', () => {
		const wrapper = mount(DisplayRating, {
			props: { value: 5, interfaceOptions: { minValue: 0, maxValue: 10, stepInterval: 1 } },
		});

		expect(wrapper.find('.active').attributes('style')).toContain('50%');
	});

	test('defaults to 5 stars when interfaceOptions is null', () => {
		const wrapper = mount(DisplayRating, { props: { value: 3, interfaceOptions: null } });

		expect(icons(wrapper, '.active').length).toBe(5);
	});

	test('defaults to 5 stars when interfaceOptions is undefined', () => {
		const wrapper = mount(DisplayRating, { props: { value: 3 } });

		expect(icons(wrapper, '.active').length).toBe(5);
	});
});

describe('value types', () => {
	test('handles string value', () => {
		const wrapper = mount(DisplayRating, { props: { value: '3' } });

		expect(wrapper.find('.active').attributes('style')).toContain('60%');
	});

	test('handles null value', () => {
		const wrapper = mount(DisplayRating, { props: { value: null } });

		expect(wrapper.find('.active').attributes('style')).toContain('0%');
	});
});

describe('Backoffice: fixture fields', () => {
	test('bo_std.slider (detailed) and slider_float (simple) with the slider maxValue', () => {
		const fields = fieldsOf('bo_std');
		const item = itemOf('bo_std', 1);
		const render = (name: string) => {
			const field = fields.find((f) => f.field === name)!;
			return mount(DisplayRating, {
				props: { ...field.meta!.display_options, interfaceOptions: field.meta!.options as never, value: item[name] },
			});
		};

		const slider = render('slider');
		const max = Math.ceil((fields.find((f) => f.field === 'slider')!.meta!.options?.['maxValue'] as number) ?? 5);
		expect(icons(slider, '.active').length).toBe(max);
		expect(slider.find('.active').attributes('style')).toBe(`inline-size: ${(7 / max) * 100}%;`);

		expect(render('slider_float').find('.rating.simple').text()).toBe('star 0.4');
	});
});
