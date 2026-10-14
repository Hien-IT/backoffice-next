// Directus has no test for the boolean interface: fixture, options (contracts/tests.md §5), states and keyboard.
import type { FieldRaw } from '@directus/types';
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { computed } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import InterfaceBoolean from './InterfaceBoolean.vue';
import config from './index.ts';

const fields = fieldsOf('bo_std');
const item = itemOf('bo_std', 1);
const options = fields.find((f) => f.field === 'boolean')!.meta!.options as Record<string, string>;

function fieldProps(name: string) {
	const field = fields.find((f) => f.field === name) as FieldRaw;
	return { ...(field.meta?.options ?? {}), value: item[name], type: field.type };
}

function mountBoolean(props: Record<string, unknown>, a11y?: { invalid: boolean }) {
	return mount(InterfaceBoolean, {
		props: props as any,
		attachTo: document.body,
		global: {
			plugins: [i18n],
			provide: a11y
				? {
						[FORM_FIELD_A11Y as symbol]: computed(() => ({
							inputId: 'f-input',
							labelId: 'f-label',
							describedBy: a11y.invalid ? 'f-error' : undefined,
							invalid: a11y.invalid,
						})),
					}
				: {},
		},
	});
}

describe('boolean', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'boolean', types: ['boolean'], component: InterfaceBoolean });
	});

	test('shows the seeded values and emits nothing on mount', () => {
		const on = mountBoolean(fieldProps('boolean'));
		expect(on.find('button').attributes('aria-checked')).toBe('true');
		const off = mountBoolean(fieldProps('boolean_default'));
		expect(off.find('button').attributes('aria-checked')).toBe('false');
		expect(on.emitted('input')).toBeUndefined();
		expect(off.emitted('input')).toBeUndefined();
	});

	test('missing options use the Directus defaults', () => {
		const wrapper = mountBoolean({ value: true });
		expect(wrapper.find('[data-icon]').text()).toBe('check_box');
		expect(wrapper.find('[data-icon]').classes()).toContain('text-brand-500');
		expect(wrapper.text()).toContain('Enabled');
		const off = mountBoolean({ value: false });
		expect(off.find('[data-icon]').text()).toBe('check_box_outline_blank');
		expect(off.find('[data-icon]').classes()).toContain('text-gray-500');
	});

	test('null shows the indeterminate state and becomes true on click', async () => {
		const wrapper = mountBoolean({ value: null });
		expect(wrapper.find('button').attributes('aria-checked')).toBe('mixed');
		expect(wrapper.find('[data-icon]').text()).toBe('indeterminate_check_box');
		await wrapper.find('button').trigger('click');
		expect(wrapper.emitted('input')).toEqual([[true]]);
	});

	test('option:boolean.label', () => {
		expect(mountBoolean(fieldProps('boolean')).text()).toContain('Published');
	});

	test('option:boolean.iconOn option:boolean.colorOn', () => {
		const icon = mountBoolean(fieldProps('boolean')).find('[data-icon]');
		expect(icon.text()).toBe('visibility');
		expect((icon.element as HTMLElement).style.color).toBe(options['colorOn']);
	});

	test('option:boolean.iconOff option:boolean.colorOff', () => {
		const icon = mountBoolean({ ...fieldProps('boolean'), value: false }).find('[data-icon]');
		expect(icon.text()).toBe('visibility_off');
		expect((icon.element as HTMLElement).style.color).toBe(options['colorOff']);
	});

	test('a click emits the opposite value', async () => {
		const wrapper = mountBoolean(fieldProps('boolean'));
		await wrapper.find('button').trigger('click');
		expect(wrapper.emitted('input')).toEqual([[false]]);
	});

	test('keyboard: the button is focusable and Enter/Space activate it (native button)', () => {
		const wrapper = mountBoolean(fieldProps('boolean_default'));
		const button = wrapper.find('button').element;
		button.focus();
		expect(document.activeElement).toBe(button);
		expect(button.tagName).toBe('BUTTON');
		expect(button.getAttribute('type')).toBe('button');
		wrapper.unmount();
	});

	test('disabled emits nothing and greys the control', async () => {
		const wrapper = mountBoolean({ ...fieldProps('boolean'), disabled: true });
		expect(wrapper.find('button').attributes('disabled')).toBeDefined();
		expect(wrapper.find('[data-icon]').attributes('style')).not.toContain('color:');
		await wrapper.find('button').trigger('click');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('nonEditable keeps the data colors', () => {
		const wrapper = mountBoolean({ ...fieldProps('boolean'), disabled: true, nonEditable: true });
		expect((wrapper.find('[data-icon]').element as HTMLElement).style.color).toBe(options['colorOn']);
	});

	test('is named by the form label and its own text, linked to the messages (FR-094)', () => {
		const button = mountBoolean(fieldProps('boolean'), { invalid: true }).find('button');
		const [labelId, textId] = button.attributes('aria-labelledby')!.split(' ');
		expect(labelId).toBe('f-label');
		expect(document.getElementById(textId!)?.textContent).toBe('Published');
		expect(button.attributes('aria-describedby')).toBe('f-error');
		expect(button.attributes('aria-invalid')).toBe('true');
		expect(button.classes()).toContain('border-error-600');
	});
});
