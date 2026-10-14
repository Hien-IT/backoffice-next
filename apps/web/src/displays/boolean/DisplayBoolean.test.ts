// Ported from directus/app/src/displays/boolean/boolean.test.ts
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import DisplayBoolean from './DisplayBoolean.vue';
import config from './index.ts';

// Backoffice: real BoIcon and ValueNull instead of stubs; the icon name is the BoIcon text.
const global = { plugins: [i18n] };

const icon = (wrapper: ReturnType<typeof mount>) => wrapper.find('.material-symbols-rounded');

test('Mount component', () => {
	expect(DisplayBoolean).toBeTruthy();

	const wrapper = mount(DisplayBoolean, {
		props: {
			value: true,
		},
		global,
	});

	expect(wrapper.find('.boolean').attributes('style')).toBe('color: var(--color-brand-500);');
	expect(icon(wrapper).text()).toBe('check');
	expect(wrapper.find('.boolean > span:not(.material-symbols-rounded)').exists()).toBe(false);
});

describe('null value handling', () => {
	test('renders ValueNull when value is null', () => {
		const wrapper = mount(DisplayBoolean, {
			props: {
				value: null,
			},
			global,
		});

		expect(wrapper.text()).toContain('--');
		expect(icon(wrapper).exists()).toBe(false);
	});
});

describe('icon rendering', () => {
	test('renders check icon for true value by default', () => {
		const wrapper = mount(DisplayBoolean, { props: { value: true }, global });

		expect(icon(wrapper).exists()).toBe(true);
		expect(icon(wrapper).text()).toBe('check');
	});

	test('renders close icon for false value by default', () => {
		const wrapper = mount(DisplayBoolean, { props: { value: false }, global });

		expect(icon(wrapper).exists()).toBe(true);
		expect(icon(wrapper).text()).toBe('close');
	});

	test('option:boolean.iconOn renders custom iconOn when value is true', () => {
		const wrapper = mount(DisplayBoolean, { props: { value: true, iconOn: 'thumb_up' }, global });

		expect(icon(wrapper).text()).toBe('thumb_up');
	});

	test('option:boolean.iconOff renders custom iconOff when value is false', () => {
		const wrapper = mount(DisplayBoolean, { props: { value: false, iconOff: 'thumb_down' }, global });

		expect(icon(wrapper).text()).toBe('thumb_down');
	});

	test('does not render icon when iconOn and iconOff are null', () => {
		const wrapper = mount(DisplayBoolean, { props: { value: true, iconOn: null, iconOff: null }, global });

		expect(icon(wrapper).exists()).toBe(false);
	});
});

describe('label rendering', () => {
	const label = (wrapper: ReturnType<typeof mount>) => wrapper.find('.boolean > span:not(.material-symbols-rounded)');

	test('does not render label by default', () => {
		const wrapper = mount(DisplayBoolean, { props: { value: true }, global });

		expect(label(wrapper).exists()).toBe(false);
	});

	test('option:boolean.labelOn renders labelOn when value is true and labels are provided', () => {
		const wrapper = mount(DisplayBoolean, { props: { value: true, labelOn: 'Yes', labelOff: 'No' }, global });

		expect(label(wrapper).exists()).toBe(true);
		expect(label(wrapper).text()).toBe('Yes');
	});

	test('option:boolean.labelOff renders labelOff when value is false and labels are provided', () => {
		const wrapper = mount(DisplayBoolean, { props: { value: false, labelOn: 'Yes', labelOff: 'No' }, global });

		expect(label(wrapper).text()).toBe('No');
	});

	test('does not render label when only labelOn is provided', () => {
		const wrapper = mount(DisplayBoolean, { props: { value: true, labelOn: 'Yes' }, global });

		expect(label(wrapper).exists()).toBe(false);
	});
});

describe('color styling', () => {
	test('option:boolean.colorOn applies colorOn when value is true', () => {
		const wrapper = mount(DisplayBoolean, {
			props: { value: true, colorOn: '#00FF00', colorOff: '#FF0000' },
			global,
		});

		const style = wrapper.find('.boolean').attributes('style');
		expect(style).toContain('color: #00FF00');
	});

	test('option:boolean.colorOff applies colorOff when value is false', () => {
		const wrapper = mount(DisplayBoolean, {
			props: { value: false, colorOn: '#00FF00', colorOff: '#FF0000' },
			global,
		});

		const style = wrapper.find('.boolean').attributes('style');
		expect(style).toContain('color: #FF0000');
	});

	test('uses default colors when not specified', () => {
		const wrapper = mount(DisplayBoolean, { props: { value: true }, global });

		const style = wrapper.find('.boolean').attributes('style');
		expect(style).toContain('var(--color-brand-500)');
		expect(
			mount(DisplayBoolean, { props: { value: false }, global })
				.find('.boolean')
				.attributes('style'),
		).toContain('var(--color-gray-500)');
	});
});

describe('Backoffice: fixture fields', () => {
	const field = (name: string) => fieldsOf('bo_std').find((f) => f.field === name)!;

	test('bo_std.boolean shows the configured label, icon and color', () => {
		const wrapper = mount(DisplayBoolean, {
			props: { ...field('boolean').meta!.display_options, value: itemOf('bo_std', 1)['boolean'] },
			global,
		});

		expect(wrapper.text()).toBe('checkYes');
		expect(wrapper.find('.boolean').attributes('style')).toContain('color: #2ECDA7');
		expect(
			mount(DisplayBoolean, { props: { ...field('boolean').meta!.display_options, value: false }, global }).text(),
		).toBe('closeNo');
	});

	test('bo_std.boolean_default (no options) uses the Directus defaults', () => {
		const wrapper = mount(DisplayBoolean, { props: { value: itemOf('bo_std', 1)['boolean_default'] }, global });

		expect(wrapper.text()).toBe('close');
		expect(config.id).toBe('boolean');
	});
});
