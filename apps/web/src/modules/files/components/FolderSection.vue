<!-- Ported from directus/app/src/modules/files/components/folder-section.vue -->
<script setup lang="ts">
// Backoffice: recipe "Folder cards and drop zone" (Q-14): the cards layout Card with the folder icon, no image request;
// owner 2026-10-24 (D-176): the folder look (brand tile, filled icon) and a "Folder" subtitle tell folders from files.
import { computed } from 'vue';
import type { Folder } from '../../../composables/use-folders.ts';
import Card from '../../../layouts/cards/components/Card.vue';

const props = defineProps<{
	subfolders: Folder[];
	anySelection?: boolean;
}>();

const selection = defineModel<(string | number)[]>('selection', { default: () => [] });

const selectMode = computed(() => selection.value.length > 0 || (props.anySelection ?? false));
</script>

<template>
	<Card
		v-for="folder in props.subfolders"
		:key="folder.id"
		v-model="selection"
		item-key="id"
		icon="folder"
		:item="folder"
		:to="`/files/folders/${folder.id}`"
		:select-mode="selectMode"
		folder
	>
		<template #title>{{ folder.name }}</template>
		<template #subtitle>{{ $t('folder') }}</template>
	</Card>
</template>
