// Directus has no test for system-raw-editor (spec FR-004): value display, emits, single-line rules, read-only.
import { mount } from '@vue/test-utils';
import type CodeMirror from 'codemirror';
import { afterEach, describe, expect, test } from 'vitest';
import { computed, nextTick } from 'vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import { i18n } from '../../../lang/index.ts';
import config from './index.ts';
import SystemRawEditor from './SystemRawEditor.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

function mountEditor(props: Record<string, unknown> = {}) {
	const wrapper = mount(SystemRawEditor, { props, global: { plugins: [i18n] }, attachTo: document.body });
	const editor = (wrapper.element.querySelector('.CodeMirror') as unknown as { CodeMirror: CodeMirror.Editor })
		.CodeMirror;
	return { wrapper, editor };
}

function type(editor: CodeMirror.Editor, text: string) {
	editor.replaceRange(text, editor.getCursor(), undefined, '+input');
}

describe('system-raw-editor', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'system-raw-editor', system: true, types: ['string', 'text'], icon: 'code' });
		expect(config.component).toBe(SystemRawEditor);
	});

	test('shows the value, stringified for object types', () => {
		expect(mountEditor({ value: 'hello' }).editor.getValue()).toBe('hello');
		expect(mountEditor({ value: { a: 1 }, type: 'json' }).editor.getValue()).toBe('{\n    "a": 1\n}');
	});

	test('emits the typed text, null when emptied, parsed JSON for object types', () => {
		const { wrapper, editor } = mountEditor({ value: '' });

		type(editor, '{{ $trigger }}');
		expect(wrapper.emitted('input')?.[0]).toEqual(['{{ $trigger }}']);

		const json = mountEditor({ value: null, type: 'json' });
		type(json.editor, '{"a":1}');
		expect(json.wrapper.emitted('input')?.at(-1)).toEqual([{ a: 1 }]);

		json.editor.execCommand('selectAll');
		json.editor.replaceSelection('', undefined, '+delete');
		expect(json.wrapper.emitted('input')?.at(-1)).toEqual([null]);
	});

	test('keeps a single line for string types, multiple lines for text', () => {
		const single = mountEditor({ value: 'a', type: 'string' });
		single.editor.replaceRange(['', ''], { line: 0, ch: 1 }, undefined, '+input');
		expect(single.editor.getValue()).toBe('a');
		single.editor.replaceRange(['b', 'c'], { line: 0, ch: 1 }, undefined, 'paste');
		expect(single.editor.getValue()).toBe('ab c');

		const multi = mountEditor({ value: 'a', type: 'text' });
		multi.editor.replaceRange(['', ''], { line: 0, ch: 1 }, undefined, '+input');
		expect(multi.editor.lineCount()).toBe(2);
		expect(multi.wrapper.classes()).toContain('multi-line');
	});

	test('follows value changes from the parent without emitting', async () => {
		const { wrapper, editor } = mountEditor({ value: 'a' });

		await wrapper.setProps({ value: 'b' });
		expect(editor.getValue()).toBe('b');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('is read-only when disabled; option:system-raw-editor.placeholder or the default placeholder', async () => {
		const { wrapper, editor } = mountEditor({ value: null, disabled: true });

		expect(editor.getOption('readOnly')).toBe(true);
		expect(editor.getOption('placeholder')).toBe(i18n.global.t('raw_editor_placeholder'));
		expect(wrapper.classes()).toContain('disabled');

		await wrapper.setProps({ disabled: false });
		await nextTick();
		expect(editor.getOption('readOnly')).toBe(false);

		expect(mountEditor({ placeholder: 'Enter raw value...' }).editor.getOption('placeholder')).toBe(
			'Enter raw value...',
		);
	});

	test('labels the CodeMirror input', () => {
		const { editor } = mountEditor({ id: 'field-x', ariaLabelledby: 'field-x-label' });
		const input = editor.getInputField();

		expect(input.id).toBe('field-x');
		expect(input.getAttribute('aria-labelledby')).toBe('field-x-label');
	});

	test('as an interface, labels the CodeMirror input from FormField (T093: axe "label")', () => {
		const a11y = computed(() => ({ inputId: 'f-1', labelId: 'f-1-label', describedBy: 'f-1-error', invalid: true }));
		const wrapper = mount(SystemRawEditor, {
			global: { plugins: [i18n], provide: { [FORM_FIELD_A11Y as symbol]: a11y } },
			attachTo: document.body,
		});
		const input = wrapper.get('.CodeMirror textarea').element;

		expect(input.id).toBe('f-1');
		expect(input.getAttribute('aria-labelledby')).toBe('f-1-label');
		expect(input.getAttribute('aria-describedby')).toBe('f-1-error');
		expect(input.getAttribute('aria-invalid')).toBe('true');
	});
});
