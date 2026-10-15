// list-m2a on the fixture snapshot (Directus has no list-m2a.test.ts): bo_rel.m2a (junction bo_junction_m2a, allowed
// bo_m2a_a and bo_m2a_b, sort field `sort`), the option checks of contracts/tests.md §5 (FR-045) and the emitted
// {create, update, delete} values (FR-040). Menus are driven through BoMenu / BoSortableList props here; the keyboard
// paths are in ListM2A.browser.test.ts.
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, type DefineComponent } from 'vue';
import { replaceQueue } from '../../api/sdk.ts';
import type { BoMenuItem } from '../../components/BoMenu.vue';
import BoMenu from '../../components/BoMenu.vue';
import BoSortableListComponent from '../../components/BoSortableList.vue';
import DrawerCollection from '../../components/drawers/DrawerCollection.vue';
import DrawerItem from '../../components/drawers/DrawerItem.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { type FixtureUser, fieldsOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import ListM2A from './ListM2A.vue';

enableAutoUnmount(afterEach);

// A generic SFC: typed as a plain component for findComponent.
const BoSortableList = BoSortableListComponent as unknown as DefineComponent<Record<string, any>>;

const snapshot = loadSnapshot();
const m2aField = fieldsOf('bo_rel').find((f) => f.field === 'm2a')!;
let fetch: ReturnType<typeof mockFixtureApi>;

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
}

beforeEach(async () => {
	Element.prototype.scrollIntoView = vi.fn();
	await setup();
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	vi.restoreAllMocks();
});

type Wrapper = VueWrapper<InstanceType<typeof ListM2A>>;

