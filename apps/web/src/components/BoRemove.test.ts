// Directus has no test for components/v-remove.vue: icon and name per item state, the confirmation when the item has
// edits (m2o, o2m, m2m, m2a) or `confirm` is set, and the getRemoveAction rule used by the row menus.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { RelationM2A } from '../composables/use-relation-m2a.ts';
import type { RelationO2M } from '../composables/use-relation-o2m.ts';
import { i18n } from '../lang/index.ts';
import BoDialog from './BoDialog.vue';
import BoRemove, { getRemoveAction } from './BoRemove.vue';

enableAutoUnmount(afterEach);

beforeEach(() => {
	document.body.innerHTML = '';
});

const m2o = { type: 'm2o', relatedPrimaryKeyField: { field: 'id' } };
const o2m = { type: 'o2m', relatedPrimaryKeyField: { field: 'id' }, sortField: 'sort', relation: { field: 'parent' } };
const m2m = {
	type: 'm2m',
	relatedPrimaryKeyField: { field: 'id' },
	junctionPrimaryKeyField: { field: 'id' },
	junction: { field: 'item_id' },
	relation: { field: 'file_id' },
	sortField: 'sort',
};
const m2a = {
	type: 'm2a',
	junctionPrimaryKeyField: { field: 'id' },
	junction: { field: 'item_id' },
	relation: { field: 'item' },
	collectionField: { field: 'collection' },
	relationPrimaryKeyFields: { a: { field: 'id' } },
};

function mountRemove(props: Record<string, unknown> = {}) {
	return mount(BoRemove, { props, global: { plugins: [i18n] }, attachTo: document.body });
}

const name = (wrapper: ReturnType<typeof mountRemove>) => wrapper.get('button').attributes('aria-label');
const icon = (wrapper: ReturnType<typeof mountRemove>) => wrapper.get('button').attributes('data-icon');

