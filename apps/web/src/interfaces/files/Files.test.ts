// Directus has no test for interfaces/files: contracts/tests.md §5 on the bo_rel `files` fixture field (FR-052, FR-053,
// FR-054, D-60): mount without input, every option, the `{ create, update, delete }` value shapes (sort `index + 1`,
// upload, library, remove, edit), the row menu, pagination, permissions of the fixture users, read-only and a11y.
/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- drawer stubs that only record their props */
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, defineComponent, h, ref } from 'vue';
import { replaceQueue } from '../../api/sdk.ts';
import BoMenu, { type BoMenuItem } from '../../components/BoMenu.vue';
import BoNotice from '../../components/BoNotice.vue';
import BoSortableList from '../../components/BoSortableList.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { type FixtureUser, fieldsOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import ItemRemove from '../file/ItemRemove.vue';
import Files from './Files.vue';
import config from './index.ts';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;

const DrawerItem = defineComponent({
	name: 'DrawerItem',
	props: [
		'active',
		'collection',
		'primaryKey',
		'relatedPrimaryKey',
		'junctionField',
		'edits',
		'circularField',
		'disabled',
		'nonEditable',
	],
	emits: ['input', 'update:active'],
	setup:
		(_, { slots }) =>
		() =>
			h('div', { class: 'drawer-item' }, slots['actions']?.()),
});

const DrawerFiles = defineComponent({
	name: 'DrawerFiles',
	props: {
		active: Boolean,
		folder: { type: String, default: undefined },
		field: { type: String, default: undefined },
		filter: { type: Object, default: undefined },
		collection: { type: String, default: undefined },
		multiple: Boolean,
	},
	emits: ['input', 'update:active'],
	setup: () => () => h('div', { class: 'drawer-files' }),
});

const meta = fieldsOf('bo_rel').find((f) => f.field === 'files')!.meta!;

async function setup(user: FixtureUser = 'admin') {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot(), { user });

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

