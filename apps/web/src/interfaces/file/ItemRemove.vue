<!-- Ported from directus/app/src/components/v-remove.vue -->
<script setup lang="ts">
// Backoffice: v-remove as an `ICON_BTN` with `aria-label` (the Directus tooltip text) and the confirm Modal recipe;
// the `button` look (round white button on an image) is the caller's classes through $attrs. Kept next to the file
// interfaces until the list interfaces need it in components/.
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../components/BoButton.vue';
import BoDialog from '../../components/BoDialog.vue';
import BoIcon from '../../components/BoIcon.vue';
import type { RelationM2A } from '../../composables/use-relation-m2a.ts';
import type { RelationM2M } from '../../composables/use-relation-m2m.ts';
import type { RelationM2O } from '../../composables/use-relation-m2o.ts';
import type { DisplayItem } from '../../composables/use-relation-multiple.ts';
import type { RelationO2M } from '../../composables/use-relation-o2m.ts';

defineOptions({ inheritAttrs: false });

const {
	itemType = undefined,
	itemInfo = undefined,
	itemIsLocal,
	itemEdits = undefined,
	deselect,
	disabled,
	confirm,
} = defineProps<{
	itemType?: DisplayItem['$type'];
	itemInfo?: RelationM2O | RelationO2M | RelationM2M | RelationM2A | undefined;
	itemIsLocal?: boolean;
	itemEdits?: DisplayItem | Record<string, any>;
	deselect?: boolean;
	disabled?: boolean;
	confirm?: boolean;
}>();

const emit = defineEmits(['action']);

const { t } = useI18n();

const { needsConfirmation, confirmDelete, onConfirmDelete } = useConfirmation();

const deselectable = computed(() => deselect || itemIsLocal);

const icon = computed(() => {
	if (needsConfirmation.value) return 'delete';
	if (itemType === 'deleted') return 'settings_backup_restore';
	if (deselectable.value) return 'close';
	return 'delete';
});

// Backoffice: also the accessible name, so it is kept when disabled.
const tooltip = computed(() => {
	if (needsConfirmation.value) return t('remove_item');
	if (itemType === 'deleted') return t('undo_removed_item');
	if (deselectable.value) return t('deselect');
	return t('remove_item');
});

function onClick(event: Event) {
	if (needsConfirmation.value) {
		confirmDelete.value = true;
		return;
	}

	emit('action', event);
}

function useConfirmation() {
	const confirmDelete = ref(false);

	const needsConfirmation = computed(() => {
		return confirm || hasItemEdits();
	});

	return { needsConfirmation, confirmDelete, onConfirmDelete };

	function onConfirmDelete() {
		confirmDelete.value = false;
		emit('action');
	}

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

const ICON_BTN =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<button
		type="button"
		:class="ICON_BTN"
		v-bind="$attrs"
		:disabled="disabled"
		:aria-label="tooltip"
		:title="disabled ? undefined : tooltip"
		@click.stop="onClick"
	>
		<BoIcon :name="icon" size="sm" />
	</button>

	<BoDialog v-model:open="confirmDelete" :title="$t('batch_delete_confirm', 1)">
		<template #actions>
			<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
			<BoButton variant="danger" @click="onConfirmDelete">{{ $t('delete_label') }}</BoButton>
		</template>
	</BoDialog>
</template>
