// Fixture, option and permission tests of `list-o2m` (contracts/tests.md §5, FR-043, FR-041) on bo_rel.o2m_list
// (list, sort field) and bo_rel.o2m_table (table, no sort field, deselect = delete) with the fixture API and the three
// users. The drawers are stubbed (they have their own tests); their props and `input` events are the contract.
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import BoMenu, { type BoMenuItem } from '../../components/BoMenu.vue';
import BoTable from '../../components/BoTable.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { type FixtureUser, fieldsOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import ListO2M from './ListO2M.vue';

enableAutoUnmount(afterEach);

const snapshot = loadSnapshot();
let fetch: ReturnType<typeof mockFixtureApi>;
let hydrateCalls = 0;

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

async function setup(user: FixtureUser = 'admin') {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(snapshot, { user });
	await useUserStore().hydrate();

	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);

	hydrateCalls = fetch.mock.calls.length;
}

beforeEach(async () => {
	localStorage.clear();
	await setup();
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
});

const listCalls = () => calls(fetch).slice(hydrateCalls);

// Props the tests read, untyped (`type: null`) like the real drawers accept them.
const STUB_PROPS = [
	'active',
	'filter',
	'primaryKey',
	'primaryKeys',
	'collection',
	'edits',
	'circularField',
	'disabled',
	'nonEditable',
];

const stub = (name: string) =>
	defineComponent({
		name,
		inheritAttrs: false,
		props: Object.fromEntries(STUB_PROPS.map((prop) => [prop, { type: null }])),
		render: () => h('div', { class: name }),
	});

const DrawerItem = stub('DrawerItem');
const DrawerCollection = stub('DrawerCollection');
const DrawerBatch = stub('DrawerBatch');

const optionsOf = (field: string) =>
	fieldsOf('bo_rel').find((f) => f.field === field)!.meta!.options as Record<string, any>;

async function mountList(field: 'o2m_list' | 'o2m_table', props: Record<string, unknown> = {}, provide = {}) {
	const wrapper = mount(ListO2M, {
		props: {
			collection: 'bo_rel',
			field,
			primaryKey: 1,
			width: 'full',
			value: field === 'o2m_list' ? [2, 3] : [4],
			...optionsOf(field),
			...props,
			onInput: (value: any) => wrapper.setProps({ value }),
		},
		global: {
			plugins: [i18n, router],
			stubs: { DrawerItem, DrawerCollection, DrawerBatch },
			provide: { values: ref({ id: 1, title: 'Target' }), ...provide },
		},
		attachTo: document.body,
	});

	await flushPromises();
	return wrapper;
}

const lastInput = (wrapper: VueWrapper) => wrapper.emitted('input')!.at(-1)![0];
const action = (wrapper: VueWrapper, name: string) => wrapper.find(`[data-action="${name}"]`);
const rowTexts = (wrapper: VueWrapper) => wrapper.findAll('li [data-action="edit"]').map((row) => row.text());