/** Mount like FormFieldInterface: the field's meta.options spread as props, then the form props. */
async function mountM2A(
	props: Record<string, unknown> = {},
	options: Record<string, unknown> = m2aField.meta!.options!,
) {
	const wrapper = mount(ListM2A, {
		props: {
			...options,
			collection: 'bo_rel',
			field: 'm2a',
			primaryKey: 1,
			value: [1, 2],
			onInput: (value: unknown) => wrapper.setProps({ value } as never),
			...props,
		} as never,
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await flushPromises();
	await vi.waitFor(() => expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false));
	return wrapper as unknown as Wrapper;
}

const lastInput = (wrapper: Wrapper) => wrapper.emitted<[unknown]>('input')?.at(-1)?.[0];
const rows = (wrapper: Wrapper) =>
	wrapper.findAll('li[data-row-key] .row, li[data-row-key] .invalid').map((row) => row.text());
const menu = (wrapper: Wrapper, name: 'create' | 'select') =>
	wrapper.findAllComponents(BoMenu).find((m) => m.find(`button.${name}`).exists());
const menuItems = (wrapper: Wrapper, name: 'create' | 'select') => menu(wrapper, name)?.props('items') as BoMenuItem[];
const sortable = (wrapper: Wrapper) => wrapper.findComponent(BoSortableList);

function rowActions(wrapper: Wrapper, index: number): BoMenuItem[] {
	const list = sortable(wrapper);
	const element = (list.props('modelValue') as Record<string, unknown>[])[index];
	return (list.props('rowActions') as (e: unknown, i: number) => BoMenuItem[])(element, index);
}

describe('config', () => {
	test('registers list-m2a for alias m2a fields', () => {
		expect(config.id).toBe('list-m2a');
		expect(config.types).toEqual(['alias']);
		expect(config.localTypes).toEqual(['m2a']);
	});
});

describe('fixture', () => {
	test('shows the seeded junction rows with the prefix and the template of each collection, no input on mount', async () => {
		const wrapper = await mountM2A();

		expect(rows(wrapper)).toEqual([expect.stringContaining('bo_m2a_a:'), expect.stringContaining('bo_m2a_b:')]);
		expect(rows(wrapper)[0]).toContain('A one');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('missing options use the component defaults (enableCreate, enableSelect, limit 15, collection name prefix)', async () => {
		const wrapper = await mountM2A({}, {});

		expect(wrapper.find('button.create').exists()).toBe(true);
		expect(wrapper.find('button.select').exists()).toBe(true);
		expect(wrapper.find('.pagination').exists()).toBe(false);
		expect(rows(wrapper)[0]).toMatch(/^Bo M2A A:/);
	});

	test('notices: relation not set up, every allowed collection a singleton', async () => {
		const notSetUp = await mountM2A({ field: 'title' });
		expect(notSetUp.text()).toContain(i18n.global.t('relationship_not_setup'));

		for (const name of ['bo_m2a_a', 'bo_m2a_b']) {
			useCollectionsStore().getCollection(name)!.meta!.singleton = true;
		}

		const singletons = await mountM2A();
		expect(singletons.text()).toContain(i18n.global.t('no_singleton_relations'));
	});
});

describe('options', () => {
	test('option:list-m2a.enableCreate', async () => {
		const wrapper = await mountM2A({ enableCreate: false });

		expect(wrapper.find('button.create').exists()).toBe(false);
		expect(wrapper.find('button.select').exists()).toBe(true);
	});

	test('option:list-m2a.enableSelect', async () => {
		const wrapper = await mountM2A({ enableSelect: false });

		expect(wrapper.find('button.select').exists()).toBe(false);
		expect(wrapper.find('button.create').exists()).toBe(true);
	});

	test('option:list-m2a.limit: pages, page sizes >= limit, sorting disabled above one page', async () => {
		const wrapper = await mountM2A({ limit: 1 });

		expect(rows(wrapper)).toHaveLength(1);
		expect(wrapper.find('.sorting-disabled').exists()).toBe(true);
		expect(sortable(wrapper).props('disabled')).toBe(true);
		expect(wrapper.find('.pagination').text()).toContain('1 / 2');

		const select = wrapper.findComponent({ name: 'BoSelect' });
		expect((select.props('items') as { value: string }[]).map((i) => i.value)).toEqual(['1', '10', '25', '50', '100']);

		await wrapper.find('button.next').trigger('click');
		await flushPromises();
		expect(rows(wrapper)[0]).toContain('bo_m2a_b');

		select.vm.$emit('update:modelValue', '10');
		await flushPromises();
		expect(rows(wrapper)).toHaveLength(2);
		expect(wrapper.find('.pagination').text()).toContain('1 / 1');
	});

	test('option:list-m2a.allowDuplicates: the select drawer filter drops items already linked unless true', async () => {
		// The menus wait for the relation and permission loads (several fetches on a loaded CI runner).
		const wrapper = await mountM2A();
		await vi.waitFor(() => expect(menuItems(wrapper, 'select')).toBeDefined());
		menuItems(wrapper, 'select')[0]!.onSelect!();
		await flushPromises();

		const filter = JSON.stringify(wrapper.findComponent(DrawerCollection).props('filter'));
		expect(filter).toContain('$FOLLOW(bo_junction_m2a,item,collection)');

		const duplicates = await mountM2A({ allowDuplicates: true });
		await vi.waitFor(() => expect(menuItems(duplicates, 'select')).toBeDefined());
		menuItems(duplicates, 'select')[0]!.onSelect!();
		await flushPromises();
		expect(duplicates.findComponent(DrawerCollection).props('filter')).toEqual({});
	});

	test('option:list-m2a.prefix: template on the junction row, else the collection name', async () => {
		// The rows load over several fetches: wait for them (one flush is not enough on a loaded CI runner).
		const prefixed = await mountM2A({ prefix: '#{{ sort }}' });
		await vi.waitFor(() => expect(rows(prefixed)[0]).toMatch(/^#1:/));

		const plain = await mountM2A({ prefix: null });
		await vi.waitFor(() => expect(rows(plain)[1]).toMatch(/^Bo M2A B:/));
	});
});

describe('menus', () => {
	test('create and add-existing menus list the allowed collections without singletons', async () => {
		useCollectionsStore().getCollection('bo_m2a_b')!.meta!.singleton = true;
		const wrapper = await mountM2A();

		expect(menuItems(wrapper, 'create').map((i) => i.text)).toEqual(['Bo M2A A']);
		expect(menuItems(wrapper, 'select').map((i) => i.text)).toEqual(['Bo M2A A']);
	});

	test('create new stages a junction row with the collection and the related item', async () => {
		const wrapper = await mountM2A();
		menuItems(wrapper, 'create')[1]!.onSelect!();
		await flushPromises();

		const drawer = wrapper.findComponent(DrawerItem);
		expect(drawer.props('active')).toBe(true);
		expect(drawer.props('collection')).toBe('bo_junction_m2a');
		expect(drawer.props('edits')).toEqual({ collection: 'bo_m2a_b', item: {} });

		drawer.vm.$emit('input', { collection: 'bo_m2a_b', item: { title: 'New' } });
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [{ collection: 'bo_m2a_b', item: { title: 'New' } }],
			update: [],
			delete: [],
		});
		expect(rows(wrapper)).toHaveLength(3);
	});

	test('add existing stages a junction row per selected key, then filters it out of the next selection', async () => {
		const wrapper = await mountM2A();
		menuItems(wrapper, 'select')[0]!.onSelect!();
		await flushPromises();

		wrapper.findComponent(DrawerCollection).vm.$emit('input', [2]);
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [{ bo_rel_id: 1, collection: 'bo_m2a_a', item: { id: 2 } }],
			update: [],
			delete: [],
		});

		expect(JSON.stringify(wrapper.findComponent(DrawerCollection).props('filter'))).toContain('{"id":{"_nin":[2]}}');
	});

	test('edit opens the junction drawer on the existing row and stages the update', async () => {
		const wrapper = await mountM2A();
		await wrapper.find('li[data-row-key] button.row').trigger('click');

		const drawer = wrapper.findComponent(DrawerItem);
		expect(drawer.props('primaryKey')).toBe(1);
		expect(drawer.props('relatedPrimaryKey')).toBe(1);

		drawer.vm.$emit('input', { id: 1, item: { id: 1, name: 'Changed' } });
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [{ id: 1, item: { id: 1, name: 'Changed' } }],
			delete: [],
		});
	});
});

