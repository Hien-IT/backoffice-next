// DR has no test for form-field-menu.vue: the option rules of spec FR-017 (and FR-066 for read-only fields).
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import FormFieldMenu from './FormFieldMenu.vue';
import type { FormField } from './types.ts';

Object.defineProperty(navigator, 'clipboard', {
	value: { writeText: async () => {}, readText: async () => '' },
	configurable: true,
});

afterEach(() => {
	document.body.innerHTML = '';
});

const baseField: FormField = {
	field: 'title',
	name: 'Title',
	collection: 'articles',
	type: 'string',
	schema: { default_value: 'def', is_nullable: true },
	meta: { special: null },
};

async function open(props: Record<string, unknown>) {
	const wrapper = mount(FormFieldMenu, {
		props: { field: baseField, ...props },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	const trigger = wrapper.get('button').element;
	expect(trigger.getAttribute('aria-label')).toBe('Title: Options');
	trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();

	const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].map((item) => ({
		text: item.textContent!.replace(/^\s*\w+\s*/, '').trim(),
		disabled: item.hasAttribute('data-disabled'),
	}));

	return { wrapper, items, separator: !!document.body.querySelector('[role="separator"]') };
}

describe('FormFieldMenu', () => {
	test('editable field: the seven options minus view raw, with a separator', async () => {
		const { items, separator } = await open({ modelValue: 'B', initialValue: 'A' });

		expect(items).toEqual([
			{ text: 'Edit Raw Value', disabled: false },
			{ text: 'Copy Raw Value', disabled: false },
			{ text: 'Paste Raw Value', disabled: false },
			{ text: 'Reset to Default', disabled: false },
			{ text: 'Undo Changes', disabled: false },
			{ text: 'Clear Value', disabled: false },
		]);
		expect(separator).toBe(true);
	});

	test('restricted field: view and copy only, no separator', async () => {
		const { items, separator } = await open({ modelValue: 'B', initialValue: 'A', restricted: true });

		expect(items).toEqual([
			{ text: 'View Raw Value', disabled: false },
			{ text: 'Copy Raw Value', disabled: false },
		]);
		expect(separator).toBe(false);
	});

	test('disable and hide rules of Directus', async () => {
		// no initial value: no undo; value equal to the default: reset disabled; null: copy and clear disabled
		const { items } = await open({ modelValue: null, initialValue: null, field: { ...baseField, schema: { default_value: null } } });
		expect(items.map((item) => item.text)).not.toContain('Undo Changes');
		expect(items.map((item) => item.text)).not.toContain('Reset to Default');
		expect(items.find((item) => item.text === 'Copy Raw Value')?.disabled).toBe(true);
		expect(items.find((item) => item.text === 'Clear Value')?.disabled).toBe(true);
	});

	test('a required field with a default has no clear option; relational fields cannot be cleared', async () => {
		const required = await open({
			modelValue: 'B',
			initialValue: 'A',
			field: { ...baseField, schema: { default_value: 'def', is_nullable: false } },
		});
		expect(required.items.map((item) => item.text)).not.toContain('Clear Value');
		document.body.innerHTML = '';

		const relational = await open({ modelValue: 1, initialValue: 1, field: { ...baseField, meta: { special: ['m2o'] } } });
		expect(relational.items.find((item) => item.text === 'Clear Value')?.disabled).toBe(true);
		expect(relational.items.find((item) => item.text === 'Undo Changes')?.disabled).toBe(true);
	});

	test('emits the chosen action', async () => {
		const { wrapper } = await open({ modelValue: 'B', initialValue: 'A' });
		const item = (text: string) =>
			[...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) => el.textContent?.includes(text))!;

		item('Reset to Default').click();
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')).toEqual([['def']]);
	});
});
