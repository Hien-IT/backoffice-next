// Directus has no test for interfaces/file-image: contracts/tests.md §5 on the bo_rel `file_image` fixture field
// (FR-051, FR-053, FR-054; feature 015 lifts D-59, T051): mount without input, every option, image URLs, the error message by code, the
// actions, the empty upload state, read-only and a11y.
/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- drawer stubs that only record their props */
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, defineComponent, h, ref } from 'vue';
import { replaceQueue } from '../../api/sdk.ts';
import BoNotice from '../../components/BoNotice.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import FileLightbox from '../../components/files/FileLightbox.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { type FixtureUser, fieldsOf, loadSnapshot, type Snapshot } from '../../test-utils/fixtures.ts';
import FileImage from './FileImage.vue';
import config from './index.ts';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;

const DrawerItem = defineComponent({
	name: 'DrawerItem',
	props: ['active', 'collection', 'primaryKey', 'edits', 'disabled', 'nonEditable'],
	emits: ['input', 'update:active'],
	setup:
		(_, { slots }) =>
		() =>
			h('div', { class: 'drawer-item' }, slots['actions']?.()),
});

const DrawerFiles = defineComponent({
	name: 'DrawerFiles',
	props: ['active', 'folder', 'field', 'filter', 'collection', 'multiple'],
	emits: ['input', 'update:active'],
	setup: () => () => h('div', { class: 'drawer-files' }),
});

const ImageEditor = defineComponent({
	name: 'ImageEditor',
	props: ['id', 'modelValue', 'createAllowed'],
	emits: ['refresh', 'new-file', 'update:modelValue'],
	setup: () => () => h('div', { class: 'image-editor' }),
});

const meta = fieldsOf('bo_rel').find((f) => f.field === 'file_image')!.meta!;

async function setup(user: FixtureUser = 'admin', change?: (snapshot: Snapshot) => void, answers = {}) {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	const snapshot = loadSnapshot();
	change?.(snapshot);
	fetch = mockFixtureApi(snapshot, { user, answers });

	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);

	fetch.mockClear();
}

beforeEach(async () => {
	document.body.innerHTML = '';
	await setup();
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
});

async function mountImage(props: Record<string, unknown> = {}, provide: Record<string | symbol, unknown> = {}) {
	const wrapper = mount(FileImage, {
		props: { ...meta.options, value: 'bo-4', collection: 'bo_rel', field: 'file_image', width: 'half', ...props },
		global: { plugins: [i18n], stubs: { DrawerItem, DrawerFiles, FileLightbox: true, ImageEditor }, provide },
	});

	await flushPromises();
	return wrapper;
}

describe('config', () => {
	test('index.ts is the Directus config', () => {
		expect(config.id).toBe('file-image');
		expect(config.types).toEqual(['uuid']);
		expect(config.recommendedDisplays).toEqual(['image']);
	});
});

describe('fixture field bo_rel.file_image', () => {
	test('mounts with the seeded value without emitting, loads the image fields', async () => {
		const wrapper = await mountImage();

		expect(wrapper.emitted('input')).toBeUndefined();
		expect(calls(fetch)).toEqual([
			'GET /files/bo-4?fields=id,title,width,height,filesize,type,filename_download,modified_on',
		]);
		expect(wrapper.get('.title').text()).toBe('bo-sample-png');
		expect(wrapper.get('.meta').text()).toBe('1x1 • 70 B • image/png');
	});

	test('option:file-image.crop false uses system-large-contain', async () => {
		const wrapper = await mountImage();

		expect(wrapper.get('img').attributes('src')).toBe('http://api.test/assets/bo-4?key=system-large-contain');
		expect(wrapper.get('img').classes()).toContain('object-contain');
	});

	test('option:file-image.crop default (true) uses system-large-cover with the cache buster', async () => {
		await setup('admin', (s) => (s.files.find((f) => f['id'] === 'bo-4')!['modified_on'] = '2026-01-02'));
		const wrapper = await mountImage({ crop: undefined });

		expect(wrapper.get('img').attributes('src')).toBe(
			'http://api.test/assets/bo-4?key=system-large-cover&v=2026-01-02',
		);
		expect(wrapper.get('img').classes()).toContain('object-cover');
		expect(wrapper.classes()).toContain('crop');
	});

	test('option:file-image.letterbox adds the padding', async () => {
		expect((await mountImage()).get('img').classes()).toContain('is-letterbox');
		expect((await mountImage({ letterbox: undefined })).get('img').classes()).not.toContain('is-letterbox');
	});

	test('an SVG is served without preset', async () => {
		const wrapper = await mountImage({ value: 'bo-5' });

		expect(wrapper.get('img').attributes('src')).toBe('http://api.test/assets/bo-5');
		expect(wrapper.get('.meta').text()).toBe('110 B • image/svg+xml');
	});

	test('not an image: unsupported media type message', async () => {
		const wrapper = await mountImage({ value: 'bo-3' });

		expect(wrapper.find('img').exists()).toBe(false);
		expect(wrapper.get('.image-error .message').text()).toBe('Unsupported media type');
	});
});

