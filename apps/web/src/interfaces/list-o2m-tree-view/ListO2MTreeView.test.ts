// list-o2m-tree-view on the fixture snapshot (Directus has no test for it): bo_tree.children (recursive o2m on
// bo_tree.parent, sort field `sort`), the option checks of contracts/tests.md §5 (FR-047), the nested
// {create, update, delete} values (FR-040) and Indent / Outdent (D-60) giving the value of the equivalent drag.
// The keyboard paths through the row menu are in ListO2MTreeView.browser.test.ts.
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, type DefineComponent, ref } from 'vue';
import { replaceQueue } from '../../api/sdk.ts';
import type { BoMenuItem } from '../../components/BoMenu.vue';
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
import { fieldsOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import ListO2MTreeView from './ListO2MTreeView.vue';

enableAutoUnmount(afterEach);

// A generic SFC: typed as a plain component for findComponent.
const BoSortableList = BoSortableListComponent as unknown as DefineComponent<Record<string, any>>;

const snapshot = loadSnapshot();
const treeField = fieldsOf('bo_tree').find((f) => f.field === 'children')!;
let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	Element.prototype.scrollIntoView = vi.fn();
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(snapshot);
	await useUserStore().hydrate();

	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	vi.restoreAllMocks();
});

type Wrapper = VueWrapper<InstanceType<typeof ListO2MTreeView>>;

/** Mount like FormFieldInterface: meta.options spread as props, the value fed back on input. */
async function mountTree(
	props: Record<string, unknown> = {},
	options: Record<string, unknown> = treeField.meta!.options!,
	provide: Record<string | symbol, unknown> = {},
) {
	const wrapper = mount(ListO2MTreeView, {
		props: {
			...options,
			collection: 'bo_tree',
			field: 'children',
			primaryKey: 1,
			value: [2, 4],
			onInput: (value: unknown) => wrapper.setProps({ value } as never),
			...props,
		} as never,
		global: { plugins: [i18n], provide },
		attachTo: document.body,
	});

	await flushPromises();
	return wrapper as unknown as Wrapper;
}

const lastInput = (wrapper: Wrapper) => wrapper.emitted<[unknown]>('input')?.at(-1)?.[0];
/** Row names of one level (its own rows, not the nested ones); [] when the level has no list. */
function names(wrapper: Wrapper, index = 0): string[] {
	const list = wrapper.findAllComponents(BoSortableList)[index];
	if (!list) return [];
	return [...(list.element as HTMLElement).querySelector('ul')!.children].map((li) => li.querySelector('.template')!.textContent!.trim());
}
const level = (wrapper: Wrapper, index = 0) => wrapper.findAllComponents(BoSortableList)[index]!;

function rowActions(wrapper: Wrapper, index: number, levelIndex = 0): BoMenuItem[] {
	const list = level(wrapper, levelIndex);
	const element = (list.props('modelValue') as Record<string, unknown>[])[index];
	return (list.props('rowActions') as (e: unknown, i: number) => BoMenuItem[])(element, index);
}

async function expand(wrapper: Wrapper, name: string) {
	const row = wrapper.findAll('.preview').find((r) => r.find('.template').text() === name)!;
	await row.find('button.chevron').trigger('click');
	await flushPromises();
}

describe('config', () => {
	test('registers list-o2m-tree-view for alias o2m fields', () => {
		expect(config.id).toBe('list-o2m-tree-view');
		expect(config.localTypes).toEqual(['o2m']);
	});
});

