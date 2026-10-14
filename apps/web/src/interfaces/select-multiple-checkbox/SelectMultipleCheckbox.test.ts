// Ported from directus/app/src/interfaces/select-multiple-checkbox/select-multiple-checkbox.test.ts
import { mount } from '@vue/test-utils';
import { describe, expect, it, test } from 'vitest';
import { computed } from 'vue';
import BoCheckboxGroup from '../../components/BoCheckboxGroup.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import { translate } from '../../utils/translate-object-values.ts';
import config from './index.ts';
import SelectMultipleCheckbox from './SelectMultipleCheckbox.vue';

// Backoffice: mounted with our BoCheckboxGroup (no stubs); Directus classes become roles and labels.
const global = { plugins: [i18n] };

describe('Interface', () => {
	const choices = [
		{ value: '1', text: 'Item 1' },
		{ value: '2', text: 'Item 2' },
		{ value: '3', text: 'Item 3' },
		{ value: '4', text: 'Item 4' },
	];

	it('should mount', () => {
		const wrapper = mount(SelectMultipleCheckbox, {
			props: {
				value: null,
				choices,
			},
			global,
		});

		expect(wrapper.exists()).toBe(true);
	});

	it('should hide items that exceed the itemsShown limit', () => {
		const wrapper = mount(SelectMultipleCheckbox, {
			props: {
				value: null,
				choices,
				itemsShown: 2,
			},
			global,
		});

		expect(wrapper.findAll('[role="checkbox"]').length).toBe(2);
	});

	it('should show items that exceed the itemsShown limit when nonEditable is true', () => {
		const wrapper = mount(SelectMultipleCheckbox, {
			props: {
				value: null,
				choices,
				itemsShown: 2,
				nonEditable: true,
				// Note: if nonEditable is true, disabled prop will also be true
				disabled: true,
			},
			global,
		});

		expect(wrapper.findAll('[role="checkbox"]').length).toBe(4);
	});

	it('should render other choices when allowOther is true', () => {
		const wrapper = mount(SelectMultipleCheckbox, {
			props: {
				value: ['other', 'another'],
				choices,
				allowOther: true,
			},
			global,
		});

		expect(wrapper.findAll('[role="checkbox"]').length).toBe(6);
	});

	it('should render "add new" button and delete buttons when allowOther is true', () => {
		const wrapper = mount(SelectMultipleCheckbox, {
			props: {
				value: ['other', 'another'],
				choices,
				allowOther: true,
			},
			global,
		});

		expect(wrapper.findAll('button').some((button) => button.text().includes('Other...'))).toBe(true);
		expect(wrapper.findAll('button[aria-label="Remove Item"]').length).toBe(2);
	});

	it('should render action buttons disabled when disabled is true', () => {
		const wrapper = mount(SelectMultipleCheckbox, {
			props: {
				value: ['other', 'another'],
				choices,
				allowOther: true,
				disabled: true,
			},
			global,
		});

		const checkboxes = wrapper.findAll('button[role="checkbox"]');

		checkboxes.forEach((checkbox) => {
			expect(checkbox.attributes('disabled')).toBe('');
		});
	});

	it('should not render action buttons when nonEditable is true', () => {
		const wrapper = mount(SelectMultipleCheckbox, {
			props: {
				value: ['other', 'another'],
				choices,
				allowOther: true,
				nonEditable: true,
				// Note: if nonEditable is true, disabled prop will also be true
				disabled: true,
			},
			global,
		});

		expect(wrapper.findAll('button').some((button) => button.text().includes('Other...'))).toBe(false);
		expect(wrapper.findAll('button[aria-label="Remove Item"]').length).toBe(0);
		// Backoffice: the custom values still show, as checked plain checkboxes.
		expect(wrapper.findAll('label').map((label) => label.text())).toContain('another');
	});
});

