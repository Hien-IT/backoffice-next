<!-- Ported from directus/app/src/components/v-icon-file.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): new, the file type tile of the cards layout (layouts/cards/components/Card.vue):
// the icon with the extension below it, so a long extension needs no `right` placement.
import BoIcon from '../../components/BoIcon.vue';

defineProps<{
	ext: string;
}>();
</script>

<template>
	<span class="inline-flex flex-col items-center gap-1 text-gray-500 dark:text-gray-400">
		<BoIcon name="insert_drive_file" size="lg" />
		<span class="text-theme-xs font-medium uppercase">{{ ext }}</span>
	</span>
</template>
