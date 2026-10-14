<!-- Ported from directus/app/src/components/v-remove.vue -->
<script lang="ts">
// Backoffice: the icon, tooltip and confirmation rule of v-remove are also exported as `getRemoveAction`, so the lists
// whose remove action is a row menu item (D-60: list-m2a, list-o2m-tree-view, list, collection-item-multiple-dropdown)
// share the same rule and render the `batch_delete_confirm` dialog themselves.
import type { RelationM2A } from '../composables/use-relation-m2a.ts';
import type { RelationM2M } from '../composables/use-relation-m2m.ts';
import type { RelationM2O } from '../composables/use-relation-m2o.ts';
import type { DisplayItem } from '../composables/use-relation-multiple.ts';
import type { RelationO2M } from '../composables/use-relation-o2m.ts';

export type RemoveActionProps = {
	itemType?: DisplayItem['$type'] | undefined;
	itemInfo?: RelationM2O | RelationO2M | RelationM2M | RelationM2A | undefined;
	itemIsLocal?: boolean | undefined;
	itemEdits?: DisplayItem | Record<string, any> | undefined;
	deselect?: boolean | undefined;
	confirm?: boolean | undefined;
};

/** Icon, tooltip key and confirmation need of the v-remove button for an item. */
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

	function hasEdits(edits: Record<string, any>, fieldsToExclude: string[]) {
		fieldsToExclude.push('$type', '$index', '$edits');
		return Object.keys(edits).filter((field) => !fieldsToExclude.includes(field)).length > 0;
	}
}
</script>

<script setup lang="ts">
// Backoffice: the clickable icon and the `button` form are both an icon button (an icon with a click handler is not
// keyboard usable) whose aria-label is the Directus tooltip text (kept when disabled, where Directus has no tooltip);
// the `button` look (round button on an image) comes from the caller's classes through $attrs. The confirm dialog is
// BoDialog (Reka keeps the focus inside it, so v-prevent-focusout is not needed).
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from './BoButton.vue';
import BoDialog from './BoDialog.vue';
import BoIcon from './BoIcon.vue';

defineOptions({ inheritAttrs: false });

const {
	itemType = undefined,
	itemInfo = undefined,
	itemIsLocal,
	itemEdits = undefined,
	deselect,
	disabled = false,
	confirm,
} = defineProps<{
	itemType?: DisplayItem['$type'];
	itemInfo?: RelationM2O | RelationO2M | RelationM2M | RelationM2A | undefined;
	itemIsLocal?: boolean;
	itemEdits?: DisplayItem | Record<string, any>;
	deselect?: boolean;
	disabled?: boolean | undefined;
	confirm?: boolean;
}>();

const emit = defineEmits(['action']);

const { t } = useI18n();

const action = computed(() => getRemoveAction({ itemType, itemInfo, itemIsLocal, itemEdits, deselect, confirm }));
const icon = computed(() => action.value.icon);
const tooltip = computed(() => t(action.value.text));

const confirmDelete = ref(false);

function onClick(event: Event) {
	if (action.value.needsConfirmation) {
		confirmDelete.value = true;
		return;
	}

	emit('action', event);
}

function onConfirmDelete() {
	confirmDelete.value = false;
	emit('action');
}

const ICON_BTN =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-error-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-error-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<button
		type="button"
		:class="ICON_BTN"
		v-bind="$attrs"
		:disabled
		:aria-label="tooltip"
		:title="disabled ? undefined : tooltip"
		:data-icon="icon"
		@click.stop="onClick"
	>
		<BoIcon :name="icon" size="sm" />
	</button>

	<BoDialog v-model:open="confirmDelete" :title="t('batch_delete_confirm', 1)">
		<template #actions>
			<BoButton variant="secondary" @click="confirmDelete = false">{{ t('cancel') }}</BoButton>
			<BoButton variant="danger" @click="onConfirmDelete">{{ t('delete_label') }}</BoButton>
		</template>
	</BoDialog>
</template>
