// Ported from directus/app/src/interfaces/select-radio/select-radio.test.ts
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, test } from 'vitest';
import { computed } from 'vue';
import BoRadio from '../../components/BoRadio.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import { translate } from '../../utils/translate-object-values.ts';
import config from './index.ts';
import SelectRadio from './SelectRadio.vue';

// Backoffice: mounted with our BoRadio (no stubs); Directus classes become roles and data attributes.
const global = { plugins: [i18n] };

afterEach(() => {
	document.body.innerHTML = '';
});

function mountRadio(props: Record<string, unknown>, provide: Record<symbol, unknown> = {}) {
	return mount(SelectRadio, { props: props as never, global: { ...global, provide }, attachTo: document.body });
}

describe('Interface', () => {
	const choices = [
		{ value: '1', text: 'Item 1' },
		{ value: '2', text: 'Item 2' },
		{ value: '3', text: 'Item 3' },
		{ value: '4', text: 'Item 4' },
	];

	it('should mount', () => {
		const wrapper = mount(SelectRadio, {
			props: {
				value: null,
				choices,
			},
			global,
		});

		expect(wrapper.exists()).toBe(true);
	});

	it('should render all choices', () => {
		const wrapper = mount(SelectRadio, {
			props: {
				value: null,
				choices,
			},
			global,
		});

		expect(wrapper.findAll('[role="radio"]').length).toBe(4);
	});

	it('should render other choices when allowOther is true', () => {
		const wrapper = mount(SelectRadio, {
			props: {
				value: 'other-value',
				choices,
				allowOther: true,
			},
			global,
		});

		expect(wrapper.get<HTMLInputElement>('[data-custom] input').element.value).toBe('other-value');
		expect(wrapper.find('[data-custom] button[aria-label="Other..."]').exists()).toBe(true);
	});

	it('should render action buttons disabled when disabled is true', () => {
		const wrapper = mount(SelectRadio, {
			props: {
				value: 'other-value',
				choices,
				allowOther: true,
				disabled: true,
			},
			global,
		});

		const radios = wrapper.findAll('button[role="radio"]');

		radios.forEach((radio) => {
			expect(radio.attributes('disabled')).toBe('');
		});

		expect(wrapper.find('[data-custom] input').attributes('disabled')).toBe('');
	});

	it('should not render custom input when not set and nonEditable is true', () => {
		const wrapper = mount(SelectRadio, {
			props: {
				value: null,
				choices,
				allowOther: true,
				nonEditable: true,
				// Note: if nonEditable is true, disabled prop will also be true
				disabled: true,
			},
			global,
		});

		expect(wrapper.find('[data-custom]').exists()).toBe(false);
	});
});

// Backoffice: spec FR-032 options, fixture fields, edit shapes, label linking, keyboard.
describe('select-radio', () => {
	const choices = [
		{ text: 'Alpha', value: 'alpha' },
		{ text: 'Beta', value: 'beta' },
	];

	function fixtureProps(field: string) {
		const raw = fieldsOf('bo_std').find((f) => f.field === field)!;
		return { ...translate(raw.meta!.options ?? {}), value: itemOf('bo_std', 1)[field], width: raw.meta!.width };
	}

	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'select-radio', types: ['string', 'integer', 'float', 'bigInteger'] });
		expect(config.component).toBe(SelectRadio);
	});

	test('fixture bo_std.select_radio and select_radio_int: the seeded value is checked, no input on mount', () => {
		const text = mountRadio(fixtureProps('select_radio'));
		expect(text.get('[role="radio"][aria-checked="true"]').attributes('id')).toBeTruthy();
		expect(text.findAll('label').map((l) => l.text())).toEqual(['Alpha', 'Beta', 'Active']);
		expect(text.emitted('input')).toBeUndefined();

		const int = mountRadio(fixtureProps('select_radio_int'));
		expect(int.findAll('[role="radio"]')[0]!.attributes('aria-checked')).toBe('true');
	});

	test('option:select-radio.choices: checking a choice emits its value (numbers stay numbers)', async () => {
		const wrapper = mountRadio({
			value: null,
			choices: [
				{ text: 'One', value: 1 },
				{ text: 'Two', value: 2 },
			],
		});

		await wrapper.findAll('[role="radio"]')[1]!.trigger('click');
		expect(wrapper.emitted('input')).toEqual([[2]]);
	});

	test('option:select-radio.iconOn / option:select-radio.iconOff: custom icons are drawn; defaults draw the recipe radio', () => {
		const custom = mountRadio({ value: 'alpha', choices, iconOn: 'check_circle', iconOff: 'circle' });
		expect(custom.findAll('[role="radio"]').map((r) => r.text())).toEqual(['check_circle', 'circle']);

		const plain = mountRadio({ value: 'alpha', choices });
		expect(plain.findComponent(BoRadio).props('iconOn')).toBeUndefined();
	});

	test('option:select-radio.color: the checked radio and the active "other" row take the data color', () => {
		const wrapper = mountRadio({ value: 'custom', choices, color: '#2ECDA7', allowOther: true }); // raw-color-allowed: Directus data default (Q-C)

		expect(wrapper.findComponent(BoRadio).props('color')).toBe('#2ECDA7'); // raw-color-allowed: Directus data default (Q-C)
		expect(wrapper.get('[data-custom]').attributes('style')).toContain('border-color');
	});

	test('option:select-radio.allowOther: typing emits the text; the icon button re-selects it', async () => {
		const wrapper = mountRadio({ value: null, choices, allowOther: true });
		const input = wrapper.get('[data-custom] input');

		expect(wrapper.get('[data-custom] button').text()).toBe('add');
		await input.setValue('mine');
		expect(wrapper.emitted('input')?.[0]).toEqual(['mine']);

		await wrapper.setProps({ value: 'beta' });
		expect(wrapper.get('[data-custom] button').text()).toBe('radio_button_unchecked');
		await wrapper.get('[data-custom] button').trigger('click');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['mine']);
	});

	test('missing choices: "No options available"', () => {
		expect(mountRadio({ value: null }).text()).toContain('No options available');
	});

	test('label linking and invalid from the form field', () => {
		const wrapper = mountRadio(
			{ value: null, choices },
			{
				[FORM_FIELD_A11Y]: computed(() => ({
					inputId: 'f1',
					labelId: 'f1-label',
					describedBy: 'f1-note',
					invalid: true,
				})),
			},
		);
		const group = wrapper.get('[role="group"]');

		expect(group.attributes('aria-labelledby')).toBe('f1-label');
		expect(group.attributes('aria-describedby')).toBe('f1-note');
		expect(wrapper.get('[role="radiogroup"]').attributes('aria-invalid')).toBe('true');
	});
});
