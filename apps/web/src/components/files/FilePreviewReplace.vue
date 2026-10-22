<!-- Ported from directus/app/src/views/private/components/file-preview-replace.vue -->
<script setup lang="ts">
// Backoffice: recipe "File page and file details" (Q-15): the preview block (013 FilePreview) with a secondary
// "replace file" button under it; the dialog is a BoDialog with BoUpload replacing this file (`fileId`, from URL).
import { computed, ref } from 'vue';
import { parseGlobalMimeTypeAllowList } from '../../composables/use-mime-type-filter.ts';
import { useServerStore } from '../../stores/server.ts';
import BoButton from '../BoButton.vue';
import BoDialog from '../BoDialog.vue';
import BoUpload from './BoUpload.vue';
import FilePreview, { type Props as FilePreviewProps } from './FilePreview.vue';

defineProps<FilePreviewProps>();

const { info } = useServerStore();

const allowedMimeTypes = computed(() => parseGlobalMimeTypeAllowList(info.files?.mimeTypeAllowList)?.join(','));

const emit = defineEmits<{
	click: [];
	replace: [];
}>();

const dialogActive = ref(false);

function onInput() {
	dialogActive.value = false;
	emit('replace');
}

function close() {
	dialogActive.value = false;
}
</script>

<template>
	<div class="file-preview-replace flex flex-col items-start gap-3">
		<div
			class="w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03]"
		>
			<FilePreview :file="file" @click="emit('click')" />
		</div>

		<BoButton v-if="!nonEditable" variant="secondary" icon="swap_horiz" :disabled="!!disabled" @click="dialogActive = true">
			{{ $t('replace_file') }}
		</BoButton>

		<BoDialog v-model:open="dialogActive" :title="$t('replace_file')">
			<BoUpload :file-id="file.id" from-url :accept="allowedMimeTypes" @input="onInput" />
			<template #actions>
				<BoButton variant="secondary" @click="close">{{ $t('done') }}</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
