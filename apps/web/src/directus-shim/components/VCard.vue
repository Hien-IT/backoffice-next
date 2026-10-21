<!-- Ported from directus/app/src/components/v-card.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): template only, the design-system Card recipe (opaque in dark mode as cards
// mostly sit in dialogs); `disabled` blocks interaction and fades the content, `tile` drops the radius.
withDefaults(defineProps<{ disabled?: boolean | undefined; tile?: boolean | undefined }>(), {
	disabled: false,
	tile: false,
});
</script>

<template>
	<div
		class="v-card max-h-[90vh] max-w-90 overflow-auto border border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-gray-900"
		:class="[
			tile ? 'rounded-none' : 'rounded-2xl',
			{ 'pointer-events-none cursor-not-allowed *:opacity-40': disabled },
		]"
	>
		<slot />
	</div>
</template>
