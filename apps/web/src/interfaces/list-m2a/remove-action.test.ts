// Icon, label and confirmation rule of v-remove (Directus has no v-remove test).
import { describe, expect, test } from 'vitest';
import type { RelationM2A } from '../../composables/use-relation-m2a.ts';
import type { RelationO2M } from '../../composables/use-relation-o2m.ts';
import { getRemoveAction } from './remove-action.ts';

const o2m = {
	type: 'o2m',
	relation: { field: 'parent' },
	relatedPrimaryKeyField: { field: 'id' },
	sortField: 'sort',
} as unknown as RelationO2M;

const m2a = {
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
		expect(getRemoveAction({ itemInfo: o2m, itemEdits: {} })).toEqual({
			icon: 'delete',
			text: 'remove_item',
			needsConfirmation: false,
		});
	});

	test('removed item: undo', () => {
		expect(getRemoveAction({ itemType: 'deleted', itemInfo: o2m, itemIsLocal: true, itemEdits: { title: 'x' } })).toEqual(
			{ icon: 'settings_backup_restore', text: 'undo_removed_item', needsConfirmation: false },
		);
	});

	test('local item without edits or deselect: close / deselect', () => {
		expect(getRemoveAction({ itemIsLocal: true, itemInfo: o2m, itemEdits: { id: 1, sort: 2, parent: 1 } })).toMatchObject(
			{ icon: 'close', text: 'deselect', needsConfirmation: false },
		);

		expect(getRemoveAction({ deselect: true })).toMatchObject({ icon: 'close', text: 'deselect' });
	});

	test('local item with edits, or confirm: needs a confirmation', () => {
		expect(getRemoveAction({ itemIsLocal: true, itemInfo: o2m, itemEdits: { name: 'Draft' } })).toEqual({
			icon: 'delete',
			text: 'remove_item',
			needsConfirmation: true,
		});

		expect(getRemoveAction({ confirm: true }).needsConfirmation).toBe(true);
	});

	test('m2a: edits of the related item count, its primary key does not', () => {
		const base = { itemIsLocal: true, itemInfo: m2a };

		expect(getRemoveAction({ ...base, itemEdits: { collection: 'bo_m2a_a', item: { id: 1 } } }).needsConfirmation).toBe(
			false,
		);

		expect(
			getRemoveAction({ ...base, itemEdits: { collection: 'bo_m2a_a', item: { id: 1, name: 'x' } } }).needsConfirmation,
		).toBe(true);

		expect(getRemoveAction({ ...base, itemEdits: { collection: 'gone', item: { id: 1 } } }).needsConfirmation).toBe(true);
	});
});