describe('list-o2m (fixture bo_rel.o2m_list)', () => {
	test('fixture field: rows sorted by the relation sortField, no input on mount, only known requests', async () => {
		const wrapper = await mountList('o2m_list');

		expect(rowTexts(wrapper)).toEqual(['Target two', 'Target three']);
		expect(wrapper.findAll('button.row-menu').map((b) => b.attributes('aria-label'))).toEqual([
			'Options for Target two',
			'Options for Target three',
		]);
		expect(wrapper.emitted('input')).toBeUndefined();
		expect(listCalls().every((c) => c.startsWith('GET /items/bo_rel_target'))).toBe(true);
	});

	test('option:list-o2m.sort is ignored when the relation has a sortField (drag sorts by it)', async () => {
		await mountList('o2m_list');
		expect(listCalls().some((c) => c.includes('sort=name') || c.includes('sort=-name'))).toBe(false);
	});

	test('option:list-o2m.template renders each row', async () => {
		const wrapper = await mountList('o2m_list', { template: '{{ name }} #{{ id }}' });
		expect(rowTexts(wrapper)).toEqual(['Target two #2', 'Target three #3']);
	});

	test('option:list-o2m.layout list renders a sortable list, table renders a table', async () => {
		const list = await mountList('o2m_list');
		expect(list.findComponent({ name: 'BoSortableList' }).exists()).toBe(true);
		expect(list.find('table').exists()).toBe(false);

		const table = await mountList('o2m_list', { layout: 'table', fields: ['name'] });
		expect(table.find('table').exists()).toBe(true);
	});

	test('option:list-o2m.enableCreate: create opens the item drawer and stages a create', async () => {
		const wrapper = await mountList('o2m_list');

		await action(wrapper, 'create').trigger('click');
		const drawer = wrapper.findComponent(DrawerItem);
		expect(drawer.props('active')).toBe(true);
		expect(drawer.props('primaryKey')).toBe('+');
		expect(drawer.props('circularField')).toBe('o2m_list_parent');

		drawer.vm.$emit('input', { name: 'New target' });
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({ create: [{ name: 'New target' }], update: [], delete: [] });

		const hidden = await mountList('o2m_list', { enableCreate: false });
		expect(action(hidden, 'create').exists()).toBe(false);
	});

	test('editing an existing row stages an update with its primary key', async () => {
		const wrapper = await mountList('o2m_list');

		await wrapper.findAll('li [data-action="edit"]')[0]!.trigger('click');
		const drawer = wrapper.findComponent(DrawerItem);
		expect(drawer.props('primaryKey')).toBe(2);

		drawer.vm.$emit('input', { id: 2, name: 'Renamed' });
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({ create: [], update: [{ id: 2, name: 'Renamed' }], delete: [] });
	});

	test('option:list-o2m.enableSelect: add existing opens the selection drawer, selected keys are staged', async () => {
		const wrapper = await mountList('o2m_list');

		await action(wrapper, 'select').trigger('click');
		const drawer = wrapper.findComponent(DrawerCollection);
		expect(drawer.props('active')).toBe(true);
		expect(drawer.props('collection')).toBe('bo_rel_target');

		drawer.vm.$emit('input', [1]);
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({ create: [], update: [{ o2m_list_parent: 1, id: 1 }], delete: [] });

		const hidden = await mountList('o2m_list', { enableSelect: false });
		expect(action(hidden, 'select').exists()).toBe(false);
	});

	test('option:list-o2m.filter: {{ field }} filled from the form values, items of other parents left out', async () => {
		const wrapper = await mountList('o2m_list', { filter: { name: { _contains: '{{ title }}' } } });

		expect(wrapper.findComponent(DrawerCollection).props('filter')).toEqual({
			_and: [
				{ name: { _contains: 'Target' } },
				{ _or: [{ o2m_list_parent: { _neq: 1 } }, { o2m_list_parent: { _null: true } }] },
			],
		});
	});

	test('option:list-o2m.limit pages the rows', async () => {
		const wrapper = await mountList('o2m_list', { limit: 1 });

		expect(rowTexts(wrapper)).toEqual(['Target two']);
		expect(
			(await mountList('o2m_list', { limit: 1, layout: 'table', fields: ['name'] })).get('.item-count').text(),
		).toBe('1-1 of 2 Items');
		await wrapper.find('[aria-label="Next"]').trigger('click');
		await flushPromises();
		expect(rowTexts(wrapper)).toEqual(['Target three']);
	});

	test('option:list-o2m.enableLink: a link to the related item', async () => {
		const wrapper = await mountList('o2m_list');
		expect(wrapper.findAll('a.item-link').map((a) => a.attributes('href'))).toEqual([
			'/content/bo_rel_target/2',
			'/content/bo_rel_target/3',
		]);

		const hidden = await mountList('o2m_list', { enableLink: false });
		expect(hidden.find('a.item-link').exists()).toBe(false);
	});

	test('remove stages a delete (one_deselect_action nullify: the API sets the foreign key to null)', async () => {
		const wrapper = await mountList('o2m_list');

		await wrapper.findAll('li button[aria-label="Remove Item"]')[0]!.trigger('click');
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({ create: [], update: [], delete: [2] });
		expect(wrapper.find('li [aria-label="Undo Removed Item"]').exists()).toBe(true);
	});

	test('drag or "Move down" re-sorts by the sortField (D-60)', async () => {
		const wrapper = await mountList('o2m_list');
		const list = wrapper.findComponent({ name: 'BoSortableList' });

		expect(list.props('disabled')).toBe(false);
		list.vm.$emit('update:modelValue', [...list.props('modelValue')].reverse());
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [
				{ id: 3, sort: 1 },
				{ id: 2, sort: 2 },
			],
			delete: [],
		});
	});

	test('no drag when the rows do not fit on one page', async () => {
		const wrapper = await mountList('o2m_list', { limit: 1 });
		expect(wrapper.findComponent({ name: 'BoSortableList' }).props('disabled')).toBe(true);
	});

	test('disabled: actions disabled, no selection drawer, rows not editable', async () => {
		const wrapper = await mountList('o2m_list', { disabled: true });

		expect(action(wrapper, 'create').attributes('disabled')).toBeDefined();
		expect(action(wrapper, 'select').attributes('disabled')).toBeDefined();
		expect(wrapper.findComponent(DrawerCollection).exists()).toBe(false);
		expect(wrapper.find('li [data-action="edit"]').attributes('disabled')).toBeDefined();
		expect(wrapper.findComponent({ name: 'BoSortableList' }).props('disabled')).toBe(true);
		expect(wrapper.find('a.item-link').exists()).toBe(false);
	});

	test('nonEditable: no create, select or remove; rows still open and links still work', async () => {
		const wrapper = await mountList('o2m_list', { disabled: true, nonEditable: true });

		expect(action(wrapper, 'create').exists()).toBe(false);
		expect(wrapper.find('li button[aria-label="Remove Item"]').exists()).toBe(false);
		expect(wrapper.find('li [data-action="edit"]').attributes('disabled')).toBeUndefined();
		expect(wrapper.find('a.item-link').exists()).toBe(true);
	});

	test('relation not configured: notice', async () => {
		const wrapper = await mountList('o2m_list', { field: 'title' });
		expect(wrapper.text()).toContain("The relationship is not configured properly or you don't have permission");
	});

	test('label linking: the group is labelled by the form label', async () => {
		const a11y = computed(() => ({ inputId: 'f-input', labelId: 'f-label', describedBy: 'f-note', invalid: true }));
		const wrapper = await mountList('o2m_list', {}, { [FORM_FIELD_A11Y as symbol]: a11y });
		const group = wrapper.get('[role="group"]');

		expect(group.attributes('aria-labelledby')).toBe('f-label');
		expect(group.attributes('aria-describedby')).toBe('f-note');
		expect(group.attributes('aria-invalid')).toBe('true');
	});

	test.each<[FixtureUser, boolean]>([
		['admin', true],
		['bo-editor', false],
		['bo-viewer', false],
	])(
		'permissions (FR-041) for %s: create, select and deselect need create/update on the related collection',
		async (user, allowed) => {
			await setup(user);
			const wrapper = await mountList('o2m_list');

			expect(rowTexts(wrapper)).toEqual(['Target two', 'Target three']);
			expect(action(wrapper, 'create').exists()).toBe(allowed);
			expect(action(wrapper, 'select').exists()).toBe(allowed);
			expect(wrapper.find('li button[aria-label="Remove Item"]').exists()).toBe(allowed);
			expect(wrapper.find('a.item-link').exists()).toBe(true);
		},
	);
});

