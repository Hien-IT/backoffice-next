// DR has no test for form-field-raw-editor.vue: the cast back by type (spec FR-017).
import { flushPromises, mount } from '@vue/test-utils';
import type CodeMirror from 'codemirror';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import FormFieldRawEditor from './FormFieldRawEditor.vue';
import type { FormField } from './types.ts';

vi.mock('../../interfaces/index.ts', () => ({ getInterface: () => undefined }));

afterEach(() => {
	document.body.innerHTML = '';
});

async function submit(type: string, currentValue: unknown, typed: string, special: string[] | null = null) {
	const field = { field: 'f', name: 'F', collection: 'c', type, meta: { special } } as unknown as FormField;

	const wrapper = mount(FormFieldRawEditor, {
		props: { field, currentValue, showModal: false },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await wrapper.setProps({ showModal: true });
	await flushPromises();

	const dialog = document.body.querySelector('[role="dialog"]')!;
	const editor = (dialog.querySelector('.CodeMirror') as unknown as { CodeMirror: CodeMirror.Editor }).CodeMirror;
	editor.execCommand('selectAll');
	editor.replaceSelection(typed, undefined, '+input');

	[...dialog.querySelectorAll('button')].find((button) => button.textContent?.includes('Done'))!.click();
	await flushPromises();

	return { wrapper, dialog };
}

describe('FormFieldRawEditor', () => {
	test('shows the current value stringified, titled by the mode', async () => {
		const { dialog } = await submit('json', { a: 1 }, '{"a":1}');

		expect(dialog.textContent).toContain('Edit Raw Value');
	});

	test.each([
		['string', 'x', 'hello', 'hello'],
		['integer', 1, '42', 42],
		['boolean', true, 'false', false],
		['json', { a: 1 }, '{"b":2}', { b: 2 }],
		['json', null, 'not json', 'not json'],
	])('casts a %s value', async (type, current, typed, expected) => {
		const { wrapper } = await submit(type, current, typed);

		expect(wrapper.emitted('setRawValue')?.[0]).toEqual([expected]);
	});

	test('a relational field is edited as JSON', async () => {
		const { wrapper } = await submit('integer', 1, '{"id":7}', ['m2o']);

		expect(wrapper.emitted('setRawValue')?.[0]).toEqual([{ id: 7 }]);
	});

	test('closing the dialog cancels; disabled shows View Raw Value', async () => {
		const field = { field: 'f', name: 'F', collection: 'c', type: 'string', meta: {} } as unknown as FormField;
		const wrapper = mount(FormFieldRawEditor, {
			props: { field, currentValue: 'x', showModal: true, disabled: true },
			global: { plugins: [i18n] },
			attachTo: document.body,
		});

		await flushPromises();
		expect(document.body.querySelector('[role="dialog"]')!.textContent).toContain('View Raw Value');

		document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await flushPromises();
		expect(wrapper.emitted('cancel')).toBeTruthy();
	});
});
