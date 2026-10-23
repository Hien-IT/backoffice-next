<!-- Ported from directus/app/src/views/private/components/revisions-date-group.vue -->
<script setup lang="ts">
// Backoffice: recipe Q-10, the date is a group heading above its rows (DR: an expanded v-detail).
import type { Revision, RevisionsByDate } from '../../types/revisions.ts';
import RevisionItem from './RevisionItem.vue';

interface Props {
	group: RevisionsByDate;
}

defineProps<Props>();
defineEmits(['click']);
</script>

<template>
	<section class="mt-3 first:mt-0">
		<h3 class="mb-1 px-2 text-theme-xs font-medium text-gray-500 uppercase dark:text-gray-400">
			{{ group.dateFormatted }}
		</h3>
		<ul>
			<li v-for="(item, index) in group.revisions" :key="item.id">
				<RevisionItem
					:revision="item as Revision"
					:last="index === group.revisions.length - 1"
					@click="$emit('click', item.id)"
				/>
			</li>
		</ul>
	</section>
</template>
