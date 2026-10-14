// Ported from directus/app/src/displays/formatted-value/formatted-value.test.ts
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import FormattedValue from './DisplayFormattedValue.vue';

type FormattedValueProps = InstanceType<typeof FormattedValue>['$props'];

const i18n = createI18n({
	legacy: false,
	missingWarn: false,
	locale: 'en-US',
	messages: { 'en-US': {} },
});

function mountFormattedValue(props: FormattedValueProps) {
	return mount(FormattedValue, {
		props,
		global: {
			plugins: [i18n],
			stubs: {
				BoIcon: true,
				ValueNull: true,
			},
		},
	});
}

function getDisplayText(props: FormattedValueProps) {
	const wrapper = mountFormattedValue(props);
	const value = wrapper.find('.value');

	if (!value.exists()) return null;

	return value.text();
}

describe('decimal formatting', () => {
	it('preserves decimal places with format enabled', () => {
		const text = getDisplayText({ type: 'decimal', value: '123.456', format: true });
		expect(text).toBe('123.456');
	});

	it('displays raw value without format', () => {
		const text = getDisplayText({ type: 'decimal', value: '3.14' });
		expect(text).toBe('3.14');
	});
});

describe('bigInteger formatting', () => {
	it('formats with locale separators', () => {
		const text = getDisplayText({ type: 'bigInteger', value: '1000000', format: true });
		expect(text).toBe('1,000,000');
	});

	it('handles values beyond Number.MAX_SAFE_INTEGER', () => {
		const text = getDisplayText({ type: 'bigInteger', value: '9007199254740993', format: true });
		expect(text).toBe('9,007,199,254,740,993');
	});

	it('leaves invalid bigint strings as-is', () => {
		const text = getDisplayText({ type: 'bigInteger', value: 'not-a-number', format: true });
		expect(text).toBe('not-a-number');
	});

	it('displays raw value without format', () => {
		const text = getDisplayText({ type: 'bigInteger', value: '12345' });
		expect(text).toBe('12345');
	});
});

describe('bigInteger conditional formatting', () => {
	it('matches eq on large values', () => {
		const wrapper = mountFormattedValue({
			type: 'bigInteger',
			value: '9007199254740993',
			conditionalFormatting: [
				{ operator: 'eq', value: '9007199254740993', color: 'red', background: '', text: '', icon: '' },
			],
		});

		expect(wrapper.find('.display-formatted').attributes('style')).toContain('red');
	});

	it('does not match different large values as eq', () => {
		const wrapper = mountFormattedValue({
			type: 'bigInteger',
			value: '9007199254740993',
			conditionalFormatting: [
				{ operator: 'eq', value: '9007199254740994', color: 'red', background: '', text: '', icon: '' },
			],
		});

		expect(wrapper.find('.display-formatted').attributes('style') ?? '').not.toContain('red');
	});

	it('compares gt correctly for large values', () => {
		const wrapper = mountFormattedValue({
			type: 'bigInteger',
			value: '9007199254740994',
			conditionalFormatting: [
				{ operator: 'gt', value: '9007199254740993', color: 'green', background: '', text: '', icon: '' },
			],
		});

		expect(wrapper.find('.display-formatted').attributes('style')).toContain('green');
	});

	it('returns false for invalid bigint in condition', () => {
		const wrapper = mountFormattedValue({
			type: 'bigInteger',
			value: 'abc',
			conditionalFormatting: [{ operator: 'eq', value: '123', color: 'red', background: '', text: '', icon: '' }],
		});

		expect(wrapper.find('.display-formatted').attributes('style') ?? '').not.toContain('red');
	});
});

