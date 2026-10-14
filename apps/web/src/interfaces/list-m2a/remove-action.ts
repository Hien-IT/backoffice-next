// Ported from directus/app/src/components/v-remove.vue
// Backoffice: the relational lists put the remove action in their row menu (SortableList row menu recipe), so the
// icon, the label (Directus tooltip) and the confirmation rule of v-remove are a function here; the confirmation
// dialog (`batch_delete_confirm`) is rendered by the interface. Kept next to list-m2a (also used by
// list-o2m-tree-view) until a shared remove component exists.
import type { RelationM2A } from '../../composables/use-relation-m2a.ts';
import type { RelationM2M } from '../../composables/use-relation-m2m.ts';
import type { RelationM2O } from '../../composables/use-relation-m2o.ts';
import type { DisplayItem } from '../../composables/use-relation-multiple.ts';
import type { RelationO2M } from '../../composables/use-relation-o2m.ts';

export type RemoveActionProps = {
	itemType?: DisplayItem['$type'];
	itemInfo?: RelationM2O | RelationO2M | RelationM2M | RelationM2A;
	itemIsLocal?: boolean;
	itemEdits?: DisplayItem;
	deselect?: boolean;
	confirm?: boolean;
};

/** Icon, label key and confirmation need of the v-remove button for an item. */
export function getRemoveAction(props: RemoveActionProps): {
	icon: string;
	text: string;
	needsConfirmation: boolean;
} {
	const { itemType, itemInfo, itemIsLocal, itemEdits, deselect, confirm } = props;

	const needsConfirmation = !!confirm || hasItemEdits();
	const deselectable = deselect || itemIsLocal;

	if (needsConfirmation) return { icon: 'delete', text: 'remove_item', needsConfirmation };
	if (itemType === 'deleted') return { icon: 'settings_backup_restore', text: 'undo_removed_item', needsConfirmation };
	if (deselectable) return { icon: 'close', text: 'deselect', needsConfirmation };
	return { icon: 'delete', text: 'remove_item', needsConfirmation };

	function hasItemEdits() {
		if (!itemInfo?.type || !itemEdits) return false;

		if (itemInfo.type === 'm2o') {
			return hasEdits(itemEdits, [itemInfo.relatedPrimaryKeyField.field]);
		} else {
			if (!itemIsLocal || itemType === 'deleted') return false;

			const relationField = itemInfo.relation.field;
			if (!relationField) return false;

			if (itemInfo.type === 'o2m') {
				return hasEdits(itemEdits, [itemInfo.relatedPrimaryKeyField.field, itemInfo.sortField ?? '', relationField]);
			}

			if (itemInfo.type === 'm2m') {
				const junctionHasEdits = hasEdits(itemEdits, [
					itemInfo.junction.field,
					itemInfo.junctionPrimaryKeyField.field,
					itemInfo.sortField ?? '',
					relationField,
				]);

				if (junctionHasEdits) return true;

				const edits = itemEdits[relationField];
				if (!edits) return false;

				return hasEdits(edits, [itemInfo.relatedPrimaryKeyField.field]);
			}

			if (itemInfo.type === 'm2a') {
				const junctionHasEdits = hasEdits(itemEdits, [
					itemInfo.junction.field,
					itemInfo.junctionPrimaryKeyField.field,
					itemInfo.collectionField.field,
					itemInfo.sortField ?? '',
					relationField,
				]);

				if (junctionHasEdits) return true;

				const edits = itemEdits[relationField];
				if (!edits) return false;

				const relationPK = itemInfo.relationPrimaryKeyFields[itemEdits['collection']]?.field;
				if (!relationPK) return true;

				return hasEdits(edits, [relationPK]);
			}

			return false;
		}
	}

	function hasEdits(edits: DisplayItem, fieldsToExclude: string[]) {
		fieldsToExclude.push('$type', '$index', '$edits');
		return Object.keys(edits).filter((field) => !fieldsToExclude.includes(field)).length > 0;
	}
}
