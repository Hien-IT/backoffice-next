// Directus has no test for interfaces/file: contracts/tests.md §5 on the bo_rel `file` fixture field (FR-050, FR-053,
// FR-054): mount without input, every option, the emitted value shapes, the menu, the dialogs, read-only and a11y.
/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- drawer stubs that only record their props */
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, defineComponent, h, ref } from 'vue';
import { replaceQueue } from '../../api/sdk.ts';
import BoDialog from '../../components/BoDialog.vue';
import BoMenu, { type BoMenuItem } from '../../components/BoMenu.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { type FixtureUser, fieldsOf, loadSnapshot, type Snapshot } from '../../test-utils/fixtures.ts';
import File from './File.vue';
import config from './index.ts';
import BoRemove from '../../components/BoRemove.vue';

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

const meta = fieldsOf('bo_rel').find((f) => f.field === 'file')!.meta!;

async function setup(user: FixtureUser = 'admin', change?: (snapshot: Snapshot) => void) {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	const snapshot = loadSnapshot();
	change?.(snapshot);
	fetch = mockFixtureApi(snapshot, { user });

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

async function mountFile(props: Record<string, unknown> = {}, provide: Record<string | symbol, unknown> = {}) {
	const wrapper = mount(File, {
		props: { ...meta.options, value: 'bo-3', collection: 'bo_rel', field: 'file', ...props },
		global: { plugins: [i18n], stubs: { DrawerItem, DrawerFiles }, provide },
		attachTo: document.body,
	});

	await flushPromises();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountFile>>;

const menuItems = (wrapper: Wrapper) => (wrapper.findComponent(BoMenu).props('items') ?? []) as BoMenuItem[];
const menuTexts = (wrapper: Wrapper) => menuItems(wrapper).map((item) => item.text);

async function select(wrapper: Wrapper, text: string) {
	menuItems(wrapper).find((item) => item.text === text)!.onSelect!();

	await flushPromises();
}

describe('config', () => {
	test('index.ts is the Directus config', () => {
		expect(config.id).toBe('file');
		expect(config.types).toEqual(['uuid']);
		expect(config.localTypes).toEqual(['file']);
		expect(config.relational).toBe(true);
		expect(config.recommendedDisplays).toEqual(['file']);
	});
});

describe('fixture field bo_rel.file', () => {
	test('mounts with the seeded value without emitting, loads the file like useRelationSingle', async () => {
		const wrapper = await mountFile();

		expect(wrapper.emitted('input')).toBeUndefined();
		expect(calls(fetch)).toEqual(['GET /files/bo-3?fields=id,title,type,filename_download,modified_on']);
		expect(wrapper.text()).toContain('bo-sample-pdf');
		expect(wrapper.get('.extension').text()).toBe('pdf');
		expect(wrapper.get('.extension').classes()).toContain('uppercase');
		expect(wrapper.find('img').exists()).toBe(false);
	});

	test('no file: placeholder and attach icon, menu without download', async () => {
		const wrapper = await mountFile({ value: null });

		expect(calls(fetch)).toEqual([]);
		expect(wrapper.text()).toContain('No File Selected');
		expect(wrapper.find('.edit').exists()).toBe(false);
		expect(menuTexts(wrapper)).toEqual(['Upload File from Device', 'Choose File from Library', 'Import File from URL']);
	});

	test('a file: download first, then the replace items', async () => {
		const wrapper = await mountFile();

		expect(menuTexts(wrapper)).toEqual([
			'Download File',
			'Replace File from Device',
			'Replace File from Library',
			'Replace File from URL',
		]);
		expect(menuItems(wrapper)[0]!.href).toBe('http://api.test/assets/bo-3?download=');
	});

	test('loading prop: no request until the form has loaded', async () => {
		const wrapper = await mountFile({ loading: true });

		expect(calls(fetch)).toEqual([]);
		await wrapper.setProps({ loading: false });
		await flushPromises();
		expect(calls(fetch)).toHaveLength(1);
	});
});

describe('thumbnail', () => {
	test('an image uses system-small-cover with the modified_on cache buster', async () => {
		await setup('admin', (s) => (s.files.find((f) => f['id'] === 'bo-4')!['modified_on'] = '2026-01-02T03:04:05'));
		const wrapper = await mountFile({ value: 'bo-4' });

		expect(wrapper.get('img').attributes('src')).toBe(
			'http://api.test/assets/bo-4?key=system-small-cover&v=2026-01-02T03%3A04%3A05',
		);
		expect(wrapper.get('img').attributes('alt')).toBe('bo-sample-png');
	});

	test('an SVG is served as is (no preset), contained', async () => {
		const wrapper = await mountFile({ value: 'bo-5' });

		expect(wrapper.get('img').attributes('src')).toBe('http://api.test/assets/bo-5');
		expect(wrapper.get('img').classes()).toContain('object-contain');
		expect(wrapper.find('.is-svg').exists()).toBe(true);
	});

	test('a broken thumbnail falls back to the extension', async () => {
		const wrapper = await mountFile({ value: 'bo-4' });

		await wrapper.get('img').trigger('error');
		expect(wrapper.find('img').exists()).toBe(false);
		expect(wrapper.get('.extension').text()).toBe('png');
	});
});

describe('options', () => {
	test('option:file.enableCreate false hides upload and URL import', async () => {
		const wrapper = await mountFile({ enableCreate: false });

		expect(menuTexts(wrapper)).toEqual(['Download File', 'Replace File from Library']);
	});

	test('option:file.enableSelect false hides the library', async () => {
		const wrapper = await mountFile({ enableSelect: false });

		expect(menuTexts(wrapper)).toEqual(['Download File', 'Replace File from Device', 'Replace File from URL']);
	});

	test('both off disable the field (internalDisabled)', async () => {
		const wrapper = await mountFile({ enableCreate: false, enableSelect: false });

		expect(wrapper.findComponent(BoMenu).exists()).toBe(false);
		expect(wrapper.get('.activator').attributes('disabled')).toBeDefined();
		expect(wrapper.get('.edit').attributes('disabled')).toBeDefined();
	});

	test('option:file.folder goes to the upload, the library and the URL import', async () => {
		const wrapper = await mountFile({ value: null });

		await select(wrapper, 'Upload File from Device');
		expect(wrapper.getComponent(BoUpload).props('folder')).toBe('bo-2');

		await select(wrapper, 'Choose File from Library');
		expect(wrapper.getComponent(DrawerFiles).props('folder')).toBe('bo-2');
		expect(wrapper.getComponent(DrawerFiles).props('field')).toBe('file');
	});

	test('option:file.allowedMimeTypes is the upload accept and is merged into the library filter', async () => {
		const wrapper = await mountFile({ value: null });

		await select(wrapper, 'Upload File from Device');
		expect(wrapper.getComponent(BoUpload).props('accept')).toBe('application/pdf');

		await select(wrapper, 'Choose File from Library');
		expect(wrapper.getComponent(DrawerFiles).props('filter')).toEqual({
			_and: [{ _and: [{ type: { _eq: 'application/pdf' } }] }, { type: { _eq: 'application/pdf' } }],
		});
	});

	test('option:file.filter renders {{ }} values of the item; alone without MIME types', async () => {
		const wrapper = await mountFile(
			{ value: null, allowedMimeTypes: undefined, filter: { title: { _eq: '{{ name }}' } } },
			{ values: ref({ name: 'Report' }) },
		);

		await select(wrapper, 'Choose File from Library');
		expect(wrapper.getComponent(DrawerFiles).props('filter')).toEqual({ title: { _eq: 'Report' } });
	});

	test('no filter: parseFilter gives {} and the MIME type filter is joined to it, as Directus', async () => {
		const wrapper = await mountFile({ value: null, filter: undefined, allowedMimeTypes: ['image/*', 'video/mp4'] });

		await select(wrapper, 'Choose File from Library');
		expect(wrapper.getComponent(DrawerFiles).props('filter')).toEqual({
			_and: [{}, { _or: [{ type: { _starts_with: 'image/' } }, { type: { _eq: 'video/mp4' } }] }],
		});
	});

	test('defaults: create and select on', async () => {
		const wrapper = await mountFile({ value: null, enableCreate: undefined, enableSelect: undefined });

		expect(menuTexts(wrapper)).toHaveLength(3);
	});
});

describe('edits (emitted values)', () => {
	test('choose from library emits the primary key', async () => {
		const wrapper = await mountFile({ value: null });

		await select(wrapper, 'Choose File from Library');
		wrapper.getComponent(DrawerFiles).vm.$emit('input', ['bo-3']);
		await flushPromises();

		expect(wrapper.emitted('input')).toEqual([['bo-3']]);
		expect(wrapper.findComponent(DrawerFiles).exists()).toBe(true);
		wrapper.getComponent(DrawerFiles).vm.$emit('update:active', false);
		await flushPromises();
		expect(wrapper.findComponent(DrawerFiles).exists()).toBe(false);
	});

	test('an empty library selection emits null', async () => {
		const wrapper = await mountFile();

		await select(wrapper, 'Replace File from Library');
		wrapper.getComponent(DrawerFiles).vm.$emit('input', []);
		await flushPromises();

		expect(wrapper.emitted('input')).toEqual([[null]]);
	});

	test('upload from device: POST /files with the folder, emits the new key and closes the dialog', async () => {
		const wrapper = await mountFile({ value: null });

		await select(wrapper, 'Upload File from Device');
		const upload = wrapper.getComponent(BoUpload);
		const input = upload.get('input[type="file"]');
		Object.defineProperty(input.element, 'files', {
			value: [new globalThis.File(['%PDF'], 'new.pdf', { type: 'application/pdf' })],
		});
		await input.trigger('input');
		await flushPromises();

		expect(calls(fetch)).toEqual(['POST /files']);
		const form = fetch.mock.calls[0]![1]!.body as FormData;
		expect([...form.keys()]).toEqual(['folder', 'file']);
		expect(form.get('folder')).toBe('bo-2');
		expect(wrapper.emitted('input')).toEqual([['bo-new-1']]);
		expect(wrapper.findComponent(BoUpload).exists()).toBe(false);
	});

	test('a failed upload (null) keeps the dialog and emits nothing', async () => {
		const wrapper = await mountFile({ value: null });

		await select(wrapper, 'Upload File from Device');
		wrapper.getComponent(BoUpload).vm.$emit('input', null);
		await flushPromises();

		expect(wrapper.emitted('input')).toBeUndefined();
		expect(wrapper.findComponent(BoUpload).exists()).toBe(true);
	});

	test('import from URL: POST /files/import with folder and filterMimeType, emits the new key', async () => {
		const wrapper = await mountFile({ value: null });

		await select(wrapper, 'Import File from URL');
		const field = document.body.querySelector<HTMLInputElement>('input[type="url"]')!;
		const submit = [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Import')!;
		expect(submit.disabled).toBe(true);

		field.value = 'https://example.com/a.pdf';
		field.dispatchEvent(new Event('input'));
		await flushPromises();
		expect(submit.disabled).toBe(false);
		submit.click();
		await flushPromises();

		expect(calls(fetch)).toEqual(['POST /files/import']);
		expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({
			url: 'https://example.com/a.pdf',
			data: { folder: 'bo-2' },
			options: { filterMimeType: ['application/pdf'] },
		});
		expect(wrapper.emitted('input')).toEqual([['bo-new-1']]);
	});

	test('a failed import shows the API error in the dialog', async () => {
		await setup('admin');
		fetch = mockFixtureApi(loadSnapshot(), {
			answers: {
				'POST /files/import': () =>
					json({ errors: [{ message: 'x', extensions: { code: 'UNSUPPORTED_MEDIA_TYPE' } }] }, 415),
			},
		});
		const wrapper = await mountFile({ value: null });

		await select(wrapper, 'Import File from URL');
		const field = document.body.querySelector<HTMLInputElement>('input[type="url"]')!;
		field.value = 'https://example.com/a.exe';
		field.dispatchEvent(new Event('input'));
		await flushPromises();
		field.form!.requestSubmit();
		await flushPromises();

		expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('Unsupported media type');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('deselect emits null', async () => {
		const wrapper = await mountFile();

		await wrapper.get('.deselect').trigger('click');
		expect(wrapper.emitted('input')).toEqual([[null]]);
	});

	test('deselect of a file with edits asks first (v-remove)', async () => {
		const wrapper = await mountFile({ value: { id: 'bo-3', title: 'Edited' } });

		expect(wrapper.get('.deselect').attributes('aria-label')).toBe('Remove Item');
		await wrapper.get('.deselect').trigger('click');
		expect(wrapper.emitted('input')).toBeUndefined();
		expect(wrapper.getComponent(BoRemove).getComponent(BoDialog).props('open')).toBe(true);

		[...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Delete')!.click();
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[null]]);
	});

	test('edit details: DrawerItem on directus_files, edits are emitted with the key', async () => {
		const wrapper = await mountFile();

		await wrapper.get('.edit').trigger('click');
		const drawer = wrapper.getComponent(DrawerItem);
		expect(drawer.props()).toMatchObject({ active: true, collection: 'directus_files', primaryKey: 'bo-3' });
		expect(drawer.find('a').attributes('href')).toBe('http://api.test/assets/bo-3?download=');
		expect(drawer.find('a').attributes('download')).toBe('bo-sample.pdf');

		drawer.vm.$emit('input', { title: 'New title' });
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[{ title: 'New title', id: 'bo-3' }]]);
	});
});

describe('states', () => {
	test('disabled: no menu, controls disabled, value kept', async () => {
		const wrapper = await mountFile({ disabled: true });

		expect(wrapper.findComponent(BoMenu).exists()).toBe(false);
		expect(wrapper.get('.activator').attributes('disabled')).toBeDefined();
		expect(wrapper.get('.deselect').attributes('disabled')).toBeDefined();
		expect(wrapper.getComponent(DrawerItem).props('disabled')).toBe(true);
	});

	test('nonEditable (read-only): the file opens its details (preview and download), no edit actions', async () => {
		const wrapper = await mountFile({ disabled: true, nonEditable: true });

		expect(wrapper.find('.item-actions').exists()).toBe(false);
		const activator = wrapper.get('.activator');
		expect(activator.attributes('disabled')).toBeUndefined();
		await activator.trigger('click');

		const drawer = wrapper.getComponent(DrawerItem);
		expect(drawer.props()).toMatchObject({ active: true, nonEditable: true });
		expect(drawer.find('a[download]').exists()).toBe(true);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('nonEditable without a file stays disabled', async () => {
		const wrapper = await mountFile({ value: null, disabled: true, nonEditable: true });

		expect(wrapper.get('.activator').attributes('disabled')).toBeDefined();
	});

	test.each<[FixtureUser, string[]]>([
		['bo-editor', ['Download File', 'Replace File from Library']],
		['bo-viewer', ['Download File', 'Replace File from Library']],
	])('%s cannot create files: only the library', async (user, items) => {
		await setup(user);
		const wrapper = await mountFile();

		expect(menuTexts(wrapper)).toEqual(items);
	});

	test('invalid: error border and aria-invalid from the form field', async () => {
		const a11y = computed(() => ({ inputId: 'in', labelId: 'lbl', describedBy: 'note err', invalid: true }));
		const wrapper = await mountFile({}, { [FORM_FIELD_A11Y as symbol]: a11y });

		const activator = wrapper.get('.activator');
		expect(activator.attributes('aria-invalid')).toBe('true');
		expect(activator.attributes('aria-describedby')).toBe('note err');
		const title = activator.get('span[id]:not(.preview)');
		expect(activator.attributes('aria-labelledby')).toBe(`lbl ${title.attributes('id')}`);
		expect(wrapper.find('.border-error-600').exists()).toBe(true);
	});

	test('without the form field the trigger has no label links', async () => {
		const wrapper = await mountFile();

		expect(wrapper.get('.activator').attributes('aria-labelledby')).toBeUndefined();
		expect(wrapper.get('.activator').attributes('aria-invalid')).toBeUndefined();
	});
});

describe('keyboard', () => {
	test('Enter on the trigger opens the menu; Enter on an item opens its dialog', async () => {
		const wrapper = await mountFile({ value: null });
		const trigger = wrapper.get('.activator').element as HTMLButtonElement;

		trigger.focus();
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await flushPromises();

		const items = [...document.body.querySelectorAll('[role="menuitem"]')];
		expect(items.map((i) => i.textContent)).toEqual([
			expect.stringContaining('Upload File from Device'),
			expect.stringContaining('Choose File from Library'),
			expect.stringContaining('Import File from URL'),
		]);

		items[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await flushPromises();
		expect(document.body.querySelector('input[type="url"]')).not.toBeNull();
	});
});
