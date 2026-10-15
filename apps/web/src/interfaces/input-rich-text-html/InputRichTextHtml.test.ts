// Directus tests only useImage (useImage.test.ts); contracts/tests.md §5: the config, the content CSS and the toolbar
// composables against a fake TinyMCE editor (the real editor runs in InputRichTextHtml.browser.test.ts).
import type { SettingsStorageAssetPreset } from '@directus/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type defineAsyncComponent, nextTick, ref } from 'vue';
import { getApiUrl } from '../../api/sdk.ts';
import getEditorStyles from './get-editor-styles.ts';
import config from './index.ts';
import toolbarDefault from './toolbar-default.ts';
import useImage from './useImage.ts';
import useInlineCode from './useInlineCode.ts';
import useLink from './useLink.ts';
import useMedia from './useMedia.ts';
import usePre from './usePre.ts';
import useSourceCode from './useSourceCode.ts';

function fakeEditor(content = '') {
	const handlers: Record<string, ((event: any) => void)[]> = {};

	return {
		handlers,
		fire: vi.fn(),
		on: vi.fn((name: string, handler: (event: any) => void) => (handlers[name] ??= []).push(handler)),
		off: vi.fn(),
		getContent: vi.fn(() => content),
		setContent: vi.fn(),
		execCommand: vi.fn(),
		undoManager: { add: vi.fn() },
		plugins: { fullscreen: { isFullscreen: vi.fn(() => false) } },
		formatter: { match: vi.fn(() => false), formatChanged: vi.fn(() => ({ unbind: vi.fn() })) },
		selection: {
			getContent: vi.fn(() => ''),
			setContent: vi.fn(),
			getNode: vi.fn(),
			select: vi.fn(),
			setNode: vi.fn(),
			setCursorLocation: vi.fn(),
		},
		nodeChanged: vi.fn(),
		dom: { remove: vi.fn() },
	};
}

const presets = (list: Partial<SettingsStorageAssetPreset>[] = []) => ({
	storageAssetTransform: ref('all'),
	storageAssetPresets: ref(list as SettingsStorageAssetPreset[]),
});

afterEach(() => {
	document.documentElement.classList.remove('dark');
	document.body.removeAttribute('style');
});

describe('input-rich-text-html config', () => {
	it('is registered with the Directus config and loads the editor lazily', () => {
		expect(config).toMatchObject({
			id: 'input-rich-text-html',
			icon: 'format_quote',
			types: ['text'],
			group: 'standard',
		});
		expect((config.component as ReturnType<typeof defineAsyncComponent>).name).toBe('AsyncComponentWrapper');

		const options = config.options as { standard: any[]; advanced: any[] };
		expect(options.standard.map((o) => o.field)).toEqual(['toolbar', 'font', 'folder', 'imageToken']);
		expect(options.advanced.map((o) => o.field)).toEqual(['softLength', 'customFormats', 'tinymceOverrides']);
		expect(options.standard[0].schema.default_value).toBe(toolbarDefault);
		expect(options.standard[0].meta.options.choices).toHaveLength(46);
		expect(options.standard[1].schema.default_value).toBe('sans-serif');
	});
});

describe('get-editor-styles', () => {
	it('reads the light or dark tokens and the font of the option; diff styles only on request', () => {
		document.body.style.setProperty('--color-brand-100', 'light-selection');
		document.body.style.setProperty('--color-gray-700', 'dark-selection');

		const light = getEditorStyles('serif');
		expect(light).toContain('::selection {\n\tbackground: light-selection;');
		expect(light).toContain('font-family: ui-serif, Georgia, serif;');
		expect(light).not.toContain('comparison-diff');

		document.documentElement.classList.add('dark');
		const dark = getEditorStyles('monospace', true);
		expect(dark).toContain('::selection {\n\tbackground: dark-selection;');
		expect(dark).toContain('font-family: ui-monospace, SFMono-Regular, Menlo, monospace, serif;');
		expect(dark).toContain('.comparison-diff--added');
	});
});

