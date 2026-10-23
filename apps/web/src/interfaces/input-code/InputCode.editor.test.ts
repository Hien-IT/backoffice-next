// DR has no real-editor test for input-code; contracts/tests.md §5 with the real CodeMirror 5 (FR-028).
import type { Field } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import type CodeMirror from 'codemirror';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import InputCode from './InputCode.vue';

enableAutoUnmount(afterEach);

const global = { plugins: [i18n] };

async function mountCode(props: Record<string, unknown>, options: Record<string, unknown> = {}) {
	const wrapper = mount(InputCode, { props: props as never, global, attachTo: document.body, ...options });
	let editor!: CodeMirror.Editor;

	await vi.waitFor(() => {
		editor = (wrapper.element.querySelector('.CodeMirror') as unknown as { CodeMirror: CodeMirror.Editor }).CodeMirror;
		expect(editor).toBeDefined();
	});
	await flushPromises();

	return { wrapper, editor };
}

function mountField(name: string, value: unknown, extra: Record<string, unknown> = {}) {
	const field = fieldsOf('bo_std').find((f) => f.field === name)!;
	return mountCode({ ...(field.meta?.options ?? {}), type: field.type, value, ...extra });
}

function type(editor: CodeMirror.Editor, text: string) {
	editor.execCommand('selectAll');
	editor.replaceSelection(text, undefined, '+input');
}

