// The real TinyMCE 6.8.6 in chromium (FR-060, FR-094): the seeded value renders without an emit, typing emits the HTML,
// disabled is read-only, the image drawer builds the asset URL with the image token, the softLength counter, the
// options of the field reach the TinyMCE config, the link, media and source code tools.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import tinymce from 'tinymce/tinymce.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed } from 'vue';
import { getApiUrl } from '../../api/sdk.ts';
import BoDialog from '../../components/BoDialog.vue';
import BoEditorFrame from '../../components/BoEditorFrame.vue';
import DrawerFiles from '../../components/drawers/DrawerFiles.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import InterfaceInputCode from '../input-code/InputCode.vue';
import InputRichTextHtml from './InputRichTextHtml.vue';

// TinyMCE starts in an iframe: slow on loaded CI runners.
vi.setConfig({ testTimeout: 20_000 });

enableAutoUnmount(afterEach);

const field = fieldsOf('bo_std').find((f) => f.field === 'rich_html')!;
const seeded = itemOf('bo_std', 1)['rich_html'] as string;

const PNG = {
	id: 'bo-4',
	filename_disk: 'bo-4.png',
	filename_download: 'bo-sample.png',
	title: 'bo-sample-png',
	type: 'image/png',
	width: 1,
	height: 1,
};

beforeEach(() => {
	setActivePinia(createPinia());
});

/** Mounts the interface and waits for TinyMCE's `init` (the content is set and the component handlers are bound). */
async function mountHtml(props: Record<string, unknown>, provide: Record<symbol, unknown> = {}) {
	const wrapper = mount(InputRichTextHtml, {
		props: props as never,
		global: { plugins: [i18n], provide, stubs: { DrawerFiles: true } },
		attachTo: document.body,
	});

	const editor = await vi.waitFor(
		() => {
			const id = wrapper.find('textarea').attributes('id');
			const found = id ? tinymce.get(id) : null;
			expect(found?.initialized).toBe(true);
			return found!;
		},
		{ timeout: 15_000 },
	);
	await flushPromises();

	return { wrapper, editor };
}

const mountField = (value: unknown, extra: Record<string, unknown> = {}) =>
	mountHtml({ ...(field.meta?.options ?? {}), value, ...extra });

const body = (editor: any) => editor.getBody() as HTMLElement;

const lastInput = (wrapper: VueWrapper) => wrapper.emitted('input')?.at(-1)?.[0];

const settle = () => new Promise((resolve) => setTimeout(resolve, 300)).then(() => flushPromises());

/** Puts the caret at the end of the editor content and focuses it (TinyMCE `focus` starts the content watcher). */
function caretAtEnd(editor: any) {
	editor.focus();
	editor.selection.select(body(editor), true);
	editor.selection.collapse(false);
}

const button = (label: string) => document.querySelector<HTMLButtonElement>(`.tox-tbtn[aria-label="${label}"]`)!;