describe('list-o2m (fixture bo_rel.o2m_table)', () => {
	const headerTexts = (wrapper: VueWrapper) =>
		wrapper
			.findComponent(BoTable)
			.props('columns')
			.map((column: { label: string }) => column.label);

	test('fixture field: table with the fields as columns, no input', async () => {
		const wrapper = await mountList('o2m_table');

		expect(headerTexts(wrapper)).toEqual(['Name', 'Status']);
		expect(wrapper.findAll('tbody tr')).toHaveLength(1);
		expect(wrapper.find('tbody').text()).toContain('Target four');
		expect(wrapper.get('.item-count').text()).toBe('One Item');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('option:list-o2m.fields sets the columns', async () => {
		const wrapper = await mountList('o2m_table', { fields: ['id', 'name'] });
		expect(headerTexts(wrapper)).toEqual(['ID', 'Name']);
	});

	test('option:list-o2m.tableSpacing sets the row height', async () => {
		expect((await mountList('o2m_table')).find('tbody tr').classes()).toContain('h-[29px]');
		expect((await mountList('o2m_table', { tableSpacing: 'comfortable' })).find('tbody tr').classes()).toContain(
			'h-[58px]',
		);
		expect((await mountList('o2m_table', { tableSpacing: undefined })).find('tbody tr').classes()).toContain(
			'h-[43px]',
		);
	});

	test('option:list-o2m.sort and option:list-o2m.sortDirection: initial sort without a sortField', async () => {
		await mountList('o2m_table');
		expect(listCalls().some((c) => c.includes('sort=name'))).toBe(true);

		await setup();
		await mountList('o2m_table', { sortDirection: '-' });
		expect(listCalls().some((c) => c.includes('sort=-name'))).toBe(true);
	});

	test('option:list-o2m.enableSearchFilter: search shown with more than 10 items, sent as `search`', async () => {
		const few = await mountList('o2m_table');
		expect(few.find('input[type="search"]').exists()).toBe(false);

		const create = Array.from({ length: 11 }, (_, i) => ({ name: `New ${i}` }));
		const many = await mountList('o2m_table', { value: { create, update: [], delete: [] } });
		await many.get('input[type="search"]').setValue('four');
		await flushPromises();
		expect(listCalls().some((c) => c.includes('search=four'))).toBe(true);

		const off = await mountList('o2m_table', { value: { create, update: [], delete: [] }, enableSearchFilter: false });
		expect(off.find('input[type="search"]').exists()).toBe(false);
	});

	test('row click and Enter on a focused row open the item drawer (v-table click:row)', async () => {
		const wrapper = await mountList('o2m_table');

		await wrapper.find('tbody td:nth-child(2)').trigger('click');
		expect(wrapper.findComponent(DrawerItem).props('primaryKey')).toBe(4);

		wrapper.findComponent(DrawerItem).vm.$emit('update:active', false);
		await flushPromises();
		expect(wrapper.findComponent(DrawerItem).props('active')).toBe(false);

		await wrapper.get('tbody tr').trigger('keydown', { key: 'Enter' });
		expect(wrapper.findComponent(DrawerItem).props()).toMatchObject({ active: true, primaryKey: 4 });
	});

	test('table manual sort: drag is on after the sort toggle and re-sorts by the sortField (FR-043)', async () => {
		const wrapper = await mountList('o2m_list', { layout: 'table', fields: ['name'] });
		const table = wrapper.findComponent(BoTable);

		expect(table.props()).toMatchObject({ showManualSort: true, manualSortKey: 'sort', sort: null });
		await wrapper.get('button[aria-label="Toggle Manual Sorting"]').trigger('click');
		expect(table.props('sort')).toEqual({ by: 'sort', desc: false });

		const rows = table.props('rows') as Record<string, unknown>[];
		table.vm.$emit('update:rows', [rows[1], rows[0]]);
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [
				{ id: 3, sort: 1 },
				{ id: 2, sort: 2 },
			],
			delete: [],
		});

		expect((await mountList('o2m_table')).findComponent(BoTable).props('showManualSort')).toBe(false);
	});

	test('table "Move down" row menu re-sorts by the sortField (D-60)', async () => {
		const wrapper = await mountList('o2m_list', { layout: 'table', fields: ['name'] });
		const menus = wrapper.findAllComponents(BoMenu);

		expect(menus).toHaveLength(2);
		(menus[0]!.props('items') as BoMenuItem[])[1]!.onSelect!();
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [
				{ id: 3, sort: 1 },
				{ id: 2, sort: 2 },
			],
			delete: [],
		});
		expect((await mountList('o2m_table')).findComponent(BoMenu).exists()).toBe(false);
	});

	test('remove with one_deselect_action delete stages a delete', async () => {
		const wrapper = await mountList('o2m_table');

		await wrapper.find('tbody button[aria-label="Remove Item"]').trigger('click');
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({ create: [], update: [], delete: [4] });
	});

	test('batch edit of the selected rows (FR-046)', async () => {
		const create = [{ name: 'New one' }];
		const wrapper = await mountList('o2m_table', { value: { create, update: [], delete: [] } });

		await wrapper.find('thead [role="checkbox"]').trigger('click');
		await flushPromises();
		await action(wrapper, 'batch-edit').trigger('click');

		const drawer = wrapper.findComponent(DrawerBatch);
		expect(drawer.props('active')).toBe(true);
		expect(drawer.props('primaryKeys')).toEqual([0, 4]);

		drawer.vm.$emit('input', { status: 'draft' });
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [{ name: 'New one', status: 'draft' }],
			update: [{ id: 4, status: 'draft' }],
			delete: [],
		});
	});

	test('column widths are kept in localStorage `backoffice-o2m-column-widths-<collection>-<field>`', async () => {
		localStorage.setItem('backoffice-o2m-column-widths-bo_rel-o2m_table', JSON.stringify({ name: 300 }));
		const wrapper = await mountList('o2m_table');
		expect(wrapper.findComponent(BoTable).props('columns')[0]).toMatchObject({ key: 'name', width: 300 });

		const columns = wrapper.findComponent(BoTable).props('columns') as { key: string; width: number }[];
		wrapper.findComponent(BoTable).vm.$emit(
			'update:columns',
			columns.map((column) => (column.key === 'name' ? { ...column, width: 250 } : column)),
		);

		window.dispatchEvent(new Event('pointerup'));
		await flushPromises();

		expect(JSON.parse(localStorage.getItem('backoffice-o2m-column-widths-bo_rel-o2m_table')!)).toEqual({ name: 250 });
	});

	test.each<[FixtureUser, boolean]>([
		['admin', true],
		['bo-editor', false],
		['bo-viewer', false],
	])('permissions (FR-041) for %s: remove with deselect action delete needs delete', async (user, allowed) => {
		await setup(user);
		// bo-editor cannot read `status`: Directus requests it too and gets a 403, so only `name` here.
		const wrapper = await mountList('o2m_table', { fields: ['name'] });

		expect(wrapper.find('tbody').text()).toContain('Target four');
		expect(wrapper.find('tbody button[aria-label="Remove Item"]').exists()).toBe(allowed);
		expect(wrapper.find('thead [role="checkbox"]').exists()).toBe(allowed);
	});

	test('FR-046: a failed load (403 for bo-editor on `status`) shows a danger notice, not only a console warning', async () => {
		await setup('bo-editor');
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const wrapper = await mountList('o2m_table');

		const notice = wrapper.findAllComponents({ name: 'BoNotice' }).find((n) => n.props('type') === 'danger');
		expect(notice?.text()).toContain(i18n.global.t('errors.FORBIDDEN'));
		expect(warn).toHaveBeenCalled();
		expect(wrapper.emitted('input')).toBeUndefined();

		await wrapper.setProps({ fields: ['name'] });
		await flushPromises();
		expect(wrapper.findAllComponents({ name: 'BoNotice' }).some((n) => n.props('type') === 'danger')).toBe(false);
		warn.mockRestore();
	});
});