describe('rows', () => {
	test('remove deletes an existing junction row, then undo restores it', async () => {
		const wrapper = await mountM2A();
		const [remove] = rowActions(wrapper, 0);
		expect(remove!.text).toBe(i18n.global.t('remove_item'));

		remove!.onSelect!();
		await flushPromises();
		expect(lastInput(wrapper)).toEqual({ create: [], update: [], delete: [1] });
		expect(wrapper.find('li[data-row-key="1"] .deleted').exists()).toBe(true);

		const [undo] = rowActions(wrapper, 0);
		expect(undo!.text).toBe(i18n.global.t('undo_removed_item'));
		undo!.onSelect!();
		await flushPromises();
		expect(lastInput(wrapper)).toBeUndefined();
	});

	test('removing a created row with edits asks for a confirmation', async () => {
		const wrapper = await mountM2A({
			value: { create: [{ collection: 'bo_m2a_a', item: { name: 'Draft' } }], update: [], delete: [] },
		});

		const [remove] = rowActions(wrapper, 2);
		expect(remove!.icon).toBe('delete');
		remove!.onSelect!();
		await flushPromises();

		const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
		expect(dialog.textContent).toContain(i18n.global.t('batch_delete_confirm', 1));
		[...dialog.querySelectorAll('button')].find((b) => b.textContent?.includes(i18n.global.t('delete_label')))!.click();
		await flushPromises();

		expect(lastInput(wrapper)).toBeUndefined();
	});

	test('sorting writes the sort field (1-based) on every junction row', async () => {
		const wrapper = await mountM2A();
		const list = sortable(wrapper);
		const items = list.props('modelValue') as Record<string, unknown>[];

		list.vm.$emit('update:modelValue', [items[1], items[0]]);
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [
				{ sort: 1, id: 2, collection: 'bo_m2a_b', item: { id: 'bo-13' } },
				{ sort: 2, id: 1, collection: 'bo_m2a_a', item: { id: 1 } },
			],
			delete: [],
		});
	});

	test('an item of a collection that is no longer allowed shows as invalid and can still be removed', async () => {
		useCollectionsStore().getCollection('bo_m2a_b')!.meta!.singleton = true;
		const wrapper = await mountM2A();

		expect(rows(wrapper)[1]).toContain(i18n.global.t('invalid_item'));
		expect(rowActions(wrapper, 1)).toHaveLength(1);
	});
});

describe('states', () => {
	test('disabled: no actions, rows not clickable, no select drawer', async () => {
		const wrapper = await mountM2A({ disabled: true });

		expect(wrapper.find('button.create').attributes('disabled')).toBeDefined();
		expect(wrapper.find('button.select').attributes('disabled')).toBeDefined();
		expect(wrapper.find('button.row').attributes('disabled')).toBeDefined();
		expect(rowActions(wrapper, 0)).toEqual([]);
		expect(wrapper.findComponent(DrawerCollection).exists()).toBe(false);
	});

	test('nonEditable: no create / select buttons and no row actions, rows still open the drawer', async () => {
		const wrapper = await mountM2A({ disabled: true, nonEditable: true });

		expect(wrapper.find('.actions').exists()).toBe(false);
		expect(rowActions(wrapper, 0)).toEqual([]);
		expect(wrapper.find('button.row').attributes('disabled')).toBeUndefined();
		expect(sortable(wrapper).props('disabled')).toBe(true);
	});

	test('new parent item (+): nothing fetched, created rows only', async () => {
		const wrapper = await mountM2A({ primaryKey: '+', value: [] });
		expect(wrapper.text()).toContain(i18n.global.t('no_items'));
	});
});

describe('permissions (FR-041)', () => {
	test('bo-editor: create only where both the junction and the collection allow it; remove per collection', async () => {
		await setup('bo-editor');
		const wrapper = await mountM2A();

		expect(wrapper.find('button.create').exists()).toBe(true);
		expect(wrapper.find('button.select').exists()).toBe(true);
		expect(rowActions(wrapper, 0)).toHaveLength(1);
		expect(rowActions(wrapper, 1)).toEqual([]);
	});

	test('bo-viewer: no create and no select', async () => {
		await setup('bo-viewer');
		const wrapper = await mountM2A();

		expect(wrapper.find('button.create').exists()).toBe(false);
		expect(wrapper.find('button.select').exists()).toBe(false);
	});
});

test('label linking: the list is a group named by the field label (FR-094)', async () => {
	const a11y = computed(() => ({ inputId: 'f-in', labelId: 'f-label', describedBy: 'f-note', invalid: true }));
	const wrapper = mount(ListM2A, {
		props: { ...m2aField.meta!.options!, collection: 'bo_rel', field: 'm2a', primaryKey: 1, value: [1, 2] } as never,
		global: { plugins: [i18n], provide: { [FORM_FIELD_A11Y as symbol]: a11y } },
	});
	await flushPromises();

	const group = wrapper.find('[role="group"]');
	expect(group.attributes('aria-labelledby')).toBe('f-label');
	expect(group.attributes('aria-describedby')).toBe('f-note');
	expect(group.attributes('aria-invalid')).toBe('true');
});
