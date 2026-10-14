// Directus has no test for input-rich-text-md; contracts/tests.md §5 with the real CodeMirror 5 (FR-061).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import type CodeMirror from 'codemirror';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, defineAsyncComponent } from 'vue';
import { getApiUrl } from '../../api/sdk.ts';
import BoEditorFrame from '../../components/BoEditorFrame.vue';
import DrawerFiles from '../../components/drawers/DrawerFiles.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useServerStore } from '../../stores/server.ts';
import { calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { fieldsOf, itemOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import InputRichTextMd from './InputRichTextMd.vue';

enableAutoUnmount(afterEach);

const field = fieldsOf('bo_std').find((f) => f.field === 'rich_md')!;
const seeded = itemOf('bo_std', 1)['rich_md'] as string;

const DEFAULT_TOOLBAR = [
	'heading',
	'bold',
	'italic',
	'strikethrough',
	'bullist',
	'numlist',
	'blockquote',
	'code',
	'link',
	'table',
	'image',
];

beforeEach(() => {
	setActivePinia(createPinia());
});

async function mountMd(props: Record<string, unknown>, provide: Record<symbol, unknown> = {}) {
	const wrapper = mount(InputRichTextMd, {
		props: props as never,
		global: { plugins: [i18n], provide, stubs: { DrawerFiles: true } },
		attachTo: document.body,
	});
	let editor!: CodeMirror.Editor;

	await vi.waitFor(() => {
		editor = (wrapper.element.querySelector('.CodeMirror') as unknown as { CodeMirror: CodeMirror.Editor }).CodeMirror;
		expect(editor).toBeDefined();
	});
	await flushPromises();

	return { wrapper, editor };
}

const mountField = (value: unknown, extra: Record<string, unknown> = {}) =>
	mountMd({ ...(field.meta?.options ?? {}), value, ...extra });

const toolbarIds = (wrapper: Awaited<ReturnType<typeof mountMd>>['wrapper']) =>
	wrapper.findAll('[data-toolbar]').map((b) => b.attributes('data-toolbar'));

describe('input-rich-text-md', () => {
	it('is registered with the Directus config and loads the editor lazily', () => {
		expect(config).toMatchObject({ id: 'input-rich-text-md', icon: 'functions', types: ['text'], group: 'standard' });
		expect((config.component as ReturnType<typeof defineAsyncComponent>).name).toBe('AsyncComponentWrapper');
		const options = config.options as { standard: { field: string }[]; advanced: { field: string }[] };
		expect(options.standard.map((o) => o.field)).toEqual(['toolbar', 'placeholder', 'folder', 'imageToken']);
		expect(options.advanced.map((o) => o.field)).toEqual([
			'softLength',
			'editorFont',
			'previewFont',
			'defaultView',
			'customSyntax',
		]);
	});

	it('shows the seeded fixture value without emitting; the preview is sanitized markdown', async () => {
		const { wrapper, editor } = await mountField(seeded);

		expect(editor.getValue()).toBe(seeded);
		const preview = wrapper.get('.preview-box');
		expect(preview.find('h1').text()).toBe('Title');
		expect(preview.find('strong').text()).toBe('bold');
		expect(preview.find('img').attributes('src')).toBe('/assets/bo-4.png');
		expect(wrapper.emitted('input')).toBeUndefined();

		const xss = await mountField('<img src=x onerror="alert(1)"><script>alert(1)</script>ok');
		expect(xss.wrapper.get('.preview-box').html()).not.toMatch(/onerror|<script/);
		expect(xss.wrapper.emitted('input')).toBeUndefined();
	});

	it('missing options use the component defaults (editor view, default toolbar, sans-serif fonts)', async () => {
		const { wrapper, editor } = await mountMd({ value: null });

		expect(wrapper.find('.preview-box').exists()).toBe(false);
		expect(wrapper.find('.CodeMirror').isVisible()).toBe(true);
		expect(toolbarIds(wrapper)).toEqual(DEFAULT_TOOLBAR);
		expect(wrapper.get('.bo-md-editor').attributes('style')).toContain('--bo-md-font: var(--font-outfit)');
		expect(editor.getOption('mode')).toBe('markdown');
		expect(editor.getOption('lineWrapping')).toBe(true);
		expect(wrapper.find('[data-remaining]').exists()).toBe(false);
	});

	it('option:input-rich-text-md.defaultView and the edit/preview switch', async () => {
		const { wrapper } = await mountField(seeded);
		const items = wrapper.findAll('.view [role="radio"], .view button');

		expect(wrapper.classes()).toContain('preview');
		expect(toolbarIds(wrapper)).toEqual([]);
		expect(items.map((i) => i.text())).toEqual(['Edit', 'Preview']);
		expect(items[1]!.attributes('data-state')).toBe('on');

		await items[0]!.trigger('click');
		expect(wrapper.classes()).toContain('editor');
		expect(wrapper.find('.preview-box').exists()).toBe(false);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	it('option:input-rich-text-md.toolbar shows only the chosen buttons, labelled', async () => {
		const { wrapper } = await mountField('a', { defaultView: 'editor' });

		expect(toolbarIds(wrapper)).toEqual(['heading', 'bold', 'italic', 'code', 'link', 'image', 'custom']);
		expect(wrapper.get('[data-toolbar="bold"]').attributes('aria-label')).toMatch(/^Bold - (Ctrl\+B|⌘B)$/);
		expect(wrapper.get('[data-toolbar="heading"]').attributes('aria-label')).toBe('Heading');
		expect(wrapper.get('[role="toolbar"]').attributes('aria-label')).toBe('Toolbar');
	});

	it('option:input-rich-text-md.placeholder reaches CodeMirror', async () => {
		const { editor } = await mountField(null, { defaultView: 'editor' });
		expect(editor.getOption('placeholder' as never)).toBe('Write markdown');
	});

	it('option:input-rich-text-md.editorFont and option:input-rich-text-md.previewFont', async () => {
		const { wrapper } = await mountField(seeded);

		expect(wrapper.get('.bo-md-editor').attributes('style')).toContain('--bo-md-font: ui-monospace');
		expect(wrapper.get('.preview-box').attributes('style')).toContain('font-family: ui-serif');
	});

	it('option:input-rich-text-md.softLength counts the rendered text', async () => {
		const { wrapper, editor } = await mountField('**ab**', { defaultView: 'editor' });

		expect(wrapper.get('[data-remaining]').text()).toBe('998');

		editor.replaceRange('cd', { line: 0, ch: 6 }, undefined, '+input');
		await flushPromises();
		await wrapper.setProps({ value: '**ab**cd' });
		expect(wrapper.get('[data-remaining]').text()).toBe('996');
	});

	it('option:input-rich-text-md.customSyntax wraps the word in prefix and suffix', async () => {
		const { wrapper, editor } = await mountField('word', { defaultView: 'editor' });

		editor.setCursor({ line: 0, ch: 2 });
		await wrapper.get('[data-toolbar="custom"]').trigger('click');
		expect(wrapper.emitted('input')).toEqual([['==word==']]);
		expect(wrapper.get('[data-toolbar="custom"]').attributes('aria-label')).toBe('Highlight');
	});

	it('option:input-rich-text-md.folder and option:input-rich-text-md.imageToken: the uploaded image is inserted', async () => {
		const { wrapper, editor } = await mountField('', { defaultView: 'editor' });

		await wrapper.get('[data-toolbar="image"]').trigger('click');
		await flushPromises();
		const upload = wrapper.findComponent(BoUpload);
		expect(upload.props('folder')).toBe('bo-2');
		expect(upload.props('fromUrl')).toBe(true);
		expect(upload.props('fromLibrary')).toBe(true);
		expect(wrapper.findComponent(DrawerFiles).props('folder')).toBe('bo-2');

		upload.vm.$emit('input', { id: 'bo-4' });
		await flushPromises();

		const url = `${getApiUrl()}assets/bo-4?access_token=bo-image-token`;
		expect(editor.getValue()).toBe(`![](${url})`);
		expect(wrapper.emitted('input')).toEqual([[`![](${url})`]]);
		expect(wrapper.findComponent(BoUpload).exists()).toBe(false);
	});

	it('image without imageToken; accept comes from the server mimeTypeAllowList', async () => {
		useServerStore().info.files = { mimeTypeAllowList: ['image/png', 'image/jpeg'] } as never;
		const { wrapper } = await mountMd({ value: '' });

		await wrapper.get('[data-toolbar="image"]').trigger('click');
		await flushPromises();
		const upload = wrapper.findComponent(BoUpload);
		expect(upload.props('accept')).toBe('image/png,image/jpeg');

		upload.vm.$emit('input', { id: 'bo-4' });
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[`![](${getApiUrl()}assets/bo-4)`]]);
	});

	it('edits emit the markdown string (bold, list, link, table)', async () => {
		const { wrapper, editor } = await mountMd({ value: 'hello' });

		editor.setCursor({ line: 0, ch: 1 });
		await wrapper.get('[data-toolbar="bold"]').trigger('click');
		expect(wrapper.emitted('input')!.at(-1)).toEqual(['**hello**']);

		editor.execCommand('selectAll');
		await wrapper.get('[data-toolbar="bullist"]').trigger('click');
		expect(wrapper.emitted('input')!.at(-1)).toEqual(['- **hello**']);

		editor.setValue('');
		await wrapper.get('[data-toolbar="link"]').trigger('click');
		expect(wrapper.emitted('input')!.at(-1)).toEqual(['[](url)']);

		editor.setValue('');
		await wrapper.get('[data-toolbar="table"]').trigger('click');
		await flushPromises();
		const create = document.querySelector<HTMLButtonElement>('.table-options button')!;
		create.click();
		await flushPromises();
		expect((wrapper.emitted('input')!.at(-1) as string[])[0]!.split('\n')).toEqual([
			'| Header | Header | Header | Header |',
			'| ------ | ------ | ------ | ------ |',
			'| Cell   | Cell   | Cell   | Cell   |',
			'| Cell   | Cell   | Cell   | Cell   |',
			'| Cell   | Cell   | Cell   | Cell   |',
			'| Cell   | Cell   | Cell   | Cell   |',
		]);
	});

	it('keyboard shortcuts: meta/ctrl+b, ctrl+alt+2 (by key code); none while disabled', async () => {
		const { wrapper, editor } = await mountMd({ value: 'hello' });
		const input = editor.getInputField();

		editor.setCursor({ line: 0, ch: 1 });
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', ctrlKey: true, bubbles: true }));
		expect(wrapper.emitted('input')!.at(-1)).toEqual(['**hello**']);

		editor.setValue('title');
		editor.setCursor({ line: 0, ch: 2 });
		input.dispatchEvent(
			new KeyboardEvent('keydown', { key: '™', code: 'Digit2', metaKey: true, altKey: true, bubbles: true }),
		);
		expect(wrapper.emitted('input')!.at(-1)).toEqual(['## title']);

		await wrapper.setProps({ disabled: true });
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', code: 'KeyI', ctrlKey: true, bubbles: true }));
		expect(wrapper.emitted('input')).toHaveLength(2);
	});

	it('external value changes replace the content without emitting', async () => {
		const { wrapper, editor } = await mountMd({ value: 'a' });

		await wrapper.setProps({ value: 'b' });
		expect(editor.getValue()).toBe('b');
		await wrapper.setProps({ value: null });
		expect(editor.getValue()).toBe('');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	it('disabled: read-only editor, disabled buttons and switch, disabled frame', async () => {
		const { wrapper, editor } = await mountMd({ value: 'a', disabled: true });

		expect(editor.getOption('readOnly')).toBe(true);
		expect(wrapper.get('[data-toolbar="bold"]').attributes('disabled')).toBeDefined();
		expect(wrapper.findComponent(BoEditorFrame).props('disabled')).toBe(true);
		for (const item of wrapper.findAll('.view button')) expect(item.attributes('disabled')).toBeDefined();
	});

	it('nonEditable: no edit buttons, the edit/preview switch stays usable', async () => {
		const { wrapper } = await mountMd({ value: 'a', disabled: true, nonEditable: true });

		expect(toolbarIds(wrapper)).toEqual([]);
		expect(wrapper.findComponent(BoEditorFrame).props('disabled')).toBe(false);
		for (const item of wrapper.findAll('.view button')) expect(item.attributes('disabled')).toBeUndefined();
	});

	it('links the form label, help, error and counter to the CodeMirror input', async () => {
		const a11y = computed(() => ({ inputId: 'f-input', labelId: 'f-label', describedBy: 'f-help', invalid: true }));
		const { wrapper, editor } = await mountMd({ value: 'a', softLength: 10 }, { [FORM_FIELD_A11Y]: a11y });
		const input = editor.getInputField();
		const counterId = wrapper.get('[data-remaining]').attributes('id');

		expect(input.getAttribute('aria-labelledby')).toBe('f-label');
		expect(input.getAttribute('aria-describedby')).toBe(`f-help ${counterId}`);
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(wrapper.get('[role="toolbar"]').attributes('aria-controls')).toBe(input.id);
		expect(wrapper.findComponent(BoEditorFrame).props('invalid')).toBe(true);
	});

	it('mounting with the real files drawer and showing the preview makes no API request', async () => {
		const fetch = mockFixtureApi(loadSnapshot());
		const wrapper = mount(InputRichTextMd, {
			props: { ...(field.meta?.options ?? {}), value: seeded } as never,
			global: { plugins: [i18n] },
			attachTo: document.body,
		});
		await vi.waitFor(() => expect(wrapper.find('.CodeMirror').exists()).toBe(true));
		await flushPromises();

		expect(wrapper.findComponent(DrawerFiles).props('active')).toBe(false);
		expect(calls(fetch)).toEqual([]);
	});
});
