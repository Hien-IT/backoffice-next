import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoTagsInput from './BoTagsInput.vue';

const global = { plugins: [i18n] };

afterEach(() => {
	document.body.innerHTML = '';
});

function keydown(el: Element, key: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('BoTagsInput', () => {
	test('label, placeholder and existing tags with named delete buttons', () => {
		const wrapper = mount(BoTagsInput, { props: { label: 'Tags', modelValue: ['vue', 'nx'] }, global });
		const input = wrapper.get('input');

		expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'));
		expect(input.attributes('placeholder')).toBe('Add a tag and press Enter...');
		expect(wrapper.findAll('[aria-label^="Remove"]').map((b) => b.attributes('aria-label'))).toEqual([
			'Remove vue',
			'Remove nx',
		]);
	});

	test('Enter and comma add the raw text; delete button removes', async () => {
		const wrapper = mount(BoTagsInput, {
			props: {
				modelValue: ['vue'],
				'onUpdate:modelValue': (modelValue: string[]) => wrapper.setProps({ modelValue }),
			},
			global,
			attachTo: document.body,
		});
		const input = wrapper.get('input');

		await input.setValue(' Nx ');
		keydown(input.element, 'Enter');
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['vue', ' Nx ']]);

		await wrapper.get('[aria-label="Remove vue"]').trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[' Nx ']]);

		await input.setValue('a,');
		input.element.dispatchEvent(new InputEvent('input', { data: ',' }));
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[' Nx ', 'a']]);
		wrapper.unmount();
	});

	test('blur adds the pending text', async () => {
		const wrapper = mount(BoTagsInput, { props: { modelValue: null }, global, attachTo: document.body });
		const input = wrapper.get('input');

		await input.setValue('pending');
		await input.trigger('blur');
		expect(wrapper.emitted('update:modelValue')).toEqual([[['pending']]]);
		wrapper.unmount();
	});

	test('presets are toggle buttons; invalid and disabled', async () => {
		const wrapper = mount(BoTagsInput, {
			props: { id: 't', modelValue: ['a'], presets: ['a', 'b'], error: 'Bad' },
			global,
		});
		const a = wrapper.findAll('button[aria-pressed]')[0]!;
		const b = wrapper.findAll('button[aria-pressed]')[1]!;

		expect(a.attributes('aria-pressed')).toBe('true');
		expect(b.attributes('aria-pressed')).toBe('false');
		await b.trigger('click');
		await a.trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([[['a', 'b']], [[]]]);
		expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
		expect(wrapper.get('input').attributes('aria-describedby')).toBe('t-error');

		await wrapper.setProps({ disabled: true });
		expect(wrapper.get('input').attributes('disabled')).toBeDefined();
		expect(b.attributes('disabled')).toBeDefined();
	});
});

describe('BoTagsInput form linking', () => {
	test('id, aria-labelledby and aria-describedby land on the input', () => {
		const wrapper = mount(BoTagsInput, {
			props: { id: 'f-input', ariaLabelledby: 'f-label', ariaDescribedby: 'f-note', error: 'Bad' },
			global,
		});
		const input = wrapper.get('input');

		expect(input.attributes('id')).toBe('f-input');
		expect(input.attributes('aria-labelledby')).toBe('f-label');
		expect(input.attributes('aria-describedby')).toBe('f-note f-input-error');
		expect(input.attributes('aria-invalid')).toBe('true');
	});
});
