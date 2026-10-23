<!-- Ported from directus/app/src/components/v-upload.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): wraps BoUpload (extended with `start` and `abort`, it has the URL dialog);
// "Choose from library" (`library` of BoUpload) opens DrawerFiles here, whose selection goes to BoUpload's
// `setSelection` as DR v-upload renders drawer-files itself.
import type { Filter } from '@directus/types';
import { ref } from 'vue';
import DrawerFiles from '../../components/drawers/DrawerFiles.vue';
import BoUpload from '../../components/files/BoUpload.vue';

const props = withDefaults(
	defineProps<{
		multiple?: boolean;
		preset?: Record<string, any>;
		fileId?: string;
		fromUser?: boolean;
		fromUrl?: boolean;
		fromLibrary?: boolean;
		folder?: string;
		filter?: Filter;
		disabled?: boolean;
		accept?: string;
	}>(),
	{
		preset: () => ({}),
		fromUser: true,
	},
);

defineEmits(['input', 'start']);

const upload = ref<InstanceType<typeof BoUpload>>();
const libraryOpen = ref(false);

function abort() {
	upload.value?.abort();
}

defineExpose({ abort });
</script>

<template>
	<div class="v-upload">
		<BoUpload
			ref="upload"
			v-bind="props"
			@input="$emit('input', $event)"
			@start="$emit('start', $event)"
			@library="libraryOpen = true"
		/>
		<DrawerFiles
			v-if="fromLibrary"
			v-model:active="libraryOpen"
			:multiple="multiple"
			:folder="folder"
			:filter="filter"
			@input="upload?.setSelection($event)"
		/>
	</div>
</template>