describe('fixture', () => {
	test('shows the children of the item with the display template, no input on mount', async () => {
		const wrapper = await mountTree();

		expect(names(wrapper)).toEqual(['Child A', 'Child B']);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('expanding an item loads its children (all items, limit -1)', async () => {
		const wrapper = await mountTree();
		await expand(wrapper, 'Child A');

		expect(names(wrapper, 1)).toEqual(['Grandchild']);
		expect(wrapper.find('button.chevron').attributes('aria-expanded')).toBe('true');
		expect(calls(fetch).some((c) => c.includes('/items/bo_tree') && c.includes('limit=-1'))).toBe(true);
	});

	test('missing options: create and select shown, collection display template', async () => {
		const wrapper = await mountTree({}, {});

		expect(wrapper.find('button.create').exists()).toBe(true);
		expect(wrapper.find('button.select').exists()).toBe(true);
		expect(names(wrapper)).toEqual(['Child A', 'Child B']);
	});

	test('notice when the relation is not recursive', async () => {
		const wrapper = await mountTree({ collection: 'bo_rel', field: 'o2m_list' });
		expect(wrapper.text()).toContain(i18n.global.t('interfaces.list-o2m-tree-view.recursive_only'));
	});

	test('no items on a new item', async () => {
		const wrapper = await mountTree({ primaryKey: '+', value: [] });
		expect(wrapper.text()).toContain(i18n.global.t('no_items'));
	});
});

describe('options', () => {
	test('option:list-o2m-tree-view.displayTemplate', async () => {
		const wrapper = await mountTree({ displayTemplate: '#{{ id }}' });
		expect(names(wrapper)).toEqual(['#2', '#4']);
	});

	test('option:list-o2m-tree-view.enableCreate', async () => {
		const wrapper = await mountTree({ enableCreate: false });
		expect(wrapper.find('button.create').exists()).toBe(false);
		expect(wrapper.find('button.select').exists()).toBe(true);
	});

	test('option:list-o2m-tree-view.enableSelect', async () => {
		const wrapper = await mountTree({ enableSelect: false });
		expect(wrapper.find('button.select').exists()).toBe(false);
		expect(wrapper.find('button.create').exists()).toBe(true);
	});

	test('option:list-o2m-tree-view.filter: applied to the select drawer, {{ field }} filled from the form values', async () => {
		const fixture = await mountTree();
		expect(fixture.findComponent(DrawerCollection).props('filter')).toEqual({ _and: [{ name: { _nnull: true } }] });

		const wrapper = await mountTree({ filter: { name: { _neq: '{{ name }}' } } }, treeField.meta!.options!, {
			values: ref({ name: 'Root' }),
		});

		expect(wrapper.findComponent(DrawerCollection).props('filter')).toEqual({ name: { _neq: 'Root' } });
	});
});

describe('edits', () => {
	test('create new stages a child of the item', async () => {
		const wrapper = await mountTree();
		await wrapper.find('button.create').trigger('click');

		const drawer = wrapper.findAllComponents(DrawerItem).find((d) => d.props('active'))!;
		drawer.vm.$emit('input', { name: 'New' });
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({ create: [{ name: 'New', parent: 1 }], update: [], delete: [] });
		expect(names(wrapper)).toContain('New');
	});

	test('add existing selects items as children', async () => {
		const wrapper = await mountTree();
		await wrapper.find('button.select').trigger('click');

		wrapper.findComponent(DrawerCollection).vm.$emit('input', [3]);
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({ create: [], update: [{ parent: 1, id: 3 }], delete: [] });
	});

	test('editing a nested item puts its changes under the parent item (item[field])', async () => {
		const wrapper = await mountTree();
		await expand(wrapper, 'Child A');

		rowActions(wrapper, 0, 1)[0]!.onSelect!();
		await flushPromises();

		const drawer = wrapper.findAllComponents(DrawerItem).find((d) => d.props('active'))!;
		expect(drawer.props('primaryKey')).toBe(3);
		drawer.vm.$emit('input', { id: 3, name: 'Grandchild 2' });
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [
				{
					id: 2,
					name: 'Child A',
					sort: 1,
					children: { create: [], update: [{ id: 3, name: 'Grandchild 2' }], delete: [] },
				},
			],
			delete: [],
		});
		expect(names(wrapper, 1)).toEqual(['Grandchild 2']);
	});

	test('remove deletes the item, undo restores it', async () => {
		const wrapper = await mountTree();
		const [, remove] = rowActions(wrapper, 0);
		expect(remove!.text).toBe(i18n.global.t('remove_item'));

		remove!.onSelect!();
		await flushPromises();
		expect(lastInput(wrapper)).toEqual({ create: [], update: [], delete: [2] });
		expect(wrapper.find('.preview.deleted').exists()).toBe(true);

		rowActions(wrapper, 0)[1]!.onSelect!();
		await flushPromises();
		expect(lastInput(wrapper)).toBeUndefined();
	});
});