describe('decimal conditional formatting', () => {
	it('matches eq on decimal values', () => {
		const wrapper = mountFormattedValue({
			type: 'decimal',
			value: '3.14',
			conditionalFormatting: [{ operator: 'eq', value: '3.14', color: 'blue', background: '', text: '', icon: '' }],
		});

		expect(wrapper.find('.display-formatted').attributes('style')).toContain('blue');
	});

	it('compares gt correctly for decimals', () => {
		const wrapper = mountFormattedValue({
			type: 'decimal',
			value: '1.5',
			conditionalFormatting: [{ operator: 'gt', value: '1.4', color: 'green', background: '', text: '', icon: '' }],
		});

		expect(wrapper.find('.display-formatted').attributes('style')).toContain('green');
	});

	it('does not match when decimal comparison fails', () => {
		const wrapper = mountFormattedValue({
			type: 'decimal',
			value: '1.5',
			conditionalFormatting: [{ operator: 'lt', value: '1.4', color: 'red', background: '', text: '', icon: '' }],
		});

		expect(wrapper.find('.display-formatted').attributes('style') ?? '').not.toContain('red');
	});
});

describe('integer conditional formatting', () => {
	it('matches eq on integer values', () => {
		const wrapper = mountFormattedValue({
			type: 'integer',
			value: '42',
			conditionalFormatting: [{ operator: 'eq', value: '42', color: 'blue', background: '', text: '', icon: '' }],
		});

		expect(wrapper.find('.display-formatted').attributes('style')).toContain('blue');
	});

	it('compares gt correctly for integers', () => {
		const wrapper = mountFormattedValue({
			type: 'integer',
			value: '10',
			conditionalFormatting: [{ operator: 'gt', value: '5', color: 'green', background: '', text: '', icon: '' }],
		});

		expect(wrapper.find('.display-formatted').attributes('style')).toContain('green');
	});

	it('does not match when integer comparison fails', () => {
		const wrapper = mountFormattedValue({
			type: 'integer',
			value: '3',
			conditionalFormatting: [{ operator: 'gt', value: '5', color: 'red', background: '', text: '', icon: '' }],
		});

		expect(wrapper.find('.display-formatted').attributes('style') ?? '').not.toContain('red');
	});
});

describe('string conditional formatting', () => {
	it('matches eq on string values', () => {
		const wrapper = mountFormattedValue({
			type: 'string',
			value: 'hello',
			conditionalFormatting: [{ operator: 'eq', value: 'hello', color: 'blue', background: '', text: '', icon: '' }],
		});

		expect(wrapper.find('.display-formatted').attributes('style')).toContain('blue');
	});

	it('does not match neq when values are equal', () => {
		const wrapper = mountFormattedValue({
			type: 'string',
			value: 'hello',
			conditionalFormatting: [{ operator: 'neq', value: 'hello', color: 'red', background: '', text: '', icon: '' }],
		});

		expect(wrapper.find('.display-formatted').attributes('style') ?? '').not.toContain('red');
	});

	it('matches contains operator', () => {
		const wrapper = mountFormattedValue({
			type: 'string',
			value: 'hello world',
			conditionalFormatting: [
				{ operator: 'contains', value: 'world', color: 'green', background: '', text: '', icon: '' },
			],
		});

		expect(wrapper.find('.display-formatted').attributes('style')).toContain('green');
	});

	it('matches starts_with operator', () => {
		const wrapper = mountFormattedValue({
			type: 'string',
			value: 'hello world',
			conditionalFormatting: [
				{ operator: 'starts_with', value: 'hello', color: 'green', background: '', text: '', icon: '' },
			],
		});

		expect(wrapper.find('.display-formatted').attributes('style')).toContain('green');
	});

	it('matches ends_with operator', () => {
		const wrapper = mountFormattedValue({
			type: 'string',
			value: 'hello world',
			conditionalFormatting: [
				{ operator: 'ends_with', value: 'world', color: 'green', background: '', text: '', icon: '' },
			],
		});

		expect(wrapper.find('.display-formatted').attributes('style')).toContain('green');
	});

	it('does not match on unknown operator', () => {
		const wrapper = mountFormattedValue({
			type: 'string',
			value: 'hello',
			conditionalFormatting: [
				// Backoffice: `as never` instead of `as any` (lint).
				{ operator: 'gt' as never, value: 'hello', color: 'red', background: '', text: '', icon: '' },
			],
		});

		expect(wrapper.find('.display-formatted').attributes('style') ?? '').not.toContain('red');
	});
});