describe('useImage', () => {
	const svg = { id: 'bo-5', filename_disk: 'bo-5.svg', title: 'bo-sample-svg', type: 'image/svg+xml', width: null };

	it('saves <img> with width and height of the file, even null (as Directus)', () => {
		const editor = fakeEditor();
		const { imageSelection, onImageSelect, saveImage, imageDrawerOpen } = useImage(
			ref(editor),
			ref(undefined),
			presets(),
		);

		imageDrawerOpen.value = true;
		onImageSelect({ ...svg, height: null } as never);
		saveImage();

		expect(editor.fire).toHaveBeenCalledWith('focus');
		expect(editor.selection.setContent).toHaveBeenCalledWith(
			`<img src="${getApiUrl()}assets/bo-5.svg?width=null&height=null" alt="bo-sample-svg" />`,
		);
		expect(editor.undoManager.add).toHaveBeenCalled();
		expect([imageSelection.value, imageDrawerOpen.value]).toEqual([null, false]);
	});

	it('presets mode keeps only the key; none adds no query', () => {
		const presetsMode = presets([{ key: 'thumb', width: 10, height: 20 }]);
		presetsMode.storageAssetTransform.value = 'presets';
		const editor = fakeEditor();
		const image = useImage(ref(editor), ref('tok'), presetsMode);

		image.onImageSelect(svg as never);
		image.imageSelection.value!.transformationKey = 'thumb';
		image.imageSelection.value!.lazy = true;
		image.saveImage();
		expect(editor.selection.setContent).toHaveBeenLastCalledWith(
			`<img src="${getApiUrl()}assets/bo-5.svg?access_token=tok&key=thumb" alt="bo-sample-svg" loading="lazy" />`,
		);

		presetsMode.storageAssetTransform.value = 'none';
		image.onImageSelect(svg as never);
		image.saveImage();
		expect(editor.selection.setContent).toHaveBeenLastCalledWith(
			`<img src="${getApiUrl()}assets/bo-5.svg?access_token=tok" alt="bo-sample-svg" />`,
		);
	});

	it('the button edits a selected image: url, alt, lazy, size or preset from the query', async () => {
		const editor = fakeEditor();
		const image = useImage(ref(editor), ref('tok'), presets([{ key: 'thumb', width: 10, height: 20 }]));
		const img = document.createElement('img');
		img.setAttribute('src', `${getApiUrl()}assets/bo-4.png?key=thumb`);
		img.setAttribute('alt', 'a');
		img.setAttribute('loading', 'lazy');
		editor.selection.getNode.mockReturnValue(img);

		const api = { isActive: () => true, setActive: vi.fn() };
		image.imageButton.onAction(api);
		expect(image.imageSelection.value).toEqual({
			imageUrl: `${getApiUrl()}assets/bo-4.png?key=thumb`,
			alt: 'a',
			lazy: true,
			width: 10,
			height: 20,
			transformationKey: 'thumb',
			previewUrl: `${getApiUrl()}assets/bo-4.png?key=thumb&access_token=tok`,
		});

		// The drawer closes in between, in another tick (the watcher clears the preset of the previous image).
		await nextTick();
		image.closeImageDrawer();
		await nextTick();
		img.setAttribute('src', `${getApiUrl()}assets/bo-4.png?width=3&height=4`);
		image.imageButton.onAction(true);
		expect(image.imageSelection.value).toMatchObject({ width: 3, height: 4, transformationKey: undefined });

		image.imageButton.onAction({ isActive: () => false });
		expect(image.imageSelection.value).toBeNull();

		// Choosing a preset copies its size (watch on transformationKey).
		image.onImageSelect(svg as never);
		image.imageSelection.value!.transformationKey = 'thumb';
		await nextTick();
		expect(image.imageSelection.value).toMatchObject({ width: 10, height: 20 });

		const off = image.imageButton.onSetup(api);
		editor.handlers['NodeChange']![0]!({ element: img });
		expect(api.setActive).toHaveBeenCalledWith(true);
		off();
		expect(editor.off).toHaveBeenCalledWith('NodeChange', expect.any(Function));
	});
});

