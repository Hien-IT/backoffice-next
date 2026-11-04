// Backoffice (spec 031, D-212, T037, T045, contracts/web.md): the Upload extension dialog in chromium with the upload
// composable mocked: the checks before sending (type, empty file, size limit), the API reason inline and a retry, the
// success path (store refreshed, toast, dialog closed), no closing while sending, and no serious axe violation.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { i18n } from '../../../../../lang/index.ts';
import '../../../../../styles/index.css';
import ExtensionUploadDialog from './ExtensionUploadDialog.vue';

const state = vi.hoisted(() => ({
	upload: undefined as any,
	refresh: undefined as any,
	notify: undefined as any,
	max: { value: null as number | null },
}));

vi.mock('../../../../../composables/use-extension-upload.ts', async () => {
	const { ref } = await import('vue');
	const maxUploadSize = ref<number | null>(null);
	state.max = maxUploadSize;
	state.upload = vi.fn();
	return {
		useExtensionUpload: () => ({ available: ref(true), maxUploadSize, ready: Promise.resolve(true), upload: state.upload }),
	};
});

vi.mock('../../../../../stores/extensions.ts', () => {
	state.refresh = vi.fn(async () => undefined);
	return { useExtensionsStore: () => ({ refresh: state.refresh }) };
});

vi.mock('../../../../../composables/use-notices.ts', () => {
	state.notify = vi.fn();
	return { notify: state.notify };
});

enableAutoUnmount(afterEach);

beforeEach(() => {
	setActivePinia(createPinia());
	state.upload.mockReset();
	state.refresh.mockClear();
	state.notify.mockClear();
	state.max.value = null;
});

function open() {
	return mount(ExtensionUploadDialog, {
		props: { open: true, 'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }) },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

let wrapper: ReturnType<typeof open>;

const dialog = () => document.body.querySelector('[role="dialog"]') as HTMLElement | null;
const input = () => document.body.querySelector('[data-testid="extension-upload-input"]') as HTMLInputElement;
const submitButton = () =>
	[...dialog()!.querySelectorAll('button')].find((b) => b.textContent?.trim().endsWith('Upload')) as HTMLButtonElement;
const alertText = () => dialog()!.querySelector('[role="alert"]')?.textContent?.trim() ?? null;

async function pick(file: File) {
	const transfer = new DataTransfer();
	transfer.items.add(file);
	input().files = transfer.files;
	input().dispatchEvent(new Event('change', { bubbles: true }));
	await flushPromises();
}

async function seriousViolations(root: Element) {
	const { violations } = await axe.run(root, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
	return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
}

const tgz = (bytes = 3, name = 'my-extension-1.0.0.tgz') => new File([new Uint8Array(bytes)], name);

test('open: the title, the warning copy, the Upload button disabled until a file is chosen; no serious axe violation', async () => {
	wrapper = open();
	await flushPromises();

	expect(dialog()!.textContent).toContain('Upload extension');
	expect(dialog()!.textContent).toContain('npm pack');
	expect(submitButton().disabled).toBe(true);
	expect(await seriousViolations(dialog()!)).toEqual([]);
});

test('checks before sending: another type, an empty file, a file over the limit; nothing is sent', async () => {
	wrapper = open();
	await flushPromises();

	await pick(new File(['x'], 'notes.txt'));
	expect(alertText()).toContain('Only .tgz or .tar.gz packages are accepted.');
	expect(submitButton().disabled).toBe(true);

	await pick(tgz(0));
	expect(alertText()).toContain('empty');

	state.max.value = 10;
	await pick(tgz(20));
	expect(alertText()).toContain('larger than the upload limit');

	expect(state.upload).not.toHaveBeenCalled();
	expect(await seriousViolations(dialog()!)).toEqual([]);
});

test('the API reason shows in the dialog, which stays open; a retry succeeds: refresh, toast, closed', async () => {
	state.upload.mockRejectedValueOnce({
		errors: [{ extensions: { code: 'INVALID_PAYLOAD', reason: 'An extension named "x" is already installed (local)' } }],
	});
	state.upload.mockResolvedValueOnce({ id: 'u', schema: { name: 'my-extension' }, meta: { source: 'upload' } });

	wrapper = open();
	await flushPromises();
	await pick(tgz());
	expect(dialog()!.querySelector('[data-testid="extension-upload-file"]')!.textContent).toContain('my-extension-1.0.0.tgz');

	submitButton().click();
	await flushPromises();
	expect(alertText()).toContain('An extension named "x" is already installed (local)');
	expect(dialog()).not.toBeNull();

	submitButton().click();
	await flushPromises();
	expect(state.upload).toHaveBeenCalledTimes(2);
	expect(state.refresh).toHaveBeenCalledOnce();
	expect(state.notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Extension "my-extension" installed.' }));
	expect(wrapper.props('open')).toBe(false);
});

test('a 413 or a limit error of the API is shown by its message; Escape does not close while sending', async () => {
	let finish!: (value: unknown) => void;
	state.upload.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));

	wrapper = open();
	await flushPromises();
	await pick(tgz());
	submitButton().click();
	await flushPromises();

	dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	await flushPromises();
	expect(wrapper.props('open')).toBe(true);
	expect(dialog()!.querySelector('[aria-busy="true"]')).not.toBeNull();

	finish({ id: 'u', schema: { name: 'x' } });
	await flushPromises();
	expect(wrapper.props('open')).toBe(false);

	state.upload.mockRejectedValueOnce({ errors: [{ message: 'too large', extensions: { code: 'CONTENT_TOO_LARGE' } }] });
	await wrapper.setProps({ open: true });
	await flushPromises();
	await pick(tgz());
	submitButton().click();
	await flushPromises();
	expect(alertText()).not.toBeNull();
});
