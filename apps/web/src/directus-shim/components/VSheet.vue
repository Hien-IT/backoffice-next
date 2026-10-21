<!-- Ported from directus/app/src/components/v-sheet.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): template only, design-system classes (subdued surface).

// Directus v-sheet.vue:24-30: sizing and padding hooks.
</script>

<template>
	<div
		class="v-sheet h-(--v-sheet-height,auto) max-h-(--v-sheet-max-height,none) min-h-(--v-sheet-min-height,2.75rem) w-(--v-sheet-width,auto) max-w-(--v-sheet-max-width,none) min-w-(--v-sheet-min-width,none) overflow-auto rounded-lg bg-gray-50 p-(--v-sheet-padding,0.5rem) dark:bg-white/[0.03]"
	>
		<slot />
	</div>
</template>
