import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import BoTextarea from './BoTextarea.vue';

describe('BoTextarea', () => {
	test('label, rows, placeholder and attrs go to the textarea', () => {
		const wrapper = mount(BoTextarea, {
			props: { label: 'Notes', rows: 3, placeholder: 'Write...' },
			attrs: { name: 'notes' },
		});
		const textarea = wrapper.get('textarea');

		expect(wrapper.get('label').attributes('for')).toBe(textarea.attributes('id'));
		expect(textarea.attributes('rows')).toBe('3');
		expect(textarea.attributes('placeholder')).toBe('Write...');
		expect(textarea.attributes('name')).toBe('notes');
		expect(textarea.classes()).toContain('font-outfit');
		expect(textarea.attributes('aria-describedby')).toBeUndefined();
	});

	test('v-model', async () => {
		const wrapper = mount(BoTextarea, { props: { modelValue: 'a' } });

		expect(wrapper.get('textarea').element.value).toBe('a');
		await wrapper.get('textarea').setValue('a\nb');
		expect(wrapper.emitted('update:modelValue')).toEqual([['a\nb']]);
	});

	test('font, hint, error, disabled', () => {
		const textarea = mount(BoTextarea, {
			props: { id: 't', font: 'monospace', hint: 'Markdown', error: 'Required', disabled: true },
		}).get('textarea');

		expect(textarea.classes().some((c) => c.includes('monospace'))).toBe(true);
		expect(textarea.attributes('aria-describedby')).toBe('t-hint t-error');
		expect(textarea.attributes('aria-invalid')).toBe('true');
		expect(textarea.attributes('disabled')).toBeDefined();
	});
});