describe('useLink', () => {
	it('a URL selection becomes the url, other text the display text; saveLink writes the anchor', () => {
		const editor = fakeEditor();
		const link = useLink(ref(editor));

		editor.selection.getContent.mockReturnValue('https://example.test/');
		link.linkButton.onAction({});
		expect(link.linkDrawerOpen.value).toBe(true);
		expect(link.linkSelection.value).toEqual({
			url: 'https://example.test/',
			displayText: null,
			title: null,
			newTab: true,
		});

		editor.selection.getContent.mockReturnValue('Hello');
		link.linkButton.onAction({});
		expect(link.linkSelection.value.displayText).toBe('Hello');
		expect(link.isLinkSaveable.value).toBe(false);
		link.saveLink();
		expect(editor.selection.setContent).not.toHaveBeenCalled();

		link.linkSelection.value = { url: 'https://a.test', displayText: 'Hello', title: 'Tip', newTab: false };
		link.saveLink();
		expect(editor.selection.setContent).toHaveBeenCalledWith('<a href="https://a.test" title="Tip"  >Hello</a>');
		expect(link.linkDrawerOpen.value).toBe(false);
	});

	it('edits the link around the caret; an empty url unlinks', () => {
		const editor = fakeEditor();
		const link = useLink(ref(editor));
		const api = { setActive: vi.fn() };
		const a = document.createElement('a');
		a.setAttribute('href', 'https://old.test');
		a.setAttribute('target', '_blank');
		a.innerHTML = '<b>bold</b>';
		const b = a.firstElementChild!;

		link.linkButton.onSetup(api);
		editor.handlers['NodeChange']![0]!({ element: b });
		expect(api.setActive).toHaveBeenCalledWith(true);

		link.linkButton.onAction({});
		expect(link.linkSelection.value).toMatchObject({ url: 'https://old.test', newTab: true });

		link.linkSelection.value = { url: 'https://new.test', displayText: 'new', title: 't', newTab: false };
		link.saveLink();
		expect(a.outerHTML).toBe(
			'<a href="https://new.test" target="_self" data-mce-href="https://new.test" title="t"><b>new</b></a>',
		);

		link.linkButton.onAction({});
		link.linkSelection.value.url = null;
		link.saveLink();
		expect(editor.selection.setContent).toHaveBeenLastCalledWith(a.innerText);
	});
});

describe('useMedia', () => {
	it('an uploaded video becomes the embed code; the embed code drives the selection', async () => {
		const editor = fakeEditor('<p>x</p>');
		const media = useMedia(ref(editor), ref('tok'));

		media.mediaButton.onAction({ isActive: () => false });
		media.onMediaSelect({ id: 'bo-v', type: 'audio/mpeg' });
		await nextTick();
		const src = `${getApiUrl()}assets/bo-v?access_token=tok`;
		expect(media.embed.value).toBe(
			`<audio width="300" height="150" controls><source src="${src}" type="audio/mpeg" /></audio>`,
		);

		media.mediaWidth.value = 640;
		await nextTick();
		expect(media.embed.value).toContain('width="640"');

		media.embed.value = '<iframe src="https://video.test/1" width="10" height="20"></iframe>';
		await nextTick();
		expect(media.mediaSelection.value).toMatchObject({ tag: 'iframe', sourceUrl: 'https://video.test/1', width: 10 });

		media.mediaSource.value = 'https://video.test/2';
		expect(media.mediaSelection.value?.previewUrl).toBe('https://video.test/2');

		media.saveMedia();
		expect(editor.selection.setContent).toHaveBeenCalled();
		expect(media.mediaDrawerOpen.value).toBe(false);
		expect(media.openMediaTab.value).toEqual(['video']);
	});

	it('editing a selected media replaces it in the content', async () => {
		const editor = fakeEditor('<p><video src="a"></video></p>');
		const media = useMedia(ref(editor), ref(undefined));
		editor.selection.getContent.mockReturnValue('<video src="a"></video>');

		media.mediaButton.onAction({ isActive: () => true });
		expect(media.embed.value).toBe('<video src="a"></video>');
		media.embed.value = '<video src="b"></video>';
		media.saveMedia();
		expect(editor.setContent).toHaveBeenCalledWith('<p><video src="b"></video></p>');

		const api = { setActive: vi.fn() };
		media.mediaButton.onSetup(api);
		const span = document.createElement('span');
		span.className = 'mce-preview-object';
		editor.handlers['NodeChange']![0]!({ element: span });
		expect(api.setActive).toHaveBeenCalledWith(true);

		media.embed.value = '';
		media.saveMedia();
		expect(editor.undoManager.add).toHaveBeenCalledTimes(1);
	});
});