describe('string/text formatting', () => {
	it('applies formatTitle with format enabled', () => {
		const text = getDisplayText({ type: 'string', value: 'hello_world', format: true });
		expect(text).toBe('Hello World');
	});

	it('displays raw value without format', () => {
		const text = getDisplayText({ type: 'string', value: 'hello_world' });
		expect(text).toBe('hello_world');
	});
});

describe('conditional text override', () => {
	it('displays custom text when condition matches', () => {
		const text = getDisplayText({
			type: 'integer',
			value: '1',
			conditionalFormatting: [{ operator: 'eq', value: '1', color: '', background: '', text: 'Active', icon: '' }],
		});

		expect(text).toBe('Active');
	});

	it('translates $t: prefixed text', () => {
		const i18nWithMessages = createI18n({
			legacy: false,
			missingWarn: false,
			locale: 'en-US',
			messages: { 'en-US': { status_active: 'Active' } },
		});

		const wrapper = mount(FormattedValue, {
			props: {
				type: 'integer',
				value: '1',
				conditionalFormatting: [
					{ operator: 'eq', value: '1', color: '', background: '', text: '$t:status_active', icon: '' },
				],
			},
			global: {
				plugins: [i18nWithMessages],
				stubs: { BoIcon: true, ValueNull: true },
			},
		});

		expect(wrapper.find('.value').text()).toBe('Active');
	});
});

describe('prefix and suffix', () => {
	it('applies prefix and suffix to decimal', () => {
		const text = getDisplayText({ type: 'decimal', value: '9.99', prefix: '$', suffix: ' USD' });
		expect(text).toBe('$9.99 USD');
	});

	it('applies prefix and suffix to bigInteger', () => {
		const text = getDisplayText({ type: 'bigInteger', value: '1000', prefix: '#' });
		expect(text).toBe('#1000');
	});
});

