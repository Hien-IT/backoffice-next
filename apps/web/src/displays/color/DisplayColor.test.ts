// Ported from directus/app/src/displays/color/color.test.ts
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { cssVar } from '../../utils/css-var.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import DisplayColor from './DisplayColor.vue';

// Backoffice: cssVar lives in src/utils; real ValueNull instead of a stub.
vi.mock('../../utils/css-var.ts', () => ({
	cssVar: vi.fn(() => '#FFFFFF'),
}));

const global = { plugins: [i18n] };

afterEach(() => document.documentElement.classList.remove('dark'));

test('Mount component', () => {
	expect(DisplayColor).toBeTruthy();

	const wrapper = mount(DisplayColor, {
		props: {
			value: '#FF0000',
		},
		global,
	});

	expect(wrapper.find('.color-dot .dot').attributes('style')).toBe('background-color: #FF0000;');
	expect(wrapper.text()).toBe('');
});

describe('null value handling', () => {
	test('renders ValueNull when value is null and defaultColor is null', () => {
		const wrapper = mount(DisplayColor, { props: { value: null, defaultColor: null }, global });

		expect(wrapper.text()).toContain('--');
	});

	test('renders color dot when value is null but defaultColor is set', () => {
		const wrapper = mount(DisplayColor, { props: { value: null }, global });

		expect(wrapper.text()).not.toContain('--');
		expect(wrapper.find('.dot').exists()).toBe(true);
		expect(wrapper.find('.dot').attributes('style')).toBe('background-color: #B0BEC5;');
	});
});

describe('color dot rendering', () => {
	test('renders color dot for valid hex color', () => {
		const wrapper = mount(DisplayColor, { props: { value: '#FF0000' }, global });

		expect(wrapper.find('.dot').exists()).toBe(true);
	});

	test('option:color.defaultColor renders color dot with defaultColor when value is null', () => {
		const wrapper = mount(DisplayColor, { props: { value: null, defaultColor: '#00FF00' }, global });

		expect(wrapper.find('.dot').exists()).toBe(true);
		expect(wrapper.find('.dot').attributes('style')).toBe('background-color: #00FF00;');
	});
});

describe('border handling', () => {
	test('adds border class when color has low contrast with background', () => {
		const wrapper = mount(DisplayColor, { props: { value: '#FFFFFF' }, global });

		expect(wrapper.find('.dot').classes()).toContain('with-border');
	});

	test('does not add border class when color has high contrast with background', () => {
		const wrapper = mount(DisplayColor, { props: { value: '#000000' }, global });

		expect(wrapper.find('.dot').classes()).not.toContain('with-border');
	});

	test('does not add border when color is null', () => {
		const wrapper = mount(DisplayColor, { props: { value: null, defaultColor: null }, global });

		expect(wrapper.find('.dot').classes()).not.toContain('with-border');
	});

	test('Backoffice: compares with the dark page background in dark mode', () => {
		document.documentElement.classList.add('dark');
		mount(DisplayColor, { props: { value: '#000000' }, global });

		expect(cssVar).toHaveBeenLastCalledWith('--color-gray-900');
	});
});

describe('CSS variable colors', () => {
	test('renders color dot when value starts with var(--', () => {
		const wrapper = mount(DisplayColor, { props: { value: 'var(--theme--primary)' }, global });

		expect(wrapper.find('.dot').exists()).toBe(true);
		expect(wrapper.find('.dot').classes()).not.toContain('with-border');
	});

	test('accepts defaultColor with var(-- prefix', () => {
		const wrapper = mount(DisplayColor, { props: { value: null, defaultColor: 'var(--theme--primary)' }, global });

		expect(wrapper.find('.dot').exists()).toBe(true);
	});
});

describe('inline-flex container', () => {
	test('has color-dot class on root element', () => {
		const wrapper = mount(DisplayColor, { props: { value: '#FF0000' }, global });

		expect(wrapper.find('.color-dot').exists()).toBe(true);
	});
});

describe('Backoffice: fixture fields', () => {
	test('bo_std.select_color and select_color_default', () => {
		const fields = fieldsOf('bo_std');
		const item = itemOf('bo_std', 1);

		for (const name of ['select_color', 'select_color_default']) {
			const field = fields.find((f) => f.field === name)!;
			const wrapper = mount(DisplayColor, { props: { ...field.meta!.display_options, value: item[name] }, global });
			expect(wrapper.find('.dot').attributes('style')).toBe(`background-color: ${item[name]};`);
		}
	});
});
