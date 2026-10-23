// Ported from directus/app/src/interfaces/input-block-editor/input-block-editor.test.ts
// Backoffice: real pinia stores (collections set directly) instead of store mocks; the two DR tests are kept
// as they are. Added (contracts/tests.md §5): config, fixture value, defaults, every FR-062 option, emitted shape,
// disabled, the files drawer and the label linking. The real Editor.js runs in InputBlockEditor.browser.test.ts.
import EditorJS from '@editorjs/editorjs';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, type defineAsyncComponent } from 'vue';
import { getApiUrl } from '../../api/sdk.ts';
import BoEditorFrame from '../../components/BoEditorFrame.vue';
import BoDrawer from '../../components/drawers/BoDrawer.vue';
import DrawerFiles from '../../components/drawers/DrawerFiles.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useServerStore } from '../../stores/server.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import { useBus } from './bus.ts';
import config from './index.ts';
import InputBlockEditor from './InputBlockEditor.vue';
import getTools from './tools.ts';

const push = vi.fn();

vi.mock('@editorjs/editorjs', () => ({ default: vi.fn() }));
vi.mock('./tools', () => ({ default: vi.fn(() => ({})) }));
vi.mock('./tools.ts', () => ({ default: vi.fn(() => ({})) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

enableAutoUnmount(afterEach);

beforeEach(() => {
	setActivePinia(createPinia());
	push.mockReset();
	vi.mocked(getTools).mockClear();
	vi.mocked(EditorJS).mockClear();
});

const global = () => ({
	plugins: [i18n],
	directives: { 'prevent-focusout': {} },
	stubs: { VDrawer: true, VUpload: true, DrawerFiles: true },
});

function fakeEditor(save: () => Promise<any> = vi.fn().mockResolvedValue({ blocks: [] })) {
	const editor = {
		isReady: Promise.resolve(),
		render: vi.fn().mockResolvedValue(undefined),
		clear: vi.fn(),
		destroy: vi.fn(),
		focus: vi.fn(),
		on: vi.fn(),
		saver: { save },
		readOnly: { toggle: vi.fn() },
	};

	vi.mocked(EditorJS).mockImplementation(() => editor as any);

	return editor;
}

const editorConfig = () => vi.mocked(EditorJS).mock.calls[0]![0] as EditorJS.EditorConfig;

describe('InputBlockEditor', () => {
	it('should render content before toggling readOnly on concurrent prop change', async () => {
		const callOrder: string[] = [];
		let resolveReady!: () => void;
		let resolveRender!: () => void;

		vi.mocked(EditorJS).mockImplementation(
			() =>
				({
					isReady: new Promise<void>((r) => (resolveReady = r)),
					render: vi.fn(() => {
						callOrder.push('render');
						return new Promise<void>((r) => (resolveRender = r));
					}),
					clear: vi.fn(),
					destroy: vi.fn(),
					focus: vi.fn(),
					on: vi.fn(),
					saver: { save: vi.fn().mockResolvedValue({ blocks: [] }) },
					readOnly: {
						toggle: vi.fn((val: boolean) => callOrder.push(`toggle:${val}`)),
					},
				}) as any,
		);

		const wrapper = mount(InputBlockEditor, {
			props: {
				disabled: false,
				value: { blocks: [{ type: 'paragraph', data: { text: 'initial' } }] },
			},
			global: global(),
		});

		// Complete initial mount
		resolveReady();
		await flushPromises();
		resolveRender();
		await flushPromises();
		callOrder.length = 0;

		// Both props change in the same tick — triggers disabled + value watchers
		await wrapper.setProps({
			disabled: true,
			value: { blocks: [{ type: 'paragraph', data: { text: 'updated' } }] },
		});

		await flushPromises();

		// Without the fix, the sync disabled watcher fires toggle before the value watcher calls render
		expect(callOrder.indexOf('render')).toBeLessThan(callOrder.indexOf('toggle:true'));

		resolveRender();
		await flushPromises();
		wrapper.unmount();
	});

	it('should not clear content when value becomes null while disabled', async () => {
		// This test should prevent a regression that results in data loss when the value is temporarily null and the field is disabled
		const clear = vi.fn();

		vi.mocked(EditorJS).mockImplementation(
			() =>
				({
					isReady: Promise.resolve(),
					render: vi.fn().mockResolvedValue(undefined),
					clear,
					destroy: vi.fn(),
					focus: vi.fn(),
					on: vi.fn(),
					saver: { save: vi.fn().mockResolvedValue({ blocks: [] }) },
					readOnly: {
						toggle: vi.fn(),
					},
				}) as any,
		);

		const wrapper = mount(InputBlockEditor, {
			props: {
				disabled: false,
				value: { blocks: [{ type: 'paragraph', data: { text: 'initial' } }] },
			},
			global: global(),
		});

		await flushPromises();

		await wrapper.setProps({ disabled: true });
		await flushPromises();

		await wrapper.setProps({ value: null });
		await flushPromises();

		expect(clear).not.toHaveBeenCalled();

		wrapper.unmount();
	});
});

describe('input-block-editor (Backoffice)', () => {
	const field = fieldsOf('bo_std').find((f) => f.field === 'block_editor')!;
	const seeded = itemOf('bo_std', 1)['block_editor'] as Record<string, any>;

	async function mountEditor(props: Record<string, unknown>, provide: Record<symbol, unknown> = {}) {
		const wrapper = mount(InputBlockEditor, { props: props as never, global: { ...global(), provide } });
		await flushPromises();
		return wrapper;
	}

	it('is registered with the Directus config and loads Editor.js lazily', () => {
		expect(config).toMatchObject({ id: 'input-block-editor', icon: 'code', types: ['json'], group: 'standard' });
		expect((config.component as ReturnType<typeof defineAsyncComponent>).name).toBe('AsyncComponentWrapper');
		expect((config.options as { field: string }[]).map((o) => o.field)).toEqual([
			'placeholder',
			'font',
			'tools',
			'bordered',
			'folder',
		]);
	});

	it('renders the sanitized seeded fixture value without emitting', async () => {
		const editor = fakeEditor();
		const wrapper = await mountEditor({ ...field.meta!.options, value: seeded });

		expect(editor.render).toHaveBeenCalledWith(seeded);
		expect(editor.readOnly.toggle).toHaveBeenCalledWith(false);
		expect(editor.on).toHaveBeenCalledWith('redactor dom changed', expect.any(Function));
		expect(wrapper.emitted('input')).toBeUndefined();

		const empty = await mountEditor({ value: null });
		expect(empty.emitted('input')).toBeUndefined();
	});

	it('missing options use the component defaults (tools, sans-serif, bordered)', async () => {
		fakeEditor();
		const wrapper = await mountEditor({ value: null });

		expect(getTools).toHaveBeenCalledWith(
			expect.objectContaining({ baseURL: getApiUrl() }),
			['header', 'nestedlist', 'code', 'image', 'paragraph', 'checklist', 'quote', 'underline'],
			false,
		);
		expect(editorConfig()).toMatchObject({ readOnly: false, minHeight: 72, placeholder: false });
		expect(wrapper.get('.editor').classes()).toEqual(expect.arrayContaining(['font-outfit', 'bordered']));
		expect(wrapper.findComponent(BoEditorFrame).exists()).toBe(true);
	});

	it('option:input-block-editor.placeholder, option:input-block-editor.font, option:input-block-editor.tools, option:input-block-editor.bordered', async () => {
		fakeEditor();
		const wrapper = await mountEditor({ ...field.meta!.options, value: null });

		expect(editorConfig().placeholder).toBe('Write blocks');
		expect(wrapper.get('.editor').classes()).toContain('font-[family-name:ui-serif,Georgia,serif]');
		expect(vi.mocked(getTools).mock.calls[0]![1]).toEqual(['header', 'paragraph', 'code', 'image', 'table']);
		expect(wrapper.findComponent(BoEditorFrame).exists()).toBe(false);
		expect(wrapper.get('.editor').classes()).not.toContain('bordered');
	});

	it('option:input-block-editor.folder: the upload drawer opens for a tool, its file goes to the tool', async () => {
		fakeEditor();
		useCollectionsStore().collections = [{ collection: 'directus_files' } as never];
		useServerStore().info.files = { mimeTypeAllowList: ['image/*'] } as never;
		const wrapper = await mountEditor({ ...field.meta!.options, value: null });
		const uploader = vi.mocked(getTools).mock.calls[0]![0];

		expect(vi.mocked(getTools).mock.calls[0]![2]).toBe(true);
		expect(wrapper.findComponent(BoDrawer).props('modelValue')).toBe(false);

		const handler = vi.fn();
		uploader.setFileHandler(handler);
		uploader.setCurrentPreview?.('http://localhost/assets/bo-4?key=system-large-contain');
		await flushPromises();

		expect(wrapper.findComponent(BoDrawer).props('modelValue')).toBe(true);
		const upload = wrapper.findComponent(BoUpload);
		expect(upload.props()).toMatchObject({ folder: 'bo-2', fromLibrary: true, fromUrl: true, accept: 'image/*' });
		expect(wrapper.findComponent(DrawerFiles).props('folder')).toBe('bo-2');
		expect(document.querySelector('.uploader-preview-image img')?.getAttribute('src')).toContain('bo-4');

		upload.vm.$emit('input', { id: 'bo-4' });
		await flushPromises();
		expect(handler).toHaveBeenCalledWith({ id: 'bo-4' });
		expect(wrapper.findComponent(BoDrawer).props('modelValue')).toBe(false);
	});

	it('emits the saved {time, version, blocks}; no blocks is null; unchanged blocks emit nothing', async () => {
		const save = vi.fn();
		fakeEditor(save);
		const wrapper = await mountEditor({ value: seeded });
		const onChange = editorConfig().onChange!;
		const edited = { time: 1, version: '2.31.2', blocks: [{ id: 'x', type: 'paragraph', data: { text: 'New' } }] };

		save.mockResolvedValueOnce(seeded);
		onChange({ saver: { save } } as never, {} as never);
		await flushPromises();
		expect(wrapper.emitted('input')).toBeUndefined();

		save.mockResolvedValueOnce(edited);
		onChange({ saver: { save } } as never, {} as never);
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[edited]]);

		save.mockResolvedValueOnce({ time: 2, version: '2.31.2', blocks: [] });
		onChange({ saver: { save } } as never, {} as never);
		await flushPromises();
		expect(wrapper.emitted('input')!.at(-1)).toEqual([null]);
	});

	it('external value changes render or clear the editor', async () => {
		const editor = fakeEditor();
		const wrapper = await mountEditor({ value: null });

		await wrapper.setProps({ value: seeded });
		await flushPromises();
		expect(editor.render).toHaveBeenCalledWith(seeded);

		await wrapper.setProps({ value: null });
		await flushPromises();
		expect(editor.clear).toHaveBeenCalled();
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	it('disabled: read-only editor, no emit, no upload drawer', async () => {
		const editor = fakeEditor(vi.fn().mockResolvedValue({ blocks: [{ type: 'paragraph', data: { text: 'x' } }] }));
		useCollectionsStore().collections = [{ collection: 'directus_files' } as never];
		const wrapper = await mountEditor({ value: seeded, disabled: true });

		expect(editor.readOnly.toggle).toHaveBeenCalledWith(true);
		expect(wrapper.get('.editor').classes()).toEqual(expect.arrayContaining(['disabled', 'pointer-events-none']));
		expect(wrapper.findComponent(BoEditorFrame).props('disabled')).toBe(true);
		expect(wrapper.findComponent(BoDrawer).exists()).toBe(false);

		editorConfig().onChange!(editor as never, {} as never);
		await flushPromises();
		expect(wrapper.emitted('input')).toBeUndefined();

		const nonEditable = await mountEditor({ value: seeded, disabled: true, nonEditable: true });
		expect(nonEditable.findComponent(BoEditorFrame).props('disabled')).toBe(false);
	});

	it('autofocus focuses the editor once ready', async () => {
		const editor = fakeEditor();
		await mountEditor({ value: null, autofocus: true });
		expect(editor.focus).toHaveBeenCalled();
	});

	it('"Open Image" (bus open-url) goes to the file route of the app', async () => {
		fakeEditor();
		await mountEditor({ value: null });

		useBus().emit({ type: 'open-url', payload: `${getApiUrl()}files/bo-4` });
		expect(push).toHaveBeenCalledWith('/files/bo-4');
	});

	it('the editor is a group labelled by the form label, with help, error and invalid frame', async () => {
		fakeEditor();
		const a11y = computed(() => ({ inputId: 'f-input', labelId: 'f-label', describedBy: 'f-help', invalid: true }));
		const wrapper = await mountEditor({ value: null }, { [FORM_FIELD_A11Y]: a11y });
		const group = wrapper.get('.editor');

		expect(group.attributes()).toMatchObject({
			role: 'group',
			'aria-labelledby': 'f-label',
			'aria-describedby': 'f-help',
			'aria-invalid': 'true',
		});
		expect(wrapper.findComponent(BoEditorFrame).props('invalid')).toBe(true);
	});

	it('destroys the editor on unmount', async () => {
		const editor = fakeEditor();
		const wrapper = await mountEditor({ value: null });

		wrapper.unmount();
		expect(editor.destroy).toHaveBeenCalled();
	});

	it('unmounted before Editor.js is ready: the mount stops without touching the destroyed instance', async () => {
		let ready!: () => void;
		const editor = { ...fakeEditor(), isReady: new Promise<void>((resolve) => (ready = resolve)) };
		vi.mocked(EditorJS).mockImplementation(() => editor as any);
		const wrapper = mount(InputBlockEditor, { props: { value: seeded } as never, global: global() });

		wrapper.unmount();
		ready();
		await flushPromises();

		expect(editor.destroy).toHaveBeenCalled();
		expect(editor.render).not.toHaveBeenCalled();
		expect(editor.on).not.toHaveBeenCalled();
	});
});
