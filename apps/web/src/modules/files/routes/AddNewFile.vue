<!-- Ported from directus/app/src/modules/files/routes/add-new.vue -->
<script setup lang="ts">
// Backoffice: BoDialog with BoUpload (multiple, from URL, the folder and the allowed types of the server); closing goes
// back to the library route (useDialogRoute). Each uploaded file emits `upload` so the library reloads (Directus
// reloads on the `upload` event); the upload goes on when the dialog closes (FR-020, CHK007).
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoUpload from '../../../components/files/BoUpload.vue';
import { useDialogRoute } from '../../../composables/use-dialog-route.ts';
import { parseGlobalMimeTypeAllowList } from '../../../composables/use-mime-type-filter.ts';
import { useServerStore } from '../../../stores/server.ts';

const props = defineProps<{
	folder?: string | undefined;
}>();

const emit = defineEmits<{
	upload: [];
}>();

const router = useRouter();

const isOpen = useDialogRoute();

const { info } = useServerStore();

const allowedMimeTypes = computed(() => {
	return parseGlobalMimeTypeAllowList(info.files?.mimeTypeAllowList)?.join(',');
});

function close() {
	router.push(
		props.folder ? { name: 'folders-collection', params: { folder: props.folder } } : { name: 'files-collection' },
	);
}

function onInput() {
	emit('upload');
	close();
}
</script>

<template>
	<BoDialog :open="isOpen" :title="$t('add_file')" @update:open="!$event && close()">
		<BoUpload :folder="folder" multiple from-url :accept="allowedMimeTypes" @input="onInput" />
		<template #actions>
			<BoButton variant="secondary" @click="close">{{ $t('done') }}</BoButton>
		</template>
	</BoDialog>
</template>
