// Directus has no test for components/v-remove.vue: icon and name per item state, and the confirmation when the item
// has edits (m2o, o2m, m2m, m2a) or `confirm` is set.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import BoDialog from '../../components/BoDialog.vue';
import { i18n } from '../../lang/index.ts';
import ItemRemove from './ItemRemove.vue';

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
	return mount(ItemRemove, { props, global: { plugins: [i18n] }, attachTo: document.body });
}

const name = (wrapper: ReturnType<typeof mountRemove>) => wrapper.get('button').attributes('aria-label');
const icon = (wrapper: ReturnType<typeof mountRemove>) => wrapper.get('button').text();

describe('ItemRemove', () => {
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