describe('input-code with CodeMirror', () => {
	it('is registered with the Directus config; json fields get no language option', () => {
		const options = config.options as (ctx: { field: Partial<Field> }) => { field: string; meta: any }[];

		expect(config).toMatchObject({ id: 'input-code', icon: 'code', types: ['string', 'json', 'text', 'geometry'] });
		expect(config.component).toBe(InputCode);
		expect(options({ field: { type: 'json' } }).map((o) => o.field)).toEqual(['lineNumber', 'lineWrapping', 'template']);

		const language = options({ field: { type: 'string' } })[0]!;
		const choices = language.meta.options.choices as { text: string; value: string }[];
		expect(language.field).toBe('language');
		expect(choices).toContainEqual({ text: 'JSON', value: 'JSON' });
		expect(choices).toContainEqual({ text: 'Plain Text', value: 'plaintext' });
		expect(choices.find((c) => c.value === 'javascript')?.text).toContain('JavaScript');
	});

	it('shows the seeded fixture values without emitting (json stringified, broken JSON shown as text)', async () => {
		const item = itemOf('bo_std', 1);
		const json = await mountField('code_json', item['code_json']);
		const js = await mountField('code_js', item['code_js']);
		const broken = await mountField('code_string_json', itemOf('bo_std', 3)['code_string_json']);

		expect(json.editor.getValue()).toBe(JSON.stringify(item['code_json'], null, 4));
		expect(js.editor.getValue()).toBe(item['code_js']);
		expect(broken.editor.getValue()).toBe('{ invalid json');
		for (const { wrapper } of [json, js, broken]) expect(wrapper.emitted('input')).toBeUndefined();
	});

	it('missing options use the component defaults (line numbers, no wrapping, plaintext)', async () => {
		const { editor } = await mountCode({ value: 'a', type: 'text' });

		expect(editor.getOption('lineNumbers')).toBe(true);
		expect(editor.getOption('lineWrapping')).toBe(false);
		expect(editor.getOption('mode')).toEqual({ name: 'plaintext' });
	});

	it('option:input-code.lineNumber and option:input-code.lineWrapping', async () => {
		const js = await mountField('code_js', 'a');
		const json = await mountField('code_json', null);

		expect(js.editor.getOption('lineNumbers')).toBe(false);
		expect(js.wrapper.find('.CodeMirror-linenumbers').exists()).toBe(false);
		expect(json.editor.getOption('lineWrapping')).toBe(true);

		await js.wrapper.setProps({ lineNumber: true });
		expect(js.editor.getOption('lineNumbers')).toBe(true);
	});

	it('option:input-code.language loads the CodeMirror mode; JSON uses the json javascript mode', async () => {
		const js = await mountField('code_js', 'a');
		const json = await mountField('code_string_json', '{}');

		expect(js.editor.getOption('mode')).toEqual({ name: 'javascript' });
		expect(json.editor.getOption('mode')).toEqual({ name: 'javascript', json: true });

		await js.wrapper.setProps({ language: 'python' });
		await vi.waitFor(() => expect(js.editor.getOption('mode')).toEqual({ name: 'python' }));
	});

	it('option:input-code.template fills the template (parsed for json fields)', async () => {
		const json = await mountField('code_json', null);
		await json.wrapper.get('button.fill-template').trigger('click');
		expect(json.wrapper.emitted('input')).toEqual([[{ key: 'value' }]]);

		const text = await mountCode({ value: null, type: 'text', template: 'hello' });
		await text.wrapper.get('button.fill-template').trigger('click');
		expect(text.wrapper.emitted('input')).toEqual([['hello']]);

		const none = await mountCode({ value: null, type: 'text' });
		expect(none.wrapper.find('button.fill-template').exists()).toBe(false);
	});

	it('placeholder reaches CodeMirror', async () => {
		const { editor } = await mountCode({ value: null, placeholder: 'Enter code here...' });

		expect(editor.getOption('placeholder' as never)).toBe('Enter code here...');
	});

	it('json edits: parsed JSON, empty is null, invalid not emitted, {{ var }} and JSON strings raw', async () => {
		const { wrapper, editor } = await mountField('code_json', null);

		type(editor, '{"a": [1, 2]}');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([{ a: [1, 2] }]);

		type(editor, '{ "a": ');
		expect(wrapper.emitted('input')).toHaveLength(1);

		type(editor, '{{ $trigger.body }}');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['{{ $trigger.body }}']);

		type(editor, '"text"');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['"text"']);

		type(editor, '');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([null]);
	});

	it('string and text fields emit the typed text (empty string, not null)', async () => {
		const { wrapper, editor } = await mountField('code_js', 'a');

		type(editor, 'let b = 2;');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['let b = 2;']);
		type(editor, '');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['']);
	});

	it('marks a JSON syntax error with jsonlint', async () => {
		const { editor } = await mountField('code_json', null);

		type(editor, '{ "a": }');
		// happy-dom does not lay out the lines, so the marks are read from the editor.
		await vi.waitFor(
			() =>
				expect(editor.getAllMarks().map((mark) => (mark as { className?: string }).className)).toContain(
					'CodeMirror-lint-mark CodeMirror-lint-mark-error',
				),
			{ timeout: 3000 },
		);

		type(editor, '{{ $trigger }}');
		await vi.waitFor(
			() =>
				expect(editor.getAllMarks().map((mark) => (mark as { className?: string }).className)).not.toContain(
					'CodeMirror-lint-mark CodeMirror-lint-mark-error',
				),
			{ timeout: 3000 },
		);
	});

	it('follows value changes from the parent without emitting', async () => {
		const { wrapper, editor } = await mountField('code_json', { a: 1 });

		await wrapper.setProps({ value: { b: 2 } });
		expect(editor.getValue()).toBe('{\n    "b": 2\n}');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	it('is read-only when disabled; nonEditable hides the template button', async () => {
		const { wrapper, editor } = await mountField('code_json', null, { disabled: true });

		expect(editor.getOption('readOnly')).toBe(true);
		expect(wrapper.classes()).toContain('disabled');
		expect(wrapper.get('button.fill-template').attributes('disabled')).toBeDefined();

		await wrapper.setProps({ disabled: false });
		expect(editor.getOption('readOnly')).toBe(false);

		const locked = await mountField('code_json', null, { disabled: true, nonEditable: true });
		expect(locked.wrapper.find('button.fill-template').exists()).toBe(false);
	});

	it('links the CodeMirror input to the field label, note/error and invalid state', async () => {
		const a11y = computed(() => ({ inputId: 'f-code', labelId: 'f-code-label', describedBy: 'f-code-note', invalid: true }));
		const { wrapper, editor } = await mountCode(
			{ value: 'a', type: 'text' },
			{ global: { plugins: [i18n], provide: { [FORM_FIELD_A11Y as symbol]: a11y } } },
		);
		const input = editor.getInputField();

		expect(input.id).toBe('f-code');
		expect(input.getAttribute('aria-labelledby')).toBe('f-code-label');
		expect(input.getAttribute('aria-describedby')).toBe('f-code-note');
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(wrapper.classes()).toContain('border-error-600');
	});
});
