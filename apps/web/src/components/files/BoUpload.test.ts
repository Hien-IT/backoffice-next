// Ported from directus/app/src/components/v-upload.test.ts
// Backoffice: mounted with our components and a stubbed fetch (no files store, tooltip directive or outlets); the
// upload, import, validation and selection tests are ours.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { assertOnlyKnownRequests, calls, json, mockApi } from '../../test-utils/fetch.ts';
import BoUpload from './BoUpload.vue';

enableAutoUnmount(afterEach);

beforeEach(async () => {
	setActivePinia(createPinia());
	// No rate limit in these tests (the app queue lets 5 requests through every 500 ms).
	await replaceQueue();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const global = { plugins: [i18n] };

function file(name: string, type: string, content = 'data') {
	return new File([content], name, { type });
}

function select(wrapper: ReturnType<typeof mount>, files: File[]) {
	const input = wrapper.get('input[type="file"]').element as HTMLInputElement;
	Object.defineProperty(input, 'files', { value: files, configurable: true });
	input.dispatchEvent(new Event('input'));
}

describe('Component', () => {
	it('should mount', () => {
		const wrapper = mount(BoUpload, {
			global,
		});

		expect(wrapper.exists()).toBe(true);
	});

	it('should render disabled class when disabled', () => {
		const wrapper = mount(BoUpload, {
			props: {
				disabled: true,
			},
			global,
		});

		expect(wrapper.find('.v-upload').classes()).toContain('disabled');
	});

	it('should render action buttons disabled when disabled', () => {
		const wrapper = mount(BoUpload, {
			props: {
				fromLibrary: true,
				disabled: true,
			},
			global,
		});

		const buttons = wrapper.findAll('.actions button');

		expect(buttons.length).toBe(2);

		buttons.forEach((button) => {
			expect(button.attributes('disabled')).toBeDefined();
		});
	});
});

describe('upload', () => {
	it('posts multipart /files with the preset and folder before the file and emits the file', async () => {
		const fetch = mockApi({ 'POST /files': { id: 'f1', title: 'a' } });
		const wrapper = mount(BoUpload, { props: { folder: 'folder-1', preset: { title: 'A title' } }, global });

		select(wrapper, [file('a.png', 'image/png')]);
		await flushPromises();

		expect(calls(fetch)).toEqual(['POST /files']);
		assertOnlyKnownRequests(calls(fetch));
		const body = fetch.mock.calls[0]![1]!.body as FormData;
		expect([...body.keys()]).toEqual(['title', 'folder', 'file']);
		expect(body.get('folder')).toBe('folder-1');
		expect((body.get('file') as File).name).toBe('a.png');
		expect(wrapper.emitted('input')).toEqual([[{ id: 'f1', title: 'a' }]]);
		expect(wrapper.get('[aria-live="polite"]').text()).toBe('File Uploaded');
	});

	it('multiple: emits the uploaded files and lists an error per failed file', async () => {
		let n = 0;
		mockApi({
			'POST /files': ({ init }: { init: RequestInit }) => {
				const name = ((init.body as FormData).get('file') as File).name;
				if (name === 'big.png')
					return json({ errors: [{ message: 'Too large', extensions: { code: 'CONTENT_TOO_LARGE' } }] }, 413);
				return json({ data: { id: `f${++n}`, filename_download: name } });
			},
		});
		const wrapper = mount(BoUpload, { props: { multiple: true }, global });

		select(wrapper, [file('a.png', 'image/png'), file('big.png', 'image/png'), file('c.png', 'image/png')]);
		await flushPromises();

		const emitted = wrapper.emitted('input')![0]![0] as { filename_download: string }[];
		expect(emitted.map((f) => f.filename_download).sort()).toEqual(['a.png', 'c.png']);
		expect(wrapper.get('[role="alert"]').text()).toBe(`big.png: ${i18n.global.t('errors.CONTENT_TOO_LARGE')}`);
		expect(wrapper.get('.v-upload').classes()).toContain('border-error-600');
	});

	it('shows progress while uploading', async () => {
		let resolve!: (r: Response) => void;
		mockApi({ 'POST /files': () => new Promise<Response>((r) => (resolve = r)) });
		const wrapper = mount(BoUpload, { global });

		select(wrapper, [file('a.png', 'image/png')]);
		await flushPromises();

		expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0');
		expect(wrapper.text()).toContain('Uploading File...');
		expect(wrapper.get('.v-upload').attributes('aria-busy')).toBe('true');

		resolve(json({ data: { id: 'f1' } }));
		await flushPromises();
		expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
	});

	it('refuses files of the wrong type or empty files before any request', async () => {
		const fetch = mockApi({});
		const wrapper = mount(BoUpload, { props: { accept: 'image/*', multiple: true }, global });

		select(wrapper, [file('a.pdf', 'application/pdf'), file('empty.png', 'image/png', '')]);
		await flushPromises();

		expect(fetch).not.toHaveBeenCalled();
		const text = wrapper.get('[role="alert"]').text();
		expect(text).toContain('2 Invalid Files Selected');
		expect(text).toContain('"a.pdf" (application/pdf)');
		expect(text).toContain('image/*');
		expect(text).toContain('"empty.png"');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	it('accept is set on the file input; an exact mime type matches', async () => {
		mockApi({ 'POST /files': { id: 'f1' } });
		const wrapper = mount(BoUpload, { props: { accept: 'image/png, image/jpeg' }, global });

		expect(wrapper.get('input[type="file"]').attributes('accept')).toBe('image/png, image/jpeg');
		select(wrapper, [file('a.jpg', 'image/jpeg')]);
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[{ id: 'f1' }]]);
	});
});

describe('drag and drop', () => {
	function drop(wrapper: ReturnType<typeof mount>, files: File[]) {
		const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
		Object.defineProperty(event, 'dataTransfer', { value: { files } });
		wrapper.get('.v-upload').element.dispatchEvent(event);
	}

	it('shows the drop text while dragging and uploads dropped files', async () => {
		const fetch = mockApi({ 'POST /files': { id: 'f1' } });
		const wrapper = mount(BoUpload, { global });

		await wrapper.get('.v-upload').trigger('dragenter');
		expect(wrapper.get('.v-upload').attributes('data-dragging')).toBe('true');
		expect(wrapper.text()).toContain('Drop to Upload');

		drop(wrapper, [file('a.png', 'image/png')]);
		await flushPromises();
		expect(wrapper.get('.v-upload').attributes('data-dragging')).toBeUndefined();
		expect(calls(fetch)).toEqual(['POST /files']);
	});

	it('ignores drops when disabled or not fromUser', async () => {
		const fetch = mockApi({});
		const disabled = mount(BoUpload, { props: { disabled: true }, global });
		drop(disabled, [file('a.png', 'image/png')]);
		const library = mount(BoUpload, { props: { fromUser: false, fromLibrary: true }, global });
		drop(library, [file('a.png', 'image/png')]);
		await flushPromises();

		expect(fetch).not.toHaveBeenCalled();
		expect(library.text()).toContain('Choose File from Library');
		expect(library.find('input[type="file"]').exists()).toBe(false);
	});
});

describe('from URL and library', () => {
	async function openMenuItem(wrapper: ReturnType<typeof mount>, text: string) {
		const trigger = wrapper.get('.actions button[aria-label="Options"]').element;
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await flushPromises();
		const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((i) =>
			i.textContent?.includes(text),
		)!;
		item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await flushPromises();
	}

	it('imports from a URL with folder and filterMimeType', async () => {
		const fetch = mockApi({ 'POST /files/import': { id: 'f9' } });
		const wrapper = mount(BoUpload, {
			props: { fromUrl: true, folder: 'folder-1', accept: 'image/*', multiple: true },
			global,
			attachTo: document.body,
		});

		await openMenuItem(wrapper, 'Import File from URL');
		const input = document.querySelector<HTMLInputElement>('[role="dialog"] input')!;
		const submit = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) =>
			b.textContent?.includes('Import'),
		)!;

		input.value = 'not a url';
		input.dispatchEvent(new Event('input'));
		await flushPromises();
		expect(submit.disabled).toBe(true);

		input.value = 'https://example.com/a.png';
		input.dispatchEvent(new Event('input'));
		await flushPromises();
		input.closest('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await flushPromises();

		expect(calls(fetch)).toEqual(['POST /files/import']);
		assertOnlyKnownRequests(calls(fetch));
		expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({
			url: 'https://example.com/a.png',
			data: { folder: 'folder-1' },
			options: { filterMimeType: ['image/*'] },
		});
		expect(wrapper.emitted('input')).toEqual([[[{ id: 'f9' }]]]);
		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});

	it('shows the translated error of a refused import', async () => {
		mockApi({
			'POST /files/import': () =>
				json({ errors: [{ message: 'no', extensions: { code: 'UNSUPPORTED_MEDIA_TYPE' } }] }, 415),
		});
		const wrapper = mount(BoUpload, { props: { fromUrl: true }, global, attachTo: document.body });

		await openMenuItem(wrapper, 'Import File from URL');
		const input = document.querySelector<HTMLInputElement>('[role="dialog"] input')!;
		input.value = 'https://example.com/a.pdf';
		input.dispatchEvent(new Event('input'));
		await flushPromises();
		input.closest('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await flushPromises();

		expect(wrapper.get('[role="alert"]').text()).toBe(i18n.global.t('errors.UNSUPPORTED_MEDIA_TYPE'));
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	it('choose from library emits library; setSelection reads the files like Directus', async () => {
		const fetch = mockApi({ 'GET /files': [{ id: 'a' }, { id: 'b' }], 'GET /files/a': { id: 'a' } });
		const multi = mount(BoUpload, { props: { fromLibrary: true, multiple: true }, global, attachTo: document.body });

		await openMenuItem(multi, 'Choose File from Library');
		expect(multi.emitted('library')).toHaveLength(1);

		await (multi.vm as unknown as { setSelection: (s: string[] | null) => Promise<void> }).setSelection(['a', 'b']);
		expect(multi.emitted('input')).toEqual([[[{ id: 'a' }, { id: 'b' }]]]);

		const single = mount(BoUpload, { props: { fromLibrary: true }, global });
		const api = single.vm as unknown as { setSelection: (s: string[] | null) => Promise<void> };
		await api.setSelection(['a']);
		await api.setSelection([]);
		await api.setSelection(null);
		expect(single.emitted('input')).toEqual([[{ id: 'a' }], [null]]);

		expect(calls(fetch)).toEqual(['GET /files?filter={"id":{"_in":["a","b"]}}', 'GET /files/a']);
		assertOnlyKnownRequests(calls(fetch));
	});
});
