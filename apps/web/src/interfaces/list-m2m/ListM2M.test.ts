// Fixture, option and permission tests of `list-m2m` (contracts/tests.md §5, FR-044, FR-041) on bo_rel.m2m_list
// (list, junction sort field, duplicates) and bo_rel.m2m_table (table, no sort field) with the fixture API and the
// three users. The drawers are stubbed (they have their own tests); their props and `input` events are the contract.
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
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
import ListM2M from './ListM2M.vue';

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
	'relatedPrimaryKey',
	'junctionField',
	'junctionFieldLocation',
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

async function mountList(field: 'm2m_list' | 'm2m_table', props: Record<string, unknown> = {}, provide = {}) {
	const wrapper = mount(ListM2M, {
		props: {
			collection: 'bo_rel',
			field,
			primaryKey: 1,
			width: 'full',
			value: field === 'm2m_list' ? [1, 2, 3] : [1],
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

describe('list-m2m (fixture bo_rel.m2m_list)', () => {
	test('fixture field: junction rows sorted by the sortField, duplicates shown, no input, only known requests', async () => {
		const wrapper = await mountList('m2m_list');

		expect(rowTexts(wrapper)).toEqual(['Target one', 'Target one', 'Target five']);
		expect(wrapper.findAll('button.row-menu').map((b) => b.attributes('aria-label'))).toEqual([
			'Options for Target one',
			'Options for Target one',
			'Options for Target five',
		]);
		expect(wrapper.emitted('input')).toBeUndefined();
		expect(listCalls().every((c) => c.startsWith('GET /items/bo_junction_m2m_list'))).toBe(true);
	});

	test('option:list-m2m.template, else the junction display template, else the related one on the junction field', async () => {
		expect(rowTexts(await mountList('m2m_list', { template: '{{ id }}: {{ bo_rel_target_id.name }}' }))).toEqual([
			'1: Target one',
			'2: Target one',
			'3: Target five',
		]);

		// bo_rel_target has `{{ name }}`: rewritten to `{{bo_rel_target_id.name}}`.
		expect(rowTexts(await mountList('m2m_list', { template: null }))).toEqual([
			'Target one',
			'Target one',
			'Target five',
		]);
	});

	test('option:list-m2m.layout list renders a sortable list, table renders a table', async () => {
		expect((await mountList('m2m_list')).findComponent({ name: 'BoSortableList' }).exists()).toBe(true);
		expect((await mountList('m2m_list', { layout: 'table', fields: ['id'] })).find('table').exists()).toBe(true);
	});

	test('option:list-m2m.junctionFieldLocation and option:list-m2m.enableCreate: the junction drawer creates a row', async () => {
		const wrapper = await mountList('m2m_list');

		await action(wrapper, 'create').trigger('click');
		const drawer = wrapper.findComponent(DrawerItem);
		expect(drawer.props()).toMatchObject({
			active: true,
			collection: 'bo_junction_m2m_list',
			primaryKey: '+',
			relatedPrimaryKey: '+',
			junctionField: 'bo_rel_target_id',
			junctionFieldLocation: 'top',
			circularField: 'bo_rel_id',
		});

		drawer.vm.$emit('input', { bo_rel_target_id: { name: 'New target' } });
		await flushPromises();
		expect(lastInput(wrapper)).toEqual({
			create: [{ bo_rel_target_id: { name: 'New target' } }],
			update: [],
			delete: [],
		});

		drawer.vm.$emit('input', {});
		expect(wrapper.emitted('input')).toHaveLength(1);

		expect(
			(await mountList('m2m_list', { junctionFieldLocation: undefined }))
				.findComponent(DrawerItem)
				.props('junctionFieldLocation'),
		).toBe('bottom');
		expect(action(await mountList('m2m_list', { enableCreate: false }), 'create').exists()).toBe(false);
	});

	test('editing a row opens the junction row with its related key', async () => {
		const wrapper = await mountList('m2m_list');

		await wrapper.findAll('li [data-action="edit"]')[2]!.trigger('click');
		const drawer = wrapper.findComponent(DrawerItem);
		expect(drawer.props('primaryKey')).toBe(3);
		expect(drawer.props('relatedPrimaryKey')).toBe(5);

		drawer.vm.$emit('input', { id: 3, bo_rel_target_id: { id: 5, name: 'Renamed' } });
		await flushPromises();
		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [{ id: 3, bo_rel_target_id: { id: 5, name: 'Renamed' } }],
			delete: [],
		});
	});

	test('option:list-m2m.enableSelect: selected related keys become junction rows', async () => {
		const wrapper = await mountList('m2m_list');

		await action(wrapper, 'select').trigger('click');
		const drawer = wrapper.findComponent(DrawerCollection);
		expect(drawer.props('active')).toBe(true);
		expect(drawer.props('collection')).toBe('bo_rel_target');

		drawer.vm.$emit('input', [2]);
		await flushPromises();
		expect(lastInput(wrapper)).toEqual({
			create: [{ bo_rel_id: 1, bo_rel_target_id: { id: 2 } }],
			update: [],
			delete: [],
		});

		expect(action(await mountList('m2m_list', { enableSelect: false }), 'select').exists()).toBe(false);
	});

	test('option:list-m2m.allowDuplicates: false leaves out items already linked to this item', async () => {
		expect((await mountList('m2m_list')).findComponent(DrawerCollection).props('filter')).toEqual({ _and: [] });

		expect(
			(await mountList('m2m_list', { allowDuplicates: false })).findComponent(DrawerCollection).props('filter'),
		).toEqual({
			_and: [{ '$FOLLOW(bo_junction_m2m_list,bo_rel_target_id)': { _none: { bo_rel_id: { _eq: 1 } } } }],
		});
	});

	test('option:list-m2m.filter: {{ field }} filled from the form values', async () => {
		const wrapper = await mountList('m2m_list', { filter: { name: { _contains: '{{ title }}' } } });
		expect(wrapper.findComponent(DrawerCollection).props('filter')).toEqual({
			_and: [{ name: { _contains: 'Target' } }],
		});
	});

	test('option:list-m2m.limit pages the rows', async () => {
		const wrapper = await mountList('m2m_list', { limit: 2 });

		expect(rowTexts(wrapper)).toEqual(['Target one', 'Target one']);
		await wrapper.find('[aria-label="Next"]').trigger('click');
		await flushPromises();
		expect(rowTexts(wrapper)).toEqual(['Target five']);
	});

	test('option:list-m2m.enableLink: a link to the related item', async () => {
		expect((await mountList('m2m_list')).findAll('a.item-link').map((a) => a.attributes('href'))).toEqual([
			'/content/bo_rel_target/1',
			'/content/bo_rel_target/1',
			'/content/bo_rel_target/5',
		]);
		expect((await mountList('m2m_list', { enableLink: false })).find('a.item-link').exists()).toBe(false);
	});

	test('remove stages a delete of the junction row', async () => {
		const wrapper = await mountList('m2m_list');

		await wrapper.findAll('li button[aria-label="Remove Item"]')[1]!.trigger('click');
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({ create: [], update: [], delete: [2] });
		expect(wrapper.find('li [aria-label="Undo Removed Item"]').exists()).toBe(true);
	});

	test('drag or "Move down" re-sorts the junction rows (D-60)', async () => {
		const wrapper = await mountList('m2m_list');
		const list = wrapper.findComponent({ name: 'BoSortableList' });

		list.vm.$emit('update:modelValue', [...list.props('modelValue')].reverse());
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [
				{ id: 3, sort: 1, bo_rel_target_id: { id: 5 } },
				{ id: 2, sort: 2, bo_rel_target_id: { id: 1 } },
				{ id: 1, sort: 3, bo_rel_target_id: { id: 1 } },
			],
			delete: [],
		});
	});

	test('table layout: manual sort toggle, then a row drag re-sorts the junction rows (v-table manualSortKey)', async () => {
		const wrapper = await mountList('m2m_list', { layout: 'table', fields: ['id'] });
		const table = wrapper.findComponent(BoTable);

		expect(table.props()).toMatchObject({ showManualSort: true, manualSortKey: 'sort' });
		await wrapper.get('button[aria-label="Toggle Manual Sorting"]').trigger('click');
		expect(table.props('sort')).toEqual({ by: 'sort', desc: false });

		table.vm.$emit('update:rows', [...(table.props('rows') as Record<string, unknown>[])].reverse());
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [
				{ id: 3, sort: 1, bo_rel_target_id: { id: 5 } },
				{ id: 2, sort: 2, bo_rel_target_id: { id: 1 } },
				{ id: 1, sort: 3, bo_rel_target_id: { id: 1 } },
			],
			delete: [],
		});
	});

	test('disabled: actions disabled, no selection drawer', async () => {
		const wrapper = await mountList('m2m_list', { disabled: true });

		expect(action(wrapper, 'create').attributes('disabled')).toBeDefined();
		expect(wrapper.findComponent(DrawerCollection).exists()).toBe(false);
		expect(wrapper.find('li [data-action="edit"]').attributes('disabled')).toBeDefined();
		expect(wrapper.findComponent({ name: 'BoSortableList' }).props('disabled')).toBe(true);
	});

	test('nonEditable: no create, select or remove; rows still open and links still work', async () => {
		const wrapper = await mountList('m2m_list', { disabled: true, nonEditable: true });

		expect(action(wrapper, 'create').exists()).toBe(false);
		expect(action(wrapper, 'select').exists()).toBe(false);
		expect(wrapper.find('li button[aria-label="Remove Item"]').exists()).toBe(false);
		expect(wrapper.find('li [data-action="edit"]').attributes('disabled')).toBeUndefined();
		expect(wrapper.find('a.item-link').exists()).toBe(true);
	});

	test('relation not configured and singleton related collection: notices', async () => {
		expect((await mountList('m2m_list', { field: 'o2m_list' })).text()).toContain(
			'The relationship is not configured properly',
		);

		useCollectionsStore().collections.find((c) => c.collection === 'bo_rel_target')!.meta!.singleton = true;
		expect((await mountList('m2m_list')).text()).toContain('Relationships to Singletons are not supported');
	});

	test('label linking: the group is labelled by the form label', async () => {
		const a11y = computed(() => ({ inputId: 'f-input', labelId: 'f-label', describedBy: 'f-note', invalid: false }));
		const group = (await mountList('m2m_list', {}, { [FORM_FIELD_A11Y as symbol]: a11y })).get('[role="group"]');

		expect(group.attributes('aria-labelledby')).toBe('f-label');
		expect(group.attributes('aria-describedby')).toBe('f-note');
		expect(group.attributes('aria-invalid')).toBeUndefined();
	});

	test.each<[FixtureUser, { create: boolean; select: boolean; remove: boolean }]>([
		['admin', { create: true, select: true, remove: true }],
		['bo-editor', { create: false, select: true, remove: true }],
		['bo-viewer', { create: false, select: false, remove: false }],
	])(
		'permissions (FR-041) for %s: create needs create on both, select create on the junction',
		async (user, allowed) => {
			await setup(user);
			const wrapper = await mountList('m2m_list');

			expect(rowTexts(wrapper)).toEqual(['Target one', 'Target one', 'Target five']);
			expect(action(wrapper, 'create').exists()).toBe(allowed.create);
			expect(action(wrapper, 'select').exists()).toBe(allowed.select);
			expect(wrapper.find('li button[aria-label="Remove Item"]').exists()).toBe(allowed.remove);
		},
	);
});

