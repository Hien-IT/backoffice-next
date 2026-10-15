<!-- Ported from directus/app/src/modules/files/components/delete-folder-dialog.vue -->
<script setup lang="ts">
// Backoffice: BoDialog with the Modal recipe (Cancel first, D-76), the content behaviour as a BoRadio group; errors
// show in the dialog (D-66) instead of the error dialog of unexpectedError.
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoRadio from '../../../components/BoRadio.vue';
import type { Folder } from '../../../composables/use-folders.ts';
import { type APIError, translateAPIError } from '../../../lang/index.ts';
import { moveAndDelete, recursiveDelete } from '../../../utils/delete-folder.ts';
import { unexpectedError } from '../../../utils/unexpected-error.ts';

const modelValue = defineModel<boolean>({ required: true });

const props = defineProps<{
	folders: Folder[];
	allFolders: Folder[];
}>();

const emit = defineEmits<{
	done: [];
}>();

const { t } = useI18n();

type DeleteMode = 'move' | 'delete';

const deleteMode = ref<DeleteMode>('move');
const saving = ref(false);
const error = ref<string | null>(null);

watch(modelValue, (val) => {
	if (val) {
		deleteMode.value = 'move';
		error.value = null;
	}
});

const radioOptions = [
	{ value: 'move', text: t('delete_folder_dialog.move_content') },
	{ value: 'delete', text: t('delete_folder_dialog.delete_content') },
];

async function save() {
	if (saving.value) return;
	saving.value = true;
	error.value = null;

	try {
		if (deleteMode.value === 'move') {
			await moveAndDelete(props.folders);
		} else {
			await recursiveDelete(props.folders, props.allFolders);
		}

		modelValue.value = false;
		emit('done');
	} catch (err) {
		error.value = translateAPIError(unexpectedError(err) as APIError);
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<BoDialog v-model:open="modelValue" :title="$t('delete_folder')">
		<form id="delete-folder-form" class="flex flex-col gap-4" @submit.prevent="save">
			<p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('delete_folder_dialog.content_behavior') }}</p>
			<BoRadio
				:model-value="deleteMode"
				:items="radioOptions"
				:label="$t('delete_folder_dialog.content_behavior')"
				@update:model-value="deleteMode = $event as DeleteMode"
			/>
			<BoNotice v-if="error" type="danger">{{ error }}</BoNotice>
		</form>
		<template #actions>
			<BoButton variant="secondary" @click="modelValue = false">{{ $t('cancel') }}</BoButton>
			<BoButton type="submit" form="delete-folder-form" variant="danger" :loading="saving">
				{{ $t('delete_label') }}
			</BoButton>
		</template>
	</BoDialog>
</template>