async function mountFiles(props: Record<string, unknown> = {}, provide: Record<string | symbol, unknown> = {}) {
	const wrapper = mount(Files, {
		props: { ...meta.options, value: [1, 2], primaryKey: 1, collection: 'bo_rel', field: 'files', ...props },
		global: { plugins: [i18n], stubs: { DrawerItem, DrawerFiles }, provide },
		attachTo: document.body,
	});

	await flushPromises();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountFiles>>;

// Generic SFC: getComponent cannot infer its props type.
const sortable = (wrapper: Wrapper) => wrapper.getComponent(BoSortableList as any) as VueWrapper<any>;
const rows = (wrapper: Wrapper) => wrapper.findAll('li');
const rowTexts = (wrapper: Wrapper) => rows(wrapper).map((row) => row.get('button').text());
const button = (wrapper: Wrapper, text: string) => wrapper.findAll('button').find((b) => b.text().includes(text));
const rowMenu = (wrapper: Wrapper, index: number) =>
	rows(wrapper)[index]!.getComponent(BoMenu).props('items') as BoMenuItem[];

async function menuSelect(wrapper: Wrapper, index: number, text: string) {
	rowMenu(wrapper, index).find((item) => item.text === text)!.onSelect!();
	await flushPromises();
}

describe('config', () => {
	test('index.ts is the Directus config', () => {
		expect(config.id).toBe('files');
		expect(config.types).toEqual(['alias']);
		expect(config.localTypes).toEqual(['files']);
		expect(config.recommendedDisplays).toEqual(['related-values']);
	});
});

describe('fixture field bo_rel.files', () => {
	test('mounts with the seeded rows in sort order without emitting', async () => {
		const wrapper = await mountFiles();

		expect(wrapper.emitted('input')).toBeUndefined();
		expect(rowTexts(wrapper)).toEqual(['bo-sample-png', 'bo-sample-pdf']);
		const list = calls(fetch).filter((c) => c.startsWith('GET /items/bo_junction_files?'));
		expect(
			list.some((c) => c.includes('directus_files_id.title') && c.includes('directus_files_id.filename_download')),
		).toBe(true);
	});

	test('a new item ("+") has no rows', async () => {
		const wrapper = await mountFiles({ value: null, primaryKey: '+' });

		expect(rows(wrapper)).toHaveLength(0);
		expect(wrapper.getComponent(BoNotice).text()).toContain('No items');
	});

	test('a field that is not an m2m: relationship notice', async () => {
		const wrapper = await mountFiles({ field: 'file', value: null });

		expect(wrapper.getComponent(BoNotice).text()).toContain('The relationship is not configured properly');
	});
});

describe('options', () => {
	test('option:files.template renders each row with it', async () => {
		const wrapper = await mountFiles({ template: '{{ directus_files_id.filename_download }}' });

		expect(rowTexts(wrapper)).toEqual(['bo-sample.png', 'bo-sample.pdf']);
	});

	test('template fallback: the directus_files display template, prefixed with the junction field', async () => {
		const wrapper = await mountFiles({ template: null });

		expect(wrapper.getComponent(RenderTemplate).props('template')).toBe(
			'{{directus_files_id.$thumbnail}} {{directus_files_id.title}}',
		);
	});

	test('option:files.limit pages the rows; sorting is off when the rows do not fit', async () => {
		const wrapper = await mountFiles({ limit: 1 });

		expect(rowTexts(wrapper)).toEqual(['bo-sample-png']);
		expect(sortable(wrapper).props('disabled')).toBe(true);
		expect(button(wrapper, 'Previous')!.attributes('disabled')).toBeDefined();

		await button(wrapper, 'Next')!.trigger('click');
		await flushPromises();
		expect(rowTexts(wrapper)).toEqual(['bo-sample-pdf']);
		expect(button(wrapper, 'Next')!.attributes('disabled')).toBeDefined();
	});

	test('limit default 15: no pagination', async () => {
		const wrapper = await mountFiles({ limit: undefined });

		expect(button(wrapper, 'Next')).toBeUndefined();
		expect(sortable(wrapper).props('disabled')).toBe(false);
	});

	test('option:files.enableCreate false hides the upload button', async () => {
		const wrapper = await mountFiles({ enableCreate: false });

		expect(button(wrapper, 'Upload File')).toBeUndefined();
		expect(button(wrapper, 'Add Existing')).toBeDefined();
	});

	test('option:files.enableSelect false hides the library button', async () => {
		const wrapper = await mountFiles({ enableSelect: false });

		expect(button(wrapper, 'Add Existing')).toBeUndefined();
		expect(button(wrapper, 'Upload File')).toBeDefined();
	});

	test('option:files.folder goes to the upload and the library', async () => {
		const wrapper = await mountFiles();

		await button(wrapper, 'Upload File')!.trigger('click');
		expect(wrapper.getComponent(BoUpload).props()).toMatchObject({ folder: 'bo-2', multiple: true, fromUrl: true });
		expect(wrapper.getComponent(DrawerFiles).props()).toMatchObject({
			folder: 'bo-2',
			field: 'files',
			collection: 'directus_files',
			multiple: true,
		});
	});

	test('option:files.filter and option:files.allowedMimeTypes: library filter with the exclusion of linked files', async () => {
		const wrapper = await mountFiles({ filter: { title: { _neq: '{{ name }}' } } }, { values: ref({ name: 'x' }) });

		expect(wrapper.getComponent(DrawerFiles).props('filter')).toEqual({
			_and: [
				{ '$FOLLOW(bo_junction_files,directus_files_id)': { _none: { bo_rel_id: { _eq: 1 } } } },
				{ title: { _neq: 'x' } },
				{ _or: [{ type: { _starts_with: 'image/' } }, { type: { _eq: 'application/pdf' } }] },
			],
		});

		await button(wrapper, 'Upload File')!.trigger('click');
		expect(wrapper.getComponent(BoUpload).props('accept')).toBe('image/*,application/pdf');
	});

	test('a new item has no $FOLLOW part; selected files are excluded by key', async () => {
		const wrapper = await mountFiles({ value: null, primaryKey: '+', filter: undefined, allowedMimeTypes: undefined });

		wrapper.getComponent(DrawerFiles).vm.$emit('input', ['bo-4']);
		await wrapper.setProps({ value: wrapper.emitted('input')![0]![0] as Record<string, any> });
		await flushPromises();

		expect(wrapper.getComponent(DrawerFiles).props('filter')).toEqual({ _and: [{ id: { _nin: ['bo-4'] } }] });
	});
});

describe('edits (emitted values)', () => {
	test('drag order: sort = index + 1 on every row', async () => {
		const wrapper = await mountFiles();
		const list = sortable(wrapper);

		list.vm.$emit('update:modelValue', [...list.props('modelValue')].reverse());
		await flushPromises();

		expect(wrapper.emitted('input')).toEqual([
			[
				{
					create: [],
					update: [
						{ id: 2, sort: 1, directus_files_id: { id: 'bo-3' } },
						{ id: 1, sort: 2, directus_files_id: { id: 'bo-4' } },
					],
					delete: [],
				},
			],
		]);
	});

	test('"Move down" in the row menu emits the same value as the drag (D-60)', async () => {
		const wrapper = await mountFiles();

		await menuSelect(wrapper, 0, 'Move down');

		expect(wrapper.emitted('input')![0]![0]).toEqual({
			create: [],
			update: [
				{ id: 2, sort: 1, directus_files_id: { id: 'bo-3' } },
				{ id: 1, sort: 2, directus_files_id: { id: 'bo-4' } },
			],
			delete: [],
		});
	});

	test('row menu: open in a new tab and download, then the moves', async () => {
		const wrapper = await mountFiles();

		expect(rowMenu(wrapper, 0).map(({ text, href }) => [text, href])).toEqual([
			['Open File in New Tab', 'http://api.test/assets/bo-4'],
			['Download File', 'http://api.test/assets/bo-4?download='],
			['Move up', undefined],
			['Move down', undefined],
		]);
	});

	test('upload: POST /files per file with the folder, the new files are created as junction rows', async () => {
		const wrapper = await mountFiles();

		await button(wrapper, 'Upload File')!.trigger('click');
		const input = wrapper.getComponent(BoUpload).get('input[type="file"]');
		Object.defineProperty(input.element, 'files', {
			value: [
				new globalThis.File(['a'], 'a.png', { type: 'image/png' }),
				new globalThis.File(['b'], 'b.pdf', { type: 'application/pdf' }),
			],
		});
		await input.trigger('input');
		await flushPromises();

		const posts = calls(fetch).filter((c) => c.startsWith('POST'));
		expect(posts).toEqual(['POST /files', 'POST /files']);
		expect(wrapper.emitted('input')![0]![0]).toEqual({
			create: [
				{ bo_rel_id: 1, directus_files_id: { id: 'bo-new-1' } },
				{ bo_rel_id: 1, directus_files_id: { id: 'bo-new-2' } },
			],
			update: [],
			delete: [],
		});
		expect(wrapper.findComponent(BoUpload).exists()).toBe(false);
	});

	test('add existing: the library selection is created, already selected files are skipped', async () => {
		const wrapper = await mountFiles();

		await button(wrapper, 'Add Existing')!.trigger('click');
		expect(wrapper.getComponent(DrawerFiles).props('active')).toBe(true);

		wrapper.getComponent(DrawerFiles).vm.$emit('input', ['bo-5']);
		await flushPromises();
		const value = wrapper.emitted('input')![0]![0] as Record<string, any>;
		expect(value).toEqual({
			create: [{ bo_rel_id: 1, directus_files_id: { id: 'bo-5' } }],
			update: [],
			delete: [],
		});

		await wrapper.setProps({ value });
		await flushPromises();
		wrapper.getComponent(DrawerFiles).vm.$emit('input', ['bo-5']);
		await flushPromises();
		expect(wrapper.emitted('input')![1]![0]).toEqual(value);
	});

	test('remove: the junction key goes to delete; undo restores it', async () => {
		const wrapper = await mountFiles();

		await rows(wrapper)[0]!.get('[aria-label="Remove Item"]').trigger('click');
		const value = wrapper.emitted('input')![0]![0] as Record<string, any>;
		expect(value).toEqual({ create: [], update: [], delete: [1] });

		await wrapper.setProps({ value });
		await flushPromises();
		const restore = rows(wrapper)[0]!.get('[aria-label="Undo Removed Item"]');
		expect(rows(wrapper)[0]!.get('button').classes()).toContain('line-through');
		await restore.trigger('click');
		// No changes left: the value goes back to undefined (useRelationMultiple, as Directus).
		expect(wrapper.emitted('input')![1]).toEqual([undefined]);
	});

	test('a selected (local) file is deselected without a delete', async () => {
		const value = { create: [{ bo_rel_id: 1, directus_files_id: { id: 'bo-5' } }], update: [], delete: [] };
		const wrapper = await mountFiles({ value });

		const local = rows(wrapper).find((row) => row.text().includes('bo-sample-svg'))!;
		await local.get('[aria-label="Deselect"]').trigger('click');
		expect(wrapper.emitted('input')).toEqual([[undefined]]);
	});

	test('edit: DrawerItem on the junction row with the related key, staged edits go to update', async () => {
		const wrapper = await mountFiles();

		await rows(wrapper)[0]!.get('button').trigger('click');
		const drawer = wrapper.getComponent(DrawerItem);
		expect(drawer.props()).toMatchObject({
			active: true,
			collection: 'bo_junction_files',
			primaryKey: 1,
			relatedPrimaryKey: 'bo-4',
			junctionField: 'directus_files_id',
			circularField: 'bo_rel_id',
		});
		expect(drawer.get('a').attributes()).toMatchObject({
			href: 'http://api.test/assets/bo-4?download=',
			download: 'bo-sample.png',
		});

		drawer.vm.$emit('input', {});
		drawer.vm.$emit('input', { id: 1, directus_files_id: { id: 'bo-4', title: 'New' } });
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([
			[{ create: [], update: [{ id: 1, directus_files_id: { id: 'bo-4', title: 'New' } }], delete: [] }],
		]);
	});
});

describe('states', () => {
	test('disabled: no drag or moves, buttons disabled, no library or upload dialog', async () => {
		const wrapper = await mountFiles({ disabled: true });

		expect(sortable(wrapper).props('disabled')).toBe(true);
		expect(rowMenu(wrapper, 0).map((i) => [i.text, i.disabled])).toEqual([
			['Open File in New Tab', true],
			['Download File', true],
		]);
		expect(button(wrapper, 'Upload File')!.attributes('disabled')).toBeDefined();
		expect(rows(wrapper)[0]!.get('button').attributes('disabled')).toBeDefined();
		expect(wrapper.findComponent(DrawerFiles).exists()).toBe(false);
		expect(wrapper.findComponent(BoUpload).exists()).toBe(false);
	});

	test('nonEditable: rows open read-only details, no remove, no menus, no buttons', async () => {
		const wrapper = await mountFiles({ disabled: true, nonEditable: true });

		expect(wrapper.findComponent(ItemRemove).exists()).toBe(false);
		expect(wrapper.findAllComponents(BoMenu)).toHaveLength(0);
		expect(button(wrapper, 'Upload File')).toBeUndefined();

		await rows(wrapper)[0]!.get('button').trigger('click');
		expect(wrapper.getComponent(DrawerItem).props()).toMatchObject({ active: true, nonEditable: true });
	});

	test('bo-editor: links and unlinks existing files (junction create/update), no upload, no sorting', async () => {
		await setup('bo-editor');
		const wrapper = await mountFiles();

		expect(button(wrapper, 'Upload File')).toBeUndefined();
		expect(button(wrapper, 'Add Existing')).toBeDefined();
		// one_deselect_action nullify: removing needs junction update, which bo-editor has.
		expect(wrapper.findComponent(ItemRemove).exists()).toBe(true);
		// updateAllowed needs directus_files update too.
		expect(sortable(wrapper).props('disabled')).toBe(true);
	});

	test('bo-viewer: no upload, no library, no sorting', async () => {
		await setup('bo-viewer');
		const wrapper = await mountFiles();

		expect(rowTexts(wrapper)).toEqual(['bo-sample-png', 'bo-sample-pdf']);
		expect(button(wrapper, 'Upload File')).toBeUndefined();
		expect(button(wrapper, 'Add Existing')).toBeUndefined();
		expect(wrapper.findComponent(ItemRemove).exists()).toBe(false);
		expect(sortable(wrapper).props('disabled')).toBe(true);
	});

	test('a11y: group labelled by the field label, described and invalid', async () => {
		const a11y = computed(() => ({ inputId: 'in', labelId: 'lbl', describedBy: 'err', invalid: true }));
		const wrapper = await mountFiles({}, { [FORM_FIELD_A11Y as symbol]: a11y });

		expect(wrapper.get('.many-to-many').attributes()).toMatchObject({
			role: 'group',
			'aria-labelledby': 'lbl',
			'aria-describedby': 'err',
			'aria-invalid': 'true',
		});
	});
});
