<!-- Ported from directus/app/src/layouts/calendar/actions.vue -->
<script setup lang="ts">
// Backoffice: the count line is a `role="status"` `aria-live="polite"` region that stays in the DOM (FR-115b), so no
// fade transition; below `sm` it is screen reader only instead of `display: none` (as TabularActions).
defineOptions({ inheritAttrs: false });

defineProps<{
	showingCount?: string | undefined;
}>();
</script>

<template>
	<span
		role="status"
		aria-live="polite"
		class="sr-only whitespace-nowrap text-theme-sm text-gray-500 sm:not-sr-only dark:text-gray-400"
	>
		<template v-if="showingCount">{{ showingCount }}</template>
	</span>
</template>