describe('input-rich-text-html in chromium', () => {
	test('the seeded value renders without emitting; typing emits the HTML', async () => {
		const { wrapper, editor } = await mountField(seeded);

		expect(body(editor).querySelector('strong')?.textContent).toBe('world');
		expect(body(editor).querySelector('img')?.getAttribute('src')).toBe('/assets/bo-4.png?access_token=bo-image-token');
		await settle();
		expect(wrapper.emitted('input')).toBeUndefined();

		const typed = await mountHtml({ value: '<p>Hello</p>' });
		caretAtEnd(typed.editor);
		await userEvent.keyboard('!');

		await vi.waitFor(() => expect(lastInput(typed.wrapper)).toBe('<p>Hello!</p>'));

		typed.editor.setContent('');
		await vi.waitFor(() => expect(lastInput(typed.wrapper)).toBeNull());
	});

	test('disabled is read-only and emits nothing', async () => {
		const { wrapper, editor } = await mountHtml({ value: '<p>Hello</p>', disabled: true });

		await vi.waitFor(() => expect(editor.mode.isReadOnly()).toBe(true));
		expect(body(editor).getAttribute('contenteditable')).toBe('false');
		expect(wrapper.findComponent(BoEditorFrame).props('disabled')).toBe(true);
		expect(button('Bold').getAttribute('aria-disabled')).toBe('true');

		caretAtEnd(editor);
		await userEvent.keyboard('!');
		await settle();
		expect(wrapper.emitted('input')).toBeUndefined();

		await wrapper.setProps({ disabled: false });
		await vi.waitFor(() => expect(editor.mode.isReadOnly()).toBe(false));
	});

	test('option:input-rich-text-html.folder and option:input-rich-text-html.imageToken: image from the drawer', async () => {
		const { wrapper, editor } = await mountField(null);

		caretAtEnd(editor);
		button('Add/Edit Image').click();
		const upload = await vi.waitFor(() => {
			const found = wrapper.findComponent(BoUpload);
			expect(found.exists()).toBe(true);
			return found;
		});
		expect(upload.props('folder')).toBe('bo-2');
		expect(upload.props('fromLibrary')).toBe(true);
		expect(wrapper.findComponent(DrawerFiles).props('folder')).toBe('bo-2');

		upload.vm.$emit('input', PNG);
		await flushPromises();

		const url = `${getApiUrl()}assets/bo-4.png?access_token=bo-image-token`;
		const preview = document.querySelector<HTMLImageElement>('.image-preview')!;
		expect(preview.getAttribute('src')).toBe(url);

		document.querySelector<HTMLButtonElement>('.bo-drawer button[aria-label="Save Image"]')!.click();

		await vi.waitFor(() =>
			expect(lastInput(wrapper)).toBe(`<p><img src="${url}&amp;width=1&amp;height=1" alt="bo-sample-png"></p>`),
		);
		await vi.waitFor(() => expect(document.querySelector('.bo-drawer')).toBeNull());
	});

	test('image: a preset key replaces width and height; lazy loading; no image token', async () => {
		useSettingsStore().settings = {
			storage_asset_transform: 'all',
			storage_asset_presets: [{ key: 'thumb', width: 64, height: 32 }],
		} as never;
		const { wrapper, editor } = await mountHtml({ value: null });

		caretAtEnd(editor);
		button('Add/Edit Image').click();
		await vi.waitFor(() => expect(wrapper.findComponent(BoUpload).exists()).toBe(true));
		wrapper.findComponent(BoUpload).vm.$emit('input', { ...PNG, filename_disk: null });
		await flushPromises();

		const url = `${getApiUrl()}assets/bo-4.png`;
		expect(document.querySelector('.image-preview')!.getAttribute('src')).toBe(url);
		expect(document.querySelector('.bo-drawer')!.textContent).toContain('Transformation Preset Key');

		const lazy = document.querySelector<HTMLButtonElement>('.bo-drawer [role="checkbox"]')!;
		lazy.click();
		await flushPromises();

		// BoSelect is a Reka Select: set the key the way its update event does.
		const select = wrapper.findAllComponents({ name: 'BoSelect' })[0]!;
		select.vm.$emit('update:modelValue', 'thumb');
		await flushPromises();

		document.querySelector<HTMLButtonElement>('.bo-drawer button[aria-label="Save Image"]')!.click();
		await vi.waitFor(() =>
			expect(lastInput(wrapper)).toBe(`<p><img src="${url}?key=thumb" alt="bo-sample-png" loading="lazy"></p>`),
		);
	});

	test('option:input-rich-text-html.softLength counts the text of the editor', async () => {
		const { wrapper, editor } = await mountHtml({ value: '<p>abc</p>', softLength: 10 });

		expect(wrapper.get('[data-remaining]').text()).toBe('7');

		caretAtEnd(editor);
		await userEvent.keyboard('d');
		await vi.waitFor(() => expect(wrapper.get('[data-remaining]').text()).toBe('6'));

		const none = await mountHtml({ value: '<p>abc</p>' });
		expect(none.wrapper.find('[data-remaining]').exists()).toBe(false);
	});

	test('option:input-rich-text-html.toolbar maps the old button names; the default toolbar', async () => {
		const legacy = await mountHtml({
			value: null,
			toolbar: ['bold', 'link', 'media', 'code', 'image', 'pre', 'inlinecode'],
		});
		expect(legacy.editor.options.get('toolbar')).toBe(
			'bold customLink customMedia customCode customImage customPre customInlineCode',
		);
		legacy.wrapper.unmount();

		const { editor } = await mountHtml({ value: null });
		expect(editor.options.get('toolbar')).toBe(
			'bold italic underline h1 h2 h3 numlist bullist removeformat blockquote customLink customImage customMedia hr customCode fullscreen',
		);
		expect(editor.options.get('extended_valid_elements')).toBe('audio[loop|controls],source[src|type]');
		expect(editor.options.get('convert_urls')).toBe(false);
		expect(editor.options.get('paste_data_images')).toBe(false);
		expect(editor.options.get('link_default_protocol')).toBe('https');
		expect(editor.options.get('ui_mode')).toBe('split');
		expect(editor.options.get('menubar')).toBe(false);
	});

	test('option:input-rich-text-html.toolbar empty hides the toolbar', async () => {
		const { editor } = await mountHtml({ value: null, toolbar: [] });
		expect(editor.options.get('toolbar')).toBe(false);
	});

	test('option:input-rich-text-html.customFormats adds the styles menu', async () => {
		const { editor } = await mountField(null);

		expect(editor.options.get('toolbar')).toMatch(/ styles$/);
		expect(editor.options.get('style_formats')).toMatchObject([
			{ title: 'Big', inline: 'span', styles: { 'font-size': '2em' } },
		]);
	});

	test('option:input-rich-text-html.tinymceOverrides are merged last', async () => {
		const { editor } = await mountHtml({
			value: null,
			tinymceOverrides: { link_default_protocol: 'http', paste_data_images: true },
		});

		expect(editor.options.get('link_default_protocol')).toBe('http');
		expect(editor.options.get('paste_data_images')).toBe(true);
	});

	test('option:input-rich-text-html.font sets the content font', async () => {
		const serif = await mountField(null);
		expect(serif.editor.options.get('content_style')).toContain('font-family: ui-serif, Georgia, serif');

		const mono = await mountHtml({ value: null, font: 'monospace' });
		expect(getComputedStyle(body(mono.editor)).fontFamily).toBeTruthy();
		expect(mono.editor.options.get('content_style')).toContain(
			'font-family: ui-monospace, SFMono-Regular, Menlo, monospace, serif',
		);
	});

	test('the link dialog wraps the selection; Enter saves', async () => {
		const { wrapper, editor } = await mountHtml({ value: '<p>Hello</p>' });

		editor.focus();
		const range = editor.dom.createRng();
		range.selectNodeContents(body(editor).querySelector('p')!);
		editor.selection.setRng(range);

		button('Add/Edit Link').click();
		await vi.waitFor(() => expect(wrapper.findComponent(BoDialog).props('open')).toBe(true));

		const url = document.querySelector<HTMLInputElement>('[role="dialog"] input')!;
		await userEvent.fill(url, 'https://example.test');
		await userEvent.keyboard('{Enter}');

		await vi.waitFor(() =>
			expect(lastInput(wrapper)).toBe('<p><a href="https://example.test" target="_blank" rel="noopener">Hello</a></p>'),
		);
		expect(wrapper.findComponent(BoDialog).props('open')).toBe(false);
	});

	test('the media drawer inserts a video of an uploaded file', async () => {
		const { wrapper, editor } = await mountHtml({ value: null, imageToken: 'tok' });

		caretAtEnd(editor);
		button('Add/Edit Media').click();
		await vi.waitFor(() => expect(wrapper.findComponent(BoUpload).exists()).toBe(true));

		wrapper.findComponent(BoUpload).vm.$emit('input', { id: 'bo-v', type: 'video/mp4', width: null, height: null });
		await flushPromises();

		document.querySelector<HTMLButtonElement>('.bo-drawer button[aria-label="Save Media"]')!.click();
		const src = `${getApiUrl()}assets/bo-v?access_token=tok`;
		await vi.waitFor(() =>
			expect(lastInput(wrapper)).toBe(
				`<p><video controls="controls" width="300" height="150"><source src="${src}" type="video/mp4"></video></p>`,
			),
		);
	});

	test('the source code drawer replaces the content', async () => {
		const { wrapper } = await mountHtml({ value: '<p>a</p>' });

		button('Edit Source Code').click();
		const code = await vi.waitFor(() => {
			const found = wrapper.findComponent(InterfaceInputCode);
			expect(found.exists()).toBe(true);
			return found;
		});
		expect(code.props('value')).toBe('<p>a</p>');

		code.vm.$emit('input', '<h2>b</h2>');
		await flushPromises();
		document.querySelector<HTMLButtonElement>('.bo-drawer button[aria-label="Save"]')!.click();

		await vi.waitFor(() => expect(lastInput(wrapper)).toBe('<h2>b</h2>'));
	});

	test('the iframe is labelled by the form label, help and counter; non-editable shows the value', async () => {
		const a11y = computed(() => ({ inputId: 'in', labelId: 'lbl', describedBy: 'help', invalid: true }));
		const { wrapper, editor } = await mountHtml({ value: '<p>x</p>', softLength: 5 }, { [FORM_FIELD_A11Y]: a11y });

		const iframe = editor.iframeElement as HTMLIFrameElement;
		const counter = wrapper.get('[data-remaining]').attributes('id');
		expect(iframe.getAttribute('aria-labelledby')).toBe('lbl');
		expect(iframe.getAttribute('aria-describedby')).toBe(`help ${counter}`);
		expect(iframe.getAttribute('aria-invalid')).toBe('true');
		expect(wrapper.findComponent(BoEditorFrame).props('invalid')).toBe(true);

		const readonly = mount(InputRichTextHtml, {
			props: { value: '<p>compare</p>', nonEditable: true } as never,
			global: { plugins: [i18n], stubs: { DrawerFiles: true } },
			attachTo: document.body,
		});
		await vi.waitFor(
			() => expect(tinymce.get(readonly.find('textarea').attributes('id')!)?.getContent()).toBe('<p>compare</p>'),
			{ timeout: 15_000 },
		);
		expect(readonly.findComponent(BoEditorFrame).props('disabled')).toBe(false);
	});
});
