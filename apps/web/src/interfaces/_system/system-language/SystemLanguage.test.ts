// Feature 015 (T071, FR-080): system-language, as DR system-language.vue.
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { computed } from 'vue';
import BoSelect from '../../../components/BoSelect.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import availableLanguages from '../../../lang/available-languages.json';
import { i18n } from '../../../lang/index.ts';
import config from './index.ts';
import SystemLanguage from './SystemLanguage.vue';

function mountLanguage(props: Record<string, unknown>) {
	const a11y = computed(() => ({ inputId: 'field-language', labelId: 'l', describedBy: undefined, invalid: false }));
	const wrapper = mount(SystemLanguage, {
		props: { value: null, ...props },
		global: { plugins: [i18n], provide: { [FORM_FIELD_A11Y as symbol]: a11y } },
	});
	return { wrapper, select: wrapper.findComponent(BoSelect) };
}

describe('system-language', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'system-language', name: '$t:language', icon: 'translate', system: true });
		expect(config.types).toEqual(['string']);
		expect(config.options).toEqual([]);
		expect(config.component).toBe(SystemLanguage);
	});

	test('lists the available languages with the placeholder, linked to the form label', () => {
		const { select } = mountLanguage({ value: 'vi-VN' });
		const items = select.props('items');

		expect(items).toHaveLength(Object.keys(availableLanguages).length);
		expect(items).toContainEqual({ text: 'Vietnamese (Vietnam)', value: 'vi-VN' });
		expect(select.props('modelValue')).toBe('vi-VN');
		expect(select.props('placeholder')).toBe('Select a language...');
		expect(select.props('id')).toBe('field-language');
	});

	test('includeProjectDefault adds the project default first, as null', async () => {
		const { wrapper, select } = mountLanguage({ value: null, includeProjectDefault: true });
		const first = select.props('items')[0]!;

		expect(first.text).toBe('Default Language');
		expect(select.props('modelValue')).toBe(first.value);

		select.vm.$emit('update:modelValue', first.value);
		select.vm.$emit('update:modelValue', 'en-US');
		expect(wrapper.emitted('input')).toEqual([[null], ['en-US']]);
	});

	test('without includeProjectDefault there is no null item and null shows the placeholder', () => {
		const { select } = mountLanguage({ value: null });

		expect(select.props('items')[0]).toEqual({ text: 'Afrikaans (South Africa)', value: 'af-ZA' });
		expect(select.props('modelValue')).toBeNull();
	});

	test('an unknown stored code shows as it is (D-46)', () => {
		const { select } = mountLanguage({ value: 'xx-YY' });

		expect(select.props('items').at(-1)).toEqual({ text: 'xx-YY', value: 'xx-YY' });
		expect(select.props('modelValue')).toBe('xx-YY');
	});

	test('disabled reaches the select', () => {
		expect(mountLanguage({ value: 'en-US', disabled: true }).select.props('disabled')).toBe(true);
	});
});
