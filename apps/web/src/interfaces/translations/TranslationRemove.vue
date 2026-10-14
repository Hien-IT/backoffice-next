<!-- Ported from directus/app/src/components/v-remove.vue -->
<script setup lang="ts">
// Backoffice: only the icon form (no `button`) and the m2m branch of hasItemEdits that translation-form.vue uses.
// shortcut: no shared BoRemove yet, move this to src/components when a second relational interface needs it.
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../components/BoButton.vue';
import BoDialog from '../../components/BoDialog.vue';
import BoIcon from '../../components/BoIcon.vue';
import type { RelationM2M } from '../../composables/use-relation-m2m.ts';
import type { DisplayItem } from '../../composables/use-relation-multiple.ts';

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
	itemInfo?: RelationM2M | undefined;
	itemIsLocal?: boolean;
	itemEdits?: DisplayItem;
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

// Backoffice: the Directus tooltip text is also the accessible name (it is null when disabled in Directus).
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
		if (!itemIsLocal || itemType === 'deleted') return false;

		const relationField = itemInfo.relation.field;
		if (!relationField) return false;

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

	function hasEdits(edits: DisplayItem, fieldsToExclude: string[]) {
		fieldsToExclude.push('$type', '$index', '$edits');
		return Object.keys(edits).filter((field) => !fieldsToExclude.includes(field)).length > 0;
	}
}
</script>

<template>
	<button
		type="button"
		class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:text-error-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-error-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
		:aria-label="tooltip"
		:title="disabled ? undefined : tooltip"
		:disabled
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