describe('list-m2m (fixture bo_rel.m2m_table)', () => {
	const headerTexts = (wrapper: VueWrapper) =>
		wrapper
			.findComponent(BoTable)
			.props('columns')
			.map((column: { label: string }) => column.label);

	test('fixture field: table of junction fields, no input', async () => {
		const wrapper = await mountList('m2m_table');

		expect(headerTexts(wrapper)).toEqual(['Name', 'Status']);
		expect(wrapper.find('tbody').text()).toContain('Target two');
		expect(wrapper.get('.item-count').text()).toBe('One Item');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('option:list-m2m.fields sets the columns', async () => {
		expect(headerTexts(await mountList('m2m_table', { fields: ['id'] }))).toEqual(['ID']);
	});

	test('option:list-m2m.tableSpacing sets the row height', async () => {
		expect((await mountList('m2m_table')).find('tbody tr').classes()).toContain('h-[58px]');
		expect((await mountList('m2m_table', { tableSpacing: 'compact' })).find('tbody tr').classes()).toContain(
			'h-[29px]',
		);
	});

	test('option:list-m2m.enableSelect false and option:list-m2m.filter on the selection drawer', async () => {
		const wrapper = await mountList('m2m_table');

		expect(action(wrapper, 'select').exists()).toBe(false);
		expect(action(wrapper, 'create').exists()).toBe(true);
		expect(wrapper.findComponent(DrawerCollection).props('filter')).toEqual({
			_and: [
				{ _and: [{ status: { _eq: 'published' } }] },
				{ '$FOLLOW(bo_junction_m2m_table,bo_rel_target_id)': { _none: { bo_rel_id: { _eq: 1 } } } },
			],
		});
	});

	test('option:list-m2m.enableSearchFilter: search shown with more than 10 items', async () => {
		expect((await mountList('m2m_table')).find('input[type="search"]').exists()).toBe(false);

		const create = Array.from({ length: 11 }, (_, i) => ({ bo_rel_target_id: { name: `New ${i}` } }));
		const many = await mountList('m2m_table', { value: { create, update: [], delete: [] } });
		await many.get('input[type="search"]').setValue('two');
		await flushPromises();
		expect(listCalls().some((c) => c.startsWith('GET /items/bo_junction_m2m_table') && c.includes('search=two'))).toBe(
			true,
		);
	});

	test('header sort is sent to the API', async () => {
		const wrapper = await mountList('m2m_table');

		wrapper.findComponent(BoTable).vm.$emit('update:sort', { by: 'bo_rel_target_id.name', desc: true });
		await flushPromises();
		expect(listCalls().some((c) => c.includes('sort=-bo_rel_target_id.name'))).toBe(true);
	});

	test('row click opens the junction drawer', async () => {
		const wrapper = await mountList('m2m_table');

		await wrapper.find('tbody td:nth-child(2)').trigger('click');
		expect(wrapper.findComponent(DrawerItem).props()).toMatchObject({ primaryKey: 1, relatedPrimaryKey: 2 });
	});

	test('batch edit of the selected rows merges the edits into the related item (FR-046)', async () => {
		const wrapper = await mountList('m2m_table');

		await wrapper.find('thead [role="checkbox"]').trigger('click');
		await flushPromises();
		await action(wrapper, 'batch-edit').trigger('click');

		const drawer = wrapper.findComponent(DrawerBatch);
		expect(drawer.props()).toMatchObject({ active: true, collection: 'bo_rel_target', primaryKeys: [1] });

		drawer.vm.$emit('input', { status: 'draft' });
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [{ id: 1, bo_rel_target_id: { status: 'draft', id: 2 } }],
			delete: [],
		});
	});

	test('column widths are kept in localStorage `backoffice-m2m-column-widths-<collection>-<field>`', async () => {
		localStorage.setItem(
			'backoffice-m2m-column-widths-bo_rel-m2m_table',
			JSON.stringify({ 'bo_rel_target_id.name': 300 }),
		);
		const wrapper = await mountList('m2m_table');
		const table = wrapper.findComponent(BoTable);
		const columns = table.props('columns') as { key: string; width: number }[];
		expect(columns[0]).toMatchObject({ key: 'bo_rel_target_id.name', width: 300 });

		table.vm.$emit(
			'update:columns',
			columns.map((column, i) => (i === 1 ? { ...column, width: 222 } : column)),
		);
		window.dispatchEvent(new Event('pointerup'));
		await flushPromises();

		expect(JSON.parse(localStorage.getItem('backoffice-m2m-column-widths-bo_rel-m2m_table')!)).toEqual({
			'bo_rel_target_id.name': 300,
			'bo_rel_target_id.status': 222,
		});
	});
});
