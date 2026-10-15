// The real Editor.js 2.31.2 in chromium (FR-062, FR-094): the seeded value renders without an emit, typing emits
// {time, version, blocks}, disabled is read-only, and a file from the upload drawer reaches the image block with
// fileId / fileURL / url built on the API URL.
import { userEvent } from '@vitest/browser/context';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getApiUrl } from '../../api/sdk.ts';
import BoDrawer from '../../components/drawers/BoDrawer.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import InputBlockEditor from './InputBlockEditor.vue';

vi.mock('vue-router', async (importOriginal) => ({
	...(await importOriginal<typeof import('vue-router')>()),
	useRouter: () => ({ push: vi.fn() }),
}));

const field = fieldsOf('bo_std').find((f) => f.field === 'block_editor')!;
const seeded = itemOf('bo_std', 1)['block_editor'] as Record<string, any>;

let wrapper: ReturnType<typeof mount> | undefined;

beforeEach(() => {
	setActivePinia(createPinia());
	useCollectionsStore().collections = [{ collection: 'directus_files' } as never];
});

afterEach(() => {
	wrapper?.unmount();
	wrapper = undefined;
});

async function mountEditor(props: Record<string, unknown>) {
	wrapper = mount(InputBlockEditor, {
		props: { ...field.meta!.options, ...props } as never,
		global: { plugins: [i18n], stubs: { DrawerFiles: true } },
		attachTo: document.body,
	});
	await vi.waitFor(() => expect(wrapper!.find('.codex-editor').exists()).toBe(true));
	// Editor.js first shows one empty block, then renders the value: wait for every block of the value (slow CI runners).
	const blocks = (props['value'] as { blocks?: unknown[] } | null)?.blocks?.length ?? 1;
	await vi.waitFor(() => expect(wrapper!.findAll('.ce-block').length).toBeGreaterThanOrEqual(blocks), {
		timeout: 10_000,
	});
	await flushPromises();
	return wrapper;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

test('the seeded value renders (sanitized) without emitting; typing emits the Editor.js output', async () => {
	const wrapper = await mountEditor({ value: seeded });

	expect(wrapper.get('.ce-header').text()).toBe('Heading');
	expect(wrapper.get('.ce-paragraph').html()).toContain('Hello <b>world</b>');
	expect(wrapper.find('.image-tool').exists()).toBe(true);
	await settle();
	expect(wrapper.emitted('input')).toBeUndefined();

	const paragraph = wrapper.get('.ce-paragraph').element as HTMLElement;
	paragraph.focus();
	const range = document.createRange();
	range.selectNodeContents(paragraph);
	range.collapse(false);
	getSelection()!.removeAllRanges();
	getSelection()!.addRange(range);
	await userEvent.keyboard('!');

	await vi.waitFor(() => expect(wrapper.emitted('input')).toBeDefined(), { timeout: 10_000 });
	const output = wrapper.emitted('input')!.at(-1)![0] as Record<string, any>;
	expect(output).toMatchObject({ time: expect.any(Number), version: '2.31.2' });
	expect(output['blocks'].map((b: any) => b.type)).toEqual(['header', 'paragraph', 'image']);
	expect(output['blocks'][1].data.text.replace(/<\/?b>/g, '')).toBe('Hello world!');
});

test('a null value shows the placeholder; disabled is read-only', async () => {
	const wrapper = await mountEditor({ value: null, disabled: true });

	await vi.waitFor(() => expect(wrapper.get('.ce-paragraph').attributes('contenteditable')).toBe('false'));
	expect(wrapper.get('.ce-paragraph').attributes('data-placeholder-active')).toBe('Write blocks');
	await settle();
	expect(wrapper.emitted('input')).toBeUndefined();
});

test('the image tool takes a file from the upload drawer (fileId, fileURL, url on the API URL)', async () => {
	const wrapper = await mountEditor({ value: { blocks: [{ id: 'img', type: 'image', data: {} }] } });

	(wrapper.get('.image-tool .cdx-button').element as HTMLElement).click();
	await vi.waitFor(() => expect(wrapper.findComponent(BoUpload).exists()).toBe(true));

	wrapper.findComponent(BoUpload).vm.$emit('input', {
		id: 'bo-4',
		width: 1,
		height: 1,
		filesize: 68,
		filename_download: 'sample.png',
		title: 'Sample',
	});

	await vi.waitFor(() => expect(wrapper.emitted('input')).toBeDefined(), { timeout: 10_000 });
	const output = wrapper.emitted('input')!.at(-1)![0] as Record<string, any>;
	expect(output['blocks'][0]).toMatchObject({
		type: 'image',
		data: {
			file: {
				width: 1,
				height: 1,
				size: 68,
				name: 'sample.png',
				title: 'Sample',
				extension: 'png',
				fileId: 'bo-4',
				fileURL: `${getApiUrl()}files/bo-4`,
				url: `${getApiUrl()}assets/bo-4`,
			},
		},
	});
	expect(wrapper.findComponent(BoDrawer).props('modelValue')).toBe(false);
});