describe('moves (drag and keyboard D-60)', () => {
	test('reordering a level writes the sort field (0-based) like a drag', async () => {
		const wrapper = await mountTree();
		const list = level(wrapper);
		const [a, b] = list.props('modelValue') as Record<string, unknown>[];

		list.vm.$emit('update:modelValue', [b, a]);
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [
				{ id: 4, name: 'Child B', sort: 0 },
				{ id: 2, name: 'Child A', sort: 1 },
			],
			delete: [],
		});
	});

	test('indent makes the row a child of its previous sibling (drop into the open sibling)', async () => {
		const wrapper = await mountTree();

		level(wrapper).vm.$emit('indent', 1);
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [
				{
					id: 2,
					name: 'Child A',
					sort: 1,
					children: { create: [], update: [{ id: 4, name: 'Child B', sort: 2, parent: 2 }], delete: [] },
				},
			],
			delete: [],
		});
		expect(names(wrapper)).toEqual(['Child A']);
		expect(names(wrapper, 1)).toEqual(['Grandchild', 'Child B']);
	});

	test('outdent moves the row after its parent (drop on the parent level)', async () => {
		const wrapper = await mountTree();
		await expand(wrapper, 'Child A');

		level(wrapper, 1).vm.$emit('outdent', 0);
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [{ id: 3, name: 'Grandchild', sort: 1, parent: 1 }],
			delete: [],
		});
		expect(names(wrapper)).toEqual(['Child A', 'Grandchild', 'Child B']);
		expect(names(wrapper, 1)).toEqual([]);
	});

	test('a created item can be indented (stays a create, under the new parent)', async () => {
		const wrapper = await mountTree({ value: { create: [{ name: 'New', parent: 1 }], update: [], delete: [] } });
		expect(names(wrapper)).toEqual(['Child A', 'Child B', 'New']);

		level(wrapper).vm.$emit('indent', 2);
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [{ id: 4, name: 'Child B', sort: 2, children: { create: [{ name: 'New', parent: 1 }], update: [], delete: [] } }],
			delete: [],
		});
	});

	test('the root level has no Outdent, nested levels do', async () => {
		const wrapper = await mountTree();
		await expand(wrapper, 'Child A');

		expect(level(wrapper).props('tree')).toBe(true);
		expect(level(wrapper).props('nested')).toBe(false);
		expect(level(wrapper, 1).props('nested')).toBe(true);
	});
});

describe('states', () => {
	test('disabled: no moves, no row actions, no select drawer, buttons disabled', async () => {
		const wrapper = await mountTree({ disabled: true });

		expect(level(wrapper).props('disabled')).toBe(true);
		expect(rowActions(wrapper, 0)).toEqual([]);
		expect(wrapper.findComponent(DrawerCollection).exists()).toBe(false);
		expect(wrapper.find('button.create').attributes('disabled')).toBeDefined();
		expect(wrapper.find('button.chevron').attributes('disabled')).toBeDefined();
	});

	test('nonEditable: no actions, the preview opens the item drawer', async () => {
		const wrapper = await mountTree({ disabled: true, nonEditable: true });

		expect(wrapper.find('.actions').exists()).toBe(false);
		expect(rowActions(wrapper, 0)).toEqual([]);
		expect(wrapper.find('button.chevron').attributes('disabled')).toBeUndefined();

		await wrapper.find('button.view').trigger('click');
		const drawer = wrapper.findAllComponents(DrawerItem).find((d) => d.props('active'))!;
		expect(drawer.props('primaryKey')).toBe(2);
		expect(drawer.props('nonEditable')).toBe(true);
	});
});

test('label linking: the tree is a group named by the field label (FR-094)', async () => {
	const a11y = computed(() => ({ inputId: 'f-in', labelId: 'f-label', describedBy: 'f-note', invalid: false }));
	const wrapper = await mountTree({}, treeField.meta!.options!, { [FORM_FIELD_A11Y as symbol]: a11y });

	const group = wrapper.find('[role="group"]');
	expect(group.attributes('aria-labelledby')).toBe('f-label');
	expect(group.attributes('aria-describedby')).toBe('f-note');
	expect(group.attributes('aria-invalid')).toBeUndefined();
});
