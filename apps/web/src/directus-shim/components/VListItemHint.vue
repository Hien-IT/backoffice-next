<!-- Ported from directus/app/src/components/v-list-item-hint.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): template only, design-system classes; the item color in an active item (contrast).
withDefaults(defineProps<{ center?: boolean | undefined }>(), { center: false });
</script>

<template>
	<div
		class="v-list-item-hint inline-flex shrink-0 self-center text-theme-xs text-gray-500 dark:text-gray-400 in-[.active]:text-inherit dark:in-[.active]:text-inherit"
		:class="{ center }"
	>
		<slot />
	</div>
</template>