describe('useSourceCode, usePre, useInlineCode', () => {
	it('the source code drawer edits the whole content', () => {
		const editor = fakeEditor('<p>a</p>');
		const source = useSourceCode(ref(editor));

		source.sourceCodeButton.onAction();
		expect([source.codeDrawerOpen.value, source.code.value]).toEqual([true, '<p>a</p>']);
		source.code.value = '<p>b</p>';
		source.saveCode();
		expect(editor.setContent).toHaveBeenCalledWith('<p>b</p>');
		expect(source.codeDrawerOpen.value).toBe(false);
	});

	it('pre and inline code toggle their format; Enter leaves inline code', () => {
		const editor = fakeEditor();
		const { preButton } = usePre(ref(editor));
		const { inlineCodeButton } = useInlineCode(ref(editor));

		preButton.onAction();
		expect(editor.execCommand.mock.calls).toEqual([['removeformat'], ['mceToggleFormat', false, 'pre']]);
		inlineCodeButton.onAction();
		expect(editor.execCommand).toHaveBeenLastCalledWith('mceToggleFormat', false, 'code');

		const api = { setActive: vi.fn() };
		const offCode = inlineCodeButton.onSetup(api);
		const code = document.createElement('code');
		editor.selection.getNode.mockReturnValue(code);
		const enter = { key: 'Enter', preventDefault: vi.fn() };
		editor.handlers['keydown']![0]!(enter);
		expect(enter.preventDefault).toHaveBeenCalled();
		expect(editor.execCommand).toHaveBeenLastCalledWith('removeformat');
		offCode();

		const offPre = preButton.onSetup(api);
		const pre = document.createElement('pre');
		editor.selection.getNode.mockReturnValue(pre);
		editor.handlers['keydown']![1]!({ key: 'Backspace', preventDefault: vi.fn() });
		expect(editor.dom.remove).toHaveBeenCalledWith(pre);
		offPre();
	});

	it('the fourth Enter at the end of a pre leaves it for a new paragraph', () => {
		const editor = fakeEditor();
		Object.assign(editor.dom, {
			is: (node: Node, selector: string) => node.nodeName.toLowerCase() === selector,
			getParent: vi.fn(),
			create: (tag: string, _attrs: unknown, html: string) =>
				Object.assign(document.createElement(tag), { innerHTML: html }),
			insertAfter: (node: Node, reference: Element) => reference.after(node),
		});
		const { preButton } = usePre(ref(editor));
		preButton.onSetup({ setActive: vi.fn() });

		const root = document.createElement('div');
		root.innerHTML = '<pre>a<br><br><br></pre>';
		const pre = root.firstElementChild!;
		editor.selection.getNode.mockReturnValue(pre);
		const enter = () => editor.handlers['keydown']![0]!({ key: 'Enter', preventDefault: vi.fn() });

		enter();
		expect(root.innerHTML).toBe('<pre>a<br><br><br></pre>');

		pre.append(document.createElement('br'));
		enter();
		expect(root.innerHTML).toBe('<pre>a<br></pre><p><br></p>');
		expect(editor.selection.setCursorLocation).toHaveBeenCalledWith(root.lastElementChild, 0);
		expect(editor.nodeChanged).toHaveBeenCalled();
	});
});