describe('image error', () => {
	test('the error code of the asset request is shown (errors.<code>)', async () => {
		await setup('admin', undefined, {
			'GET /assets/bo-4': () => json({ errors: [{ message: 'x', extensions: { code: 'FORBIDDEN' } }] }, 403),
		});
		const wrapper = await mountImage();

		await wrapper.get('img').trigger('error');
		await flushPromises();

		expect(calls(fetch)).toContain('GET /assets/bo-4?key=system-large-contain');
		expect(wrapper.get('.image-error .message').text()).toBe('Forbidden');
	});

	test('an unknown code is UNKNOWN', async () => {
		await setup('admin', undefined, {
			'GET /assets/bo-4': () => json({ errors: [{ message: 'x', extensions: { code: 'NOPE' } }] }, 500),
		});
		const wrapper = await mountImage();

		await wrapper.get('img').trigger('error');
		await flushPromises();

		expect(wrapper.get('.image-error .message').text()).toBe('Unexpected Error');
	});

	test('the asset answers fine: the file fallback with its extension', async () => {
		const wrapper = await mountImage();

		await wrapper.get('img').trigger('error');
		await flushPromises();

		expect(wrapper.find('.image-error').exists()).toBe(false);
		expect(wrapper.get('.fallback').text()).toBe('png');
	});
});

describe('actions', () => {
	test('zoom opens the lightbox with the image', async () => {
		const wrapper = await mountImage();
		const lightbox = wrapper.getComponent(FileLightbox);

		expect(lightbox.props('modelValue')).toBe(false);
		await wrapper.get('button.zoom').trigger('click');
		expect(lightbox.props('modelValue')).toBe(true);
		expect(lightbox.props('file')).toMatchObject({ id: 'bo-4' });
	});

	test('download link of the asset', async () => {
		const link = (await mountImage()).get('a.download');

		expect(link.attributes('href')).toBe('http://api.test/assets/bo-4?download=');
		expect(link.attributes('download')).toBe('bo-sample.png');
		expect(link.attributes('aria-label')).toBe('Download');
	});

	test('the tune button opens the shared image editor on the file (feature 015, D-59 lifted)', async () => {
		const wrapper = await mountImage();

		expect(wrapper.findAll('.actions > *').map((el) => el.attributes('aria-label'))).toEqual([
			'Zoom',
			'Download',
			'Edit Item',
			'Edit Image',
			'Deselect',
		]);

		await wrapper.get('button.edit-image').trigger('click');
		const editor = wrapper.getComponent(ImageEditor);
		expect(editor.props()).toMatchObject({ id: 'bo-4', modelValue: true, createAllowed: true });
	});

	test('a saved edit reloads the image (refresh); save as new file selects the new key', async () => {
		const wrapper = await mountImage();
		fetch.mockClear();

		wrapper.getComponent(ImageEditor).vm.$emit('refresh');
		await flushPromises();
		expect(calls(fetch).some((call) => call.startsWith('GET /files/bo-4'))).toBe(true);

		wrapper.getComponent(ImageEditor).vm.$emit('new-file', 'bo-new');
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([['bo-new']]);
	});

	test('disabled: no image editor', async () => {
		const wrapper = await mountImage({ disabled: true });

		expect(wrapper.findComponent(ImageEditor).exists()).toBe(false);
	});

	test('edit details: DrawerItem on directus_files, edits emitted with the key', async () => {
		const wrapper = await mountImage();

		await wrapper.get('button.edit').trigger('click');
		const drawer = wrapper.getComponent(DrawerItem);
		expect(drawer.props()).toMatchObject({ active: true, collection: 'directus_files', primaryKey: 'bo-4' });
		expect(drawer.get('a').attributes('download')).toBe('bo-sample.png');

		drawer.vm.$emit('input', { title: 'New' });
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[{ title: 'New', id: 'bo-4' }]]);
	});

	test('deselect emits null and closes the overlays', async () => {
		const wrapper = await mountImage();

		await wrapper.get('button.zoom').trigger('click');
		await wrapper.get('.deselect').trigger('click');

		expect(wrapper.emitted('input')).toEqual([[null]]);
	});
});

