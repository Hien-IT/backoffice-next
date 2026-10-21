// Spec 020 T111: VUpload on BoUpload: `start` with the TUS controller (one for all files with `multiple`), the exposed
// `abort`, and "Choose from library" opening DrawerFiles whose selection BoUpload emits.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../api/sdk.ts';
import BoUpload from '../../components/files/BoUpload.vue';
import { i18n } from '../../lang/index.ts';
import { mockApi } from '../../test-utils/fetch.ts';
import type { UploadFileOptions } from '../../utils/upload-file.ts';
import VUpload from './VUpload.vue';

const uploads = vi.hoisted(
	() => [] as { options: UploadFileOptions; abort: ReturnType<typeof vi.fn>; done: () => void }[],
);

vi.mock('../../utils/upload-file.ts', () => ({
	uploadFile: (file: File, options: UploadFileOptions) =>
		new Promise((resolve) => {
			const abort = vi.fn();
			uploads.push({ options, abort, done: () => resolve({ id: file.name }) });
			options.onChunkedUpload?.({ start: vi.fn(), abort });
		}),
}));

enableAutoUnmount(afterEach);

beforeEach(async () => {
	uploads.length = 0;
	setActivePinia(createPinia());
	await replaceQueue();
});

afterEach(() => vi.unstubAllGlobals());

const global = { plugins: [i18n], stubs: { DrawerFiles: true } };

function select(wrapper: ReturnType<typeof mount>, files: File[]) {
	const input = wrapper.get('input[type="file"]').element as HTMLInputElement;
	Object.defineProperty(input, 'files', { value: files, configurable: true });
	input.dispatchEvent(new Event('input'));
}

const file = (name: string) => new File(['data'], name, { type: 'image/png' });

describe('VUpload', () => {
	test('single: start emits the controller, abort aborts it, input emits the file', async () => {
		const wrapper = mount(VUpload, { global });

		select(wrapper, [file('a.png')]);
		await flushPromises();

		expect(wrapper.emitted('start')).toHaveLength(1);
		(wrapper.vm as unknown as { abort: () => void }).abort();
		expect(uploads[0]!.abort).toHaveBeenCalledOnce();

		uploads[0]!.done();
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[{ id: 'a.png' }]]);
	});

	test('multiple: one start once every file started; its abort aborts all', async () => {
		const wrapper = mount(VUpload, { props: { multiple: true }, global });

		select(wrapper, [file('a.png'), file('b.png')]);
		await flushPromises();

		expect(wrapper.emitted('start')).toHaveLength(1);
		const [controller] = wrapper.emitted('start')![0] as [{ abort: () => void }];
		controller.abort();
		expect(uploads.map((upload) => upload.abort.mock.calls.length)).toEqual([1, 1]);

		uploads.forEach((upload) => upload.done());
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[[{ id: 'a.png' }, { id: 'b.png' }]]]);
	});

	test('fromLibrary: the library action opens DrawerFiles; its selection is emitted as the file', async () => {
		mockApi({ 'GET /files/f1': { id: 'f1' } });
		const wrapper = mount(VUpload, { props: { fromLibrary: true, folder: 'folder-1' }, global });
		const drawer = wrapper.getComponent({ name: 'DrawerFiles' });

		expect(drawer.props('active')).toBe(false);
		wrapper.getComponent(BoUpload).vm.$emit('library');
		await flushPromises();
		expect(drawer.props()).toMatchObject({ active: true, folder: 'folder-1' });

		drawer.vm.$emit('input', ['f1']);
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[{ id: 'f1' }]]);
	});

	test('the props reach BoUpload', () => {
		const wrapper = mount(VUpload, { props: { fromUser: false, accept: 'image/*', disabled: true }, global });

		expect(wrapper.getComponent(BoUpload).props()).toMatchObject({
			fromUser: false,
			accept: 'image/*',
			disabled: true,
		});
	});
});
