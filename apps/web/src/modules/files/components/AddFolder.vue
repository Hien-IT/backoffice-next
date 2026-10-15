<!-- Ported from directus/app/src/modules/files/components/add-folder.vue -->
<script setup lang="ts">
// Backoffice: BoDialog with the Modal recipe (Cancel first, D-76) and an icon Button activator (`create_new_folder`);
// errors show in the dialog (D-66) instead of the unexpectedError dialog.
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoInput from '../../../components/BoInput.vue';
import BoNotice from '../../../components/BoNotice.vue';
import { useFolders } from '../../../composables/use-folders.ts';
import { type APIError, translateAPIError } from '../../../lang/index.ts';
import { unexpectedError } from '../../../utils/unexpected-error.ts';

const props = defineProps<{
	parent?: string | undefined;
	disabled?: boolean;
}>();

const router = useRouter();

const dialogActive = ref(false);
const saving = ref(false);
const newFolderName = ref<string | null>(null);
const error = ref<string | null>(null);

const { fetchFolders } = useFolders();

async function addFolder() {
	if (!newFolderName.value || saving.value) return;

	saving.value = true;
	error.value = null;

	try {
		const newFolder = await sdk.request(
			requestEndpoint<{ id: string }>('/folders', {
				method: 'POST',
				body: {
					name: newFolderName.value,
					parent: props.parent === 'root' ? null : (props.parent ?? null),
				},
			}),
		);

		await fetchFolders();

		dialogActive.value = false;
		newFolderName.value = null;

		router.push({ name: 'folders-collection', params: { folder: newFolder.id } });
	} catch (err) {
		error.value = translateAPIError(unexpectedError(err) as APIError);
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<BoButton
		variant="secondary"
		icon="create_new_folder"
		:aria-label="disabled ? $t('not_allowed') : $t('create_folder')"
		:title="disabled ? $t('not_allowed') : $t('create_folder')"
		:disabled="!!disabled"
		@click="dialogActive = true"
	/>

	<BoDialog v-model:open="dialogActive" :title="$t('create_folder')">
		<form id="add-folder-form" class="flex flex-col gap-4" @submit.prevent="addFolder">
			<BoInput v-model="newFolderName" :label="$t('folder_name')" :placeholder="$t('folder_name')" autofocus />
			<BoNotice v-if="error" type="danger">{{ error }}</BoNotice>
		</form>
		<template #actions>
			<BoButton variant="secondary" @click="dialogActive = false">{{ $t('cancel') }}</BoButton>
			<BoButton type="submit" form="add-folder-form" :disabled="!newFolderName" :loading="saving">
				{{ $t('save') }}
			</BoButton>
		</template>
	</BoDialog>
</template>
