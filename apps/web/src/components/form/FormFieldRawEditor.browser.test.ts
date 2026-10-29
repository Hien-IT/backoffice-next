import { enableAutoUnmount, mount } from '@vue/test-utils';
import type CodeMirror from 'codemirror';
import { afterEach, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import FormFieldRawEditor from './FormFieldRawEditor.vue';
import type { FormField } from './types.ts';

// Layout guard of the raw value dialog with the app CSS: the JSON editor is capped at 28.125rem (DR
// form-field-raw-editor.vue:107-114) and every line can be scrolled to. With a Tailwind utility the 56.25rem scroller
// cap of codemirror-theme.css (unlayered) won, so the scroller overflowed the capped box and the end was cut (D-197).
enableAutoUnmount(afterEach);

const VALUE = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`field_${i}`, `value ${i}`]));

test('a long JSON value scrolls to its last line inside the 28.125rem editor', async () => {
	// The value is stringified when the dialog opens.
	const wrapper = mount(FormFieldRawEditor, {
		props: { field: { field: 'f', name: 'F', type: 'json' } as FormField, currentValue: VALUE, disabled: true },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	await wrapper.setProps({ showModal: true });
	await vi.waitFor(() => expect(document.querySelector('[role="dialog"] .CodeMirror')).not.toBeNull());

	const box = document.querySelector<HTMLElement>('[role="dialog"] .CodeMirror')!;
	const editor = (box as unknown as { CodeMirror: CodeMirror.Editor }).CodeMirror;
	await vi.waitFor(() => expect(editor.lineCount()).toBe(62));
	expect(box.getBoundingClientRect().height).toBeLessThanOrEqual(28.125 * 16 + 1);

	const scroller = box.querySelector<HTMLElement>('.CodeMirror-scroll')!;
	scroller.scrollTop = scroller.scrollHeight;
	await vi.waitFor(() => {
		const last = [...box.querySelectorAll<HTMLElement>('.CodeMirror-line')].at(-1)!;
		expect(last.textContent).toBe('}');
		expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.getBoundingClientRect().bottom);
	});
});
