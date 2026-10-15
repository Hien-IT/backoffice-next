// Feature 015 US5 (T050; FR-040 to FR-046, CHK015 to CHK017, CHK037): the shared image editor on Cropper.js in
// chromium, with a fixed 400×300 PNG. Requests and FormData as Directus image-editor.vue sends them.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import { useSettingsStore } from '../../stores/settings.ts';
import { mockApi } from '../../test-utils/fetch.ts';
import { fixedPngDataUrl } from '../../test-utils/fixed-image.ts';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import ImageEditor from './ImageEditor.vue';

vi.mock('../../utils/get-asset-url.ts', () => ({ getAssetUrl: vi.fn() }));

enableAutoUnmount(afterEach);

const t = (key: string) => i18n.global.t(key);
const IMAGE = {
	type: 'image/png',
	filesize: 1000,
	filename_download: 'bo-edit.png',
	folder: 'folder-1',
	width: 400,
	height: 300,
	focal_point_x: null,
	focal_point_y: null,
};

type Sent = { method: string; path: string; search: string; body: BodyInit | null | undefined };
let sent: Sent[];
let imageUrl: string;

beforeEach(() => {
	setActivePinia(createPinia());
	useSettingsStore().settings = { custom_aspect_ratios: [{ text: 'Banner', value: 4 }] } as never;
	imageUrl = fixedPngDataUrl();
	vi.mocked(getAssetUrl).mockReturnValue(imageUrl);
	sent = [];
	const record = (answer: unknown) => ({ url, init }: { url: URL; init: RequestInit }) => {
		sent.push({ method: init.method ?? 'GET', path: url.pathname, search: url.search, body: init.body });
		return new Response(JSON.stringify({ data: answer }), { headers: { 'Content-Type': 'application/json' } });
	};
	mockApi({
		'GET /files/file-1': record(IMAGE),
		'PATCH /files/file-1': record({ id: 'file-1' }),
		'POST /files': record({ id: 'file-2' }),
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function mountEditor(props: Record<string, unknown> = {}) {
	return mount(ImageEditor, {
		props: { id: 'file-1', modelValue: true, ...props },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const dimensions = () => document.querySelector('.dimensions')!.textContent!.trim();

async function ready() {
	await vi.waitFor(() => expect(document.querySelector('.cropper-container')).not.toBeNull(), { timeout: 15000 });
}

test('opens on the file: fields, nonce asset URL, toolbar, dimensions, save disabled without edits; axe', async () => {
	mountEditor();
	await ready();

	expect(sent[0]).toMatchObject({ method: 'GET', path: '/files/file-1' });
	expect(decodeURIComponent(sent[0]!.search)).toContain(
		'fields=type,filesize,filename_download,folder,width,height,focal_point_x,focal_point_y',
	);
	expect(vi.mocked(getAssetUrl).mock.calls[0]![0]).toMatch(/^file-1\?.{21}$/);

	expect(document.querySelector('[role="dialog"]')!.textContent).toContain(t('editing_image'));
	expect(document.querySelector('[role="dialog"]')!.textContent).toContain(t('changes_are_permanent'));
	expect(button(t('move_tool')).getAttribute('aria-pressed')).toBe('true');
	expect(button(t('crop_tool')).getAttribute('aria-pressed')).toBe('false');
	expect(dimensions()).toBe('400x300');
	expect(button(t('save')).disabled).toBe(true);

	const { violations } = await axe.run(document.querySelector('[role="dialog"]')!, {
		runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
	});
	expect(
		violations
			.filter((v) => v.impact === 'serious' || v.impact === 'critical')
			.map((v) => `${v.id}: ${v.nodes.map((node) => node.html).join(' | ')}`),
	).toEqual([]);
});

test('rotate shows the new size and saves the cropped image as FormData with the file name and type', async () => {
	const wrapper = mountEditor();
	await ready();

	button(t('rotate')).click();
	await vi.waitFor(() => expect(dimensions()).toBe('400x300 -> 300x400'));
	expect(button(t('save')).disabled).toBe(false);

	button(t('save')).click();
	await vi.waitFor(() => expect(wrapper.emitted('refresh')).toHaveLength(1));

	const patch = sent.find((s) => s.method === 'PATCH')!;
	expect(patch.path).toBe('/files/file-1');
	const form = patch.body as FormData;
	expect([...form.keys()]).toEqual(['file']);
	const file = form.get('file') as File;
	expect(file.name).toBe('bo-edit.png');
	expect(file.type).toBe('image/png');

	// The PNG keeps the rotated size.
	const bitmap = await createImageBitmap(file);
	expect([bitmap.width, bitmap.height]).toEqual([300, 400]);
	expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
});

test('the focal point alone is a JSON PATCH of its center', async () => {
	mountEditor();
	await ready();

	button(t('focal_point_tool')).click();
	await vi.waitFor(() => expect(button(t('save')).disabled).toBe(false));
	expect(document.querySelector('.image-editor')!.classList.contains('focal-point')).toBe(true);
	expect(document.body.textContent).toContain(t('cancel_selection'));

	button(t('save')).click();
	await vi.waitFor(() => expect(sent.some((s) => s.method === 'PATCH')).toBe(true));

	const patch = sent.find((s) => s.method === 'PATCH')!;
	expect(JSON.parse(String(patch.body))).toEqual({ focal_point_x: 200, focal_point_y: 150 });
});

test('save as a new file posts the folder then the file and emits new-file; hidden without create', async () => {
	const wrapper = mountEditor({ createAllowed: true });
	await ready();

	button(t('rotate')).click();
	await vi.waitFor(() => expect(button(t('save')).disabled).toBe(false));

	await userEvent.click(button(t('options')));
	await userEvent.click(document.querySelector<HTMLElement>('[role="menuitem"]')!);
	await vi.waitFor(() => expect(wrapper.emitted('new-file')).toEqual([['file-2']]));

	const post = sent.find((s) => s.method === 'POST')!;
	const form = post.body as FormData;
	expect([...form.keys()]).toEqual(['folder', 'file']);
	expect(form.get('folder')).toBe('folder-1');

	wrapper.unmount();
	mountEditor({ createAllowed: false });
	await ready();
	expect(button(t('options'))).toBeNull();
});

test('aspect ratio menu: custom ratios first then a separator, the current one checked; cancel crop', async () => {
	mountEditor();
	await ready();

	await userEvent.click(button(t('aspect_ratio')));
	// The item text without the icon ligature (BoIcon is aria-hidden).
	const label = (item: Element) =>
		[...item.childNodes]
			.filter((node) => node instanceof Text || (node instanceof HTMLElement && node.getAttribute('aria-hidden') !== 'true'))
			.map((node) => node.textContent)
			.join('')
			.trim();
	const items = [...document.querySelectorAll('[role="menuitemradio"]')].map(label);
	expect(items).toEqual(['Banner', '16:9', '3:2', '5:4', '7:5', t('square'), t('free'), t('original')]);
	expect(document.querySelector('[role="menu"] [role="separator"]')).not.toBeNull();
	expect(label(document.querySelector('[aria-checked="true"]')!)).toBe(t('original'));

	await userEvent.click([...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')][1]!);
	await vi.waitFor(() => expect(button(t('save')).disabled).toBe(false));
	expect(document.body.textContent).toContain(t('cancel_crop'));
});

test('an image that does not load shows the error notice and keeps save disabled (CHK017)', async () => {
	vi.mocked(getAssetUrl).mockReturnValue('data:image/png;base64,broken');
	mountEditor();

	await vi.waitFor(() => expect(document.body.textContent).toContain(t('unexpected_error')));
	expect(button(t('save')).disabled).toBe(true);
});
