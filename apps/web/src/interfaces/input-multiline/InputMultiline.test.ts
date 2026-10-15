// Directus has no test for input-multiline: fixture, options (contracts/tests.md §5) and the v-textarea value logic.
import type { FieldRaw } from '@directus/types';
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { computed } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import InputMultiline from './InputMultiline.vue';

const field = fieldsOf('bo_std').find((f) => f.field === 'input_multiline') as FieldRaw;
const seeded = itemOf('bo_std', 1)['input_multiline'] as string;

function mountMultiline(props: Record<string, unknown> = {}, invalid = false) {
	return mount(InputMultiline, {
		props: { ...(field.meta?.options ?? {}), value: seeded, type: 'text', ...props } as any,
		global: {
			provide: {
				[FORM_FIELD_A11Y as symbol]: computed(() => ({
					inputId: 'f-input',
					labelId: 'f-label',
					describedBy: invalid ? 'f-error' : undefined,
					invalid,
				})),
			},
		},
	});
}

describe('input-multiline', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'input-multiline', types: ['text'], component: InputMultiline });
	});

	test('shows the seeded value and emits nothing on mount', () => {
		const wrapper = mountMultiline();
		expect(wrapper.find('textarea').element.value).toBe('Line one\nLine two');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('missing options use the Directus defaults', async () => {
		const wrapper = mount(InputMultiline, { props: { value: null } });
		const textarea = wrapper.find('textarea');
		expect(textarea.classes()).toContain('font-outfit');
		expect(textarea.attributes('placeholder')).toBeUndefined();
		expect(wrapper.find('[data-remaining]').exists()).toBe(false);
		await textarea.setValue('a');
		await textarea.setValue('');
		expect(wrapper.emitted('input')).toEqual([['a'], [null]]);
	});

	test('option:input-multiline.placeholder', () => {
		expect(mountMultiline().find('textarea').attributes('placeholder')).toBe('Several lines');
	});

	test('option:input-multiline.softLength counts a line break as one character', async () => {
		const wrapper = mountMultiline();
		// softLength 200, "Line one\nLine two" = 17 characters
		expect(wrapper.find('[data-remaining]').text()).toBe('183');
		await wrapper.setProps({ value: 'x'.repeat(190) });
		expect(wrapper.find('[data-remaining]').classes()).toContain('text-warning-700');
	});

	test('option:input-multiline.trim trims on blur', async () => {
		const wrapper = mountMultiline({ value: '  two lines\n ' });
		await wrapper.find('textarea').trigger('blur');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['two lines']);
	});

	test('option:input-multiline.font', () => {
		expect(mountMultiline().find('textarea').classes()).toContain('font-[family-name:ui-serif,Georgia,serif]');
	});

	test('option:input-multiline.clear keeps "" when emptied', async () => {
		const wrapper = mountMultiline();
		await wrapper.find('textarea').setValue('');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['']);
	});

	test('edit emits the text with its line breaks', async () => {
		const wrapper = mountMultiline();
		await wrapper.find('textarea').setValue('a\nb');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['a\nb']);
	});

	test('disabled and invalid states, linked to the form label (FR-094)', () => {
		const disabled = mountMultiline({ disabled: true }).find('textarea');
		expect(disabled.attributes('disabled')).toBeDefined();

		const invalid = mountMultiline({}, true).find('textarea');
		expect(invalid.attributes('id')).toBe('f-input');
		expect(invalid.attributes('aria-describedby')).toBe('f-error');
		expect(invalid.attributes('aria-invalid')).toBe('true');
		expect(invalid.classes()).toContain('border-error-600');
	});
});