describe('BoRemove', () => {
	test.each([
		[{}, 'Remove Item', 'delete'],
		[{ deselect: true }, 'Deselect', 'close'],
		[{ itemIsLocal: true }, 'Deselect', 'close'],
		[{ itemType: 'deleted' }, 'Undo Removed Item', 'settings_backup_restore'],
		[{ confirm: true }, 'Remove Item', 'delete'],
	])('%o: %s', (props, label, iconName) => {
		const wrapper = mountRemove(props);

		expect(name(wrapper)).toBe(label);
		expect(icon(wrapper)).toBe(iconName);
	});

	test('emits action on click without edits', async () => {
		const wrapper = mountRemove({ deselect: true, itemInfo: m2o, itemEdits: { id: 1 } });

		await wrapper.get('button').trigger('click');
		expect(wrapper.emitted('action')).toHaveLength(1);
	});

	test('disabled: no action, name kept, no tooltip', async () => {
		const wrapper = mountRemove({ deselect: true, disabled: true });

		expect(wrapper.get('button').attributes('disabled')).toBeDefined();
		expect(name(wrapper)).toBe('Deselect');
		expect(wrapper.get('button').attributes('title')).toBeUndefined();
	});

	test.each([
		['m2o', { itemInfo: m2o, itemEdits: { id: 1, title: 'x' } }],
		['o2m', { itemInfo: o2m, itemIsLocal: true, itemEdits: { id: 1, title: 'x' } }],
		['m2m junction', { itemInfo: m2m, itemIsLocal: true, itemEdits: { id: 1, note: 'x' } }],
		['m2m related', { itemInfo: m2m, itemIsLocal: true, itemEdits: { file_id: { id: 'f', title: 'x' } } }],
		['m2a related', { itemInfo: m2a, itemIsLocal: true, itemEdits: { collection: 'a', item: { id: 1, t: 'x' } } }],
		['m2a unknown collection', { itemInfo: m2a, itemIsLocal: true, itemEdits: { collection: 'b', item: { id: 1 } } }],
		['confirm', { confirm: true }],
	])('%s with edits asks before the action', async (_, props) => {
		const wrapper = mountRemove(props);

		await wrapper.get('button').trigger('click');
		expect(wrapper.emitted('action')).toBeUndefined();
		expect(wrapper.getComponent(BoDialog).props('open')).toBe(true);

		[...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Cancel')!.click();
		await flushPromises();
		expect(wrapper.getComponent(BoDialog).props('open')).toBe(false);
		expect(wrapper.emitted('action')).toBeUndefined();

		await wrapper.get('button').trigger('click');
		[...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Delete')!.click();
		await flushPromises();
		expect(wrapper.emitted('action')).toHaveLength(1);
	});

	test.each([
		['m2o key only', { itemInfo: m2o, itemEdits: { id: 1, $type: 'created', $index: 0 } }],
		['o2m not local', { itemInfo: o2m, itemEdits: { id: 1, title: 'x' } }],
		['m2m deleted', { itemInfo: m2m, itemIsLocal: true, itemType: 'deleted', itemEdits: { note: 'x' } }],
		['m2m keys only', { itemInfo: m2m, itemIsLocal: true, itemEdits: { item_id: 1, file_id: { id: 'f' } } }],
		['m2m no related edits', { itemInfo: m2m, itemIsLocal: true, itemEdits: { sort: 1 } }],
		['m2a keys only', { itemInfo: m2a, itemIsLocal: true, itemEdits: { collection: 'a', item: { id: 1 } } }],
		['m2a no related edits', { itemInfo: m2a, itemIsLocal: true, itemEdits: { collection: 'a' } }],
		['no relation field', { itemInfo: { ...m2m, relation: { field: '' } }, itemIsLocal: true, itemEdits: { a: 1 } }],
		['unknown type', { itemInfo: { type: 'x', relation: { field: 'r' } }, itemIsLocal: true, itemEdits: { a: 1 } }],
	])('%s: no confirmation', async (_, props) => {
		const wrapper = mountRemove(props);

		await wrapper.get('button').trigger('click');
		expect(wrapper.emitted('action')).toHaveLength(1);
	});
});

const o2mInfo = {
	type: 'o2m',
	relation: { field: 'parent' },
	relatedPrimaryKeyField: { field: 'id' },
	sortField: 'sort',
} as unknown as RelationO2M;

const m2aInfo = {
	type: 'm2a',
	relation: { field: 'item' },
	junction: { field: 'bo_rel_id' },
	junctionPrimaryKeyField: { field: 'id' },
	collectionField: { field: 'collection' },
	relationPrimaryKeyFields: { bo_m2a_a: { field: 'id' } },
	sortField: 'sort',
} as unknown as RelationM2A;

describe('getRemoveAction', () => {
	test('existing item: delete / remove_item', () => {
		expect(getRemoveAction({ itemInfo: o2mInfo, itemEdits: {} })).toEqual({
			icon: 'delete',
			text: 'remove_item',
			needsConfirmation: false,
		});
	});

	test('removed item: undo', () => {
		expect(getRemoveAction({ itemType: 'deleted', itemInfo: o2mInfo, itemIsLocal: true, itemEdits: { title: 'x' } })).toEqual(
			{ icon: 'settings_backup_restore', text: 'undo_removed_item', needsConfirmation: false },
		);
	});

	test('local item without edits or deselect: close / deselect', () => {
		expect(getRemoveAction({ itemIsLocal: true, itemInfo: o2mInfo, itemEdits: { id: 1, sort: 2, parent: 1 } })).toMatchObject(
			{ icon: 'close', text: 'deselect', needsConfirmation: false },
		);

		expect(getRemoveAction({ deselect: true })).toMatchObject({ icon: 'close', text: 'deselect' });
	});

	test('local item with edits, or confirm: needs a confirmation', () => {
		expect(getRemoveAction({ itemIsLocal: true, itemInfo: o2mInfo, itemEdits: { name: 'Draft' } })).toEqual({
			icon: 'delete',
			text: 'remove_item',
			needsConfirmation: true,
		});

		expect(getRemoveAction({ confirm: true }).needsConfirmation).toBe(true);
	});

	test('m2a: edits of the related item count, its primary key does not', () => {
		const base = { itemIsLocal: true, itemInfo: m2aInfo };

		expect(getRemoveAction({ ...base, itemEdits: { collection: 'bo_m2a_a', item: { id: 1 } } }).needsConfirmation).toBe(
			false,
		);

		expect(
			getRemoveAction({ ...base, itemEdits: { collection: 'bo_m2a_a', item: { id: 1, name: 'x' } } }).needsConfirmation,
		).toBe(true);

		expect(getRemoveAction({ ...base, itemEdits: { collection: 'gone', item: { id: 1 } } }).needsConfirmation).toBe(true);
	});
});