// Backoffice: spec FR-033 options, fixture fields, edit shapes, label linking.
describe('select-multiple-checkbox', () => {
	const choices = [
		{ text: 'Alpha', value: 'alpha' },
		{ text: 'Beta', value: 'beta' },
		{ text: 'Delta', value: 'delta', disabled: true },
	];

	function fixtureProps(field: string) {
		const raw = fieldsOf('bo_std').find((f) => f.field === field)!;
		return { ...translate(raw.meta!.options ?? {}), value: itemOf('bo_std', 1)[field], width: raw.meta!.width };
	}

	function mountGroup(props: Record<string, unknown>, provide: Record<symbol, unknown> = {}) {
		return mount(SelectMultipleCheckbox, { props: props as never, global: { ...global, provide } });
	}

	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'select-multiple-checkbox', types: ['json', 'csv'] });
		expect(config.component).toBe(SelectMultipleCheckbox);
	});

	test('fixture bo_std.select_checkbox: seeded and custom values checked, itemsShown 2, no input on mount', () => {
		const wrapper = mountGroup(fixtureProps('select_checkbox'));
		const checked = wrapper.findAll('[role="checkbox"][aria-checked="true"]');

		expect(checked).toHaveLength(2);
		expect(wrapper.text()).toContain('Show 2 more');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('fixture bo_std.select_checkbox_csv: checking emits an array (csv fields too)', async () => {
		const wrapper = mountGroup(fixtureProps('select_checkbox_csv'));

		await wrapper.findAll('[role="checkbox"]')[2]!.trigger('click');
		expect(wrapper.emitted('input')).toEqual([[['beta', 'gamma']]]);
	});

	test('option:select-multiple-checkbox.choices: a disabled choice cannot be checked', () => {
		const wrapper = mountGroup({ value: null, choices });
		expect(wrapper.findAll('[role="checkbox"]')[2]!.attributes('disabled')).toBe('');
	});

	test('option:select-multiple-checkbox.allowOther: typing a custom value emits it after the checked ones', async () => {
		const wrapper = mountGroup({ value: ['alpha'], choices, allowOther: true });

		wrapper.findComponent(BoCheckboxGroup).vm.$emit('update:modelValue', ['alpha', 'mine']);
		expect(wrapper.emitted('input')).toEqual([[['alpha', 'mine']]]);
	});

	test('option:select-multiple-checkbox.color: checked boxes take the data color', () => {
		const wrapper = mountGroup({ value: ['alpha'], choices, color: '#6644FF' }); // raw-color-allowed: Directus data default (Q-C)
		expect(wrapper.get('[role="checkbox"][aria-checked="true"]').attributes('style')).toContain('background-color');
	});

	test('option:select-multiple-checkbox.iconOn / iconOff: custom icons are drawn; defaults draw the recipe box', () => {
		const custom = mountGroup({ value: ['alpha'], choices: choices.slice(0, 2), iconOn: 'favorite', iconOff: 'heart_plus' });
		expect(custom.findAll('[role="checkbox"]').map((box) => box.text())).toEqual(['favorite', 'heart_plus']);

		const plain = mountGroup({ value: ['alpha'], choices });
		expect(plain.findComponent(BoCheckboxGroup).props('iconOn')).toBeUndefined();
	});

	test('option:select-multiple-checkbox.itemsShown: default 8 choices before "show more"', () => {
		const many = Array.from({ length: 10 }, (_, i) => ({ text: `C${i}`, value: `c${i}` }));
		const wrapper = mountGroup({ value: null, choices: many });

		expect(wrapper.findAll('[role="checkbox"]')).toHaveLength(8);
		expect(wrapper.text()).toContain('Show 2 more');
	});

	test('grid columns follow the width and the longest choice (getMinimalGridClass)', () => {
		expect(mountGroup({ value: null, choices, width: 'full' }).findComponent(BoCheckboxGroup).props('columns')).toBe(3);
		expect(mountGroup({ value: null, choices, width: 'half' }).findComponent(BoCheckboxGroup).props('columns')).toBe(2);
	});

	test('label linking and invalid from the form field', () => {
		const wrapper = mountGroup(
			{ value: null, choices },
			{
				[FORM_FIELD_A11Y]: computed(() => ({ inputId: 'f1', labelId: 'f1-label', describedBy: 'f1-note', invalid: true })),
			},
		);
		const group = wrapper.get('[role="group"]');

		expect(group.attributes('aria-labelledby')).toBe('f1-label');
		expect(group.attributes('aria-describedby')).toBe('f1-note');
		expect(wrapper.get('[role="checkbox"]').attributes('aria-invalid')).toBe('true');
	});
});