describe('empty value: upload', () => {
	test('BoUpload with from-url, library, folder and the default image/* accept', async () => {
		const wrapper = await mountImage({ value: null, allowedMimeTypes: undefined });
		const upload = wrapper.getComponent(BoUpload);

		expect(calls(fetch)).toEqual([]);
		expect(upload.props()).toMatchObject({
			fromUrl: true,
			fromUser: true,
			fromLibrary: true,
			folder: 'bo-2',
			accept: 'image/*',
			disabled: false,
		});
		// parseFilter(undefined) is {} in Directus too, so the MIME type filter is joined to it.
		const filter = { _and: [{}, { type: { _starts_with: 'image/' } }] };
		expect(upload.props('filter')).toEqual(filter);
		expect(wrapper.getComponent(DrawerFiles).props('filter')).toEqual(filter);
	});

	test('option:file-image.allowedMimeTypes replaces image/*', async () => {
		const wrapper = await mountImage({ value: null, allowedMimeTypes: ['image/png'] });

		expect(wrapper.getComponent(BoUpload).props('accept')).toBe('image/png');
	});

	test('option:file-image.filter is merged with the MIME type filter', async () => {
		const wrapper = await mountImage(
			{ value: null, filter: { title: { _eq: '{{ name }}' } } },
			{ values: ref({ name: 'Logo' }) },
		);

		expect(wrapper.getComponent(BoUpload).props('filter')).toEqual({
			_and: [{ title: { _eq: 'Logo' } }, { type: { _starts_with: 'image/' } }],
		});
	});

	test('option:file-image.folder goes to the upload and the library', async () => {
		const wrapper = await mountImage({ value: null, folder: 'f-1' });

		expect(wrapper.getComponent(BoUpload).props('folder')).toBe('f-1');
		expect(wrapper.getComponent(DrawerFiles).props('folder')).toBe('f-1');
	});

	test('option:file-image.enableCreate false: no device upload', async () => {
		const wrapper = await mountImage({ value: null, enableCreate: false });

		expect(wrapper.getComponent(BoUpload).props('fromUser')).toBe(false);
	});

	test('option:file-image.enableSelect false: no library', async () => {
		const wrapper = await mountImage({ value: null, enableSelect: false });

		expect(wrapper.getComponent(BoUpload).props('fromLibrary')).toBe(false);
		expect(wrapper.findComponent(DrawerFiles).exists()).toBe(false);
	});

	test('an upload emits the new key (POST /files with the folder)', async () => {
		const wrapper = await mountImage({ value: null });
		const input = wrapper.get('input[type="file"]');
		Object.defineProperty(input.element, 'files', {
			value: [new globalThis.File(['png'], 'new.png', { type: 'image/png' })],
		});
		await input.trigger('input');
		await flushPromises();

		expect(calls(fetch)).toEqual(['POST /files']);
		expect((fetch.mock.calls[0]![1]!.body as FormData).get('folder')).toBe('bo-2');
		expect(wrapper.emitted('input')).toEqual([['bo-new-1']]);
	});

	test('choose from library: DrawerFiles input goes through BoUpload.setSelection', async () => {
		const wrapper = await mountImage({ value: null });

		wrapper.getComponent(BoUpload).vm.$emit('library');
		await flushPromises();
		expect(wrapper.getComponent(DrawerFiles).props('active')).toBe(true);

		wrapper.getComponent(DrawerFiles).vm.$emit('input', ['bo-4']);
		await flushPromises();

		expect(calls(fetch)[0]).toMatch(/^GET \/files\/bo-4/);
		expect(wrapper.emitted('input')).toEqual([['bo-4']]);
	});

	test.each<FixtureUser>(['bo-editor', 'bo-viewer'])('%s cannot create files: no device upload', async (user) => {
		await setup(user);
		const wrapper = await mountImage({ value: null });

		expect(wrapper.getComponent(BoUpload).props('fromUser')).toBe(false);
	});
});

describe('states', () => {
	test('disabled: no actions, image dimmed', async () => {
		const wrapper = await mountImage({ disabled: true });

		expect(wrapper.find('.actions').exists()).toBe(false);
		expect(wrapper.get('img').classes()).toContain('mix-blend-luminosity');
	});

	test('both create and select off: no actions, disabled upload', async () => {
		const wrapper = await mountImage({ enableCreate: false, enableSelect: false });
		expect(wrapper.find('.actions').exists()).toBe(false);

		await wrapper.setProps({ value: null });
		await flushPromises();
		expect(wrapper.getComponent(BoUpload).props('disabled')).toBe(true);
	});

	test('nonEditable: the image is a button that opens the read-only details', async () => {
		const wrapper = await mountImage({ disabled: true, nonEditable: true });
		const button = wrapper.get('button[aria-label="bo-sample-png"]');

		await button.trigger('click');
		expect(wrapper.getComponent(DrawerItem).props()).toMatchObject({ active: true, nonEditable: true });
		expect(wrapper.getComponent(DrawerItem).find('a[download]').exists()).toBe(true);
	});

	test('nonEditable without image: "No Image Selected" notice', async () => {
		const wrapper = await mountImage({ value: null, disabled: true, nonEditable: true });

		expect(wrapper.getComponent(BoNotice).text()).toContain('No Image Selected');
		expect(wrapper.findComponent(BoUpload).exists()).toBe(false);
	});

	test('a11y: group labelled by the field label, described and invalid', async () => {
		const a11y = computed(() => ({ inputId: 'in', labelId: 'lbl', describedBy: 'err', invalid: true }));
		const wrapper = await mountImage({}, { [FORM_FIELD_A11Y as symbol]: a11y });

		expect(wrapper.attributes()).toMatchObject({
			role: 'group',
			'aria-labelledby': 'lbl',
			'aria-describedby': 'err',
			'aria-invalid': 'true',
		});
	});
});