// Backoffice: every option key (spec FR-074, FR-076), the HTML stripping, the handler and the fixture fields.
describe('Backoffice: options', () => {
	const root = (props: FormattedValueProps) => mountFormattedValue(props).find('.display-formatted');

	it('option:formatted-value.format formats integers and floats with the locale', () => {
		expect(getDisplayText({ type: 'integer', value: 1234567, format: true })).toBe('1,234,567');
		expect(getDisplayText({ type: 'float', value: 1234.5, format: true })).toBe('1,234.5');
	});

	it('option:formatted-value.font sets the font family', () => {
		expect(root({ type: 'string', value: 'a' }).classes()).toContain('font-outfit');
		expect(root({ type: 'string', value: 'a', font: 'serif' }).classes()).toContain('font-[serif]');
		expect(root({ type: 'string', value: 'a', font: 'monospace' }).classes()).toContain('font-[monospace]');
	});

	it('option:formatted-value.bold and option:formatted-value.italic', () => {
		expect(root({ type: 'string', value: 'a', bold: true }).classes()).toContain('font-bold');
		expect(root({ type: 'string', value: 'a', italic: true }).classes()).toContain('italic');
		expect(root({ type: 'string', value: 'a' }).classes()).not.toContain('font-bold');
	});

	it('option:formatted-value.prefix and option:formatted-value.suffix', () => {
		expect(getDisplayText({ type: 'string', value: 'a', prefix: '<', suffix: '>' })).toBe('<a>');
	});

	it('option:formatted-value.color, option:formatted-value.background and option:formatted-value.border', () => {
		const style = root({ type: 'string', value: 'a', color: 'red', background: 'blue', border: true }).attributes(
			'style',
		);

		expect(style).toContain('color: red');
		expect(style).toContain('background-color: blue');
		expect(style).toContain('border-width: 2px');
		expect(root({ type: 'string', value: 'a' }).attributes('style')).toContain('border-width: 0');
	});

	it('option:formatted-value.icon shows the icon', () => {
		const wrapper = mountFormattedValue({ type: 'string', value: 'a', icon: 'star' });

		expect(wrapper.find('bo-icon-stub').attributes('name')).toBe('star');
		expect(mountFormattedValue({ type: 'string', value: 'a' }).find('bo-icon-stub').exists()).toBe(false);
	});

	it('option:formatted-value.masked hides the value', () => {
		expect(getDisplayText({ type: 'string', value: 'secret', masked: true })).toBe('**********');
	});

	it('option:formatted-value.conditionalFormatting: the last matching non-empty value wins', () => {
		const wrapper = mountFormattedValue({
			type: 'integer',
			value: 55,
			color: 'black',
			conditionalFormatting: [
				{ operator: 'gte', value: '50', color: 'green', background: 'white', text: 'High', icon: 'star' },
				{ operator: 'gt', value: '10', color: 'blue', background: '', text: '', icon: '' },
				{ operator: 'lt', value: '10', color: 'red', background: 'red', text: 'Low', icon: 'warning' },
			],
		});

		const style = wrapper.find('.display-formatted').attributes('style');
		expect(style).toContain('color: blue');
		expect(style).toContain('background-color: white');
		expect(wrapper.find('.value').text()).toBe('High');
		expect(wrapper.find('bo-icon-stub').attributes('name')).toBe('star');
	});

	it('the hidden translate prop translates $t: values', () => {
		const i18nWithMessages = createI18n({
			legacy: false,
			missingWarn: false,
			locale: 'en-US',
			messages: { 'en-US': { published: 'Published' } },
		});

		const wrapper = mount(FormattedValue, {
			props: { type: 'string', value: '$t:published', translate: true },
			global: { plugins: [i18nWithMessages], stubs: { BoIcon: true, ValueNull: true } },
		});

		expect(wrapper.find('.value').text()).toBe('Published');
		expect(getDisplayText({ type: 'string', value: '$t:published' })).toBe('$t:published');
	});

	it('strips HTML tags and decodes entities, arrays are joined', () => {
		expect(getDisplayText({ type: 'text', value: '<p>Hello <strong>world</strong> &copy;</p>' })).toBe(
			'Hello world ©',
		);
		expect(getDisplayText({ type: 'string', value: '<img src=x onerror=alert(1)>Hi' })).toBe('Hi');
		expect(getDisplayText({ type: 'string', value: ['a', '', 'b'] })).toBe('a, --, b');
	});

	it('an empty value shows ValueNull', () => {
		const wrapper = mountFormattedValue({ type: 'string', value: '' });

		expect(wrapper.find('value-null-stub').exists()).toBe(true);
	});
});

describe('Backoffice: handler', () => {
	it('strips HTML, decodes entities, applies format, prefix and suffix', async () => {
		const { default: config } = await import('./index.ts');

		expect(config.handler!('<b>hello_world</b> &amp;', { format: true, prefix: '[', suffix: ']' }, {})).toBe(
			'[Hello World &]',
		);
		expect(config.handler!(42, {}, {})).toBe('42');
	});
});

describe('Backoffice: fixture fields', () => {
	it('bo_std.input_string, input_masked, input_integer, input_float, input_decimal, rich_html', async () => {
		const { fieldsOf, itemOf } = await import('../../test-utils/fixtures.ts');
		const fields = fieldsOf('bo_std');
		const item = itemOf('bo_std', 1);

		const render = (name: string) => {
			const field = fields.find((f) => f.field === name)!;
			return mountFormattedValue({
				...(field.meta!.display_options as object),
				type: field.type,
				value: item[name],
			} as FormattedValueProps);
		};

		const string = render('input_string');
		expect(string.find('.value').text()).toBe('Alpha!');
		expect(string.find('.display-formatted').attributes('style')).toContain('background-color: #E35169');
		expect(string.find('bo-icon-stub').attributes('name')).toBe('warning');

		expect(render('input_masked').find('.value').text()).toBe('**********');
		expect(render('input_integer').find('.value').text()).toBe('High');
		expect(render('input_float').find('.value').text()).toBe('2.5');
		expect(render('input_decimal').find('.value').text()).toBe('$12.34');
		expect(render('rich_html').find('.value').text()).toBe('Hello world');
	});
});
