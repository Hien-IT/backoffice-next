<script setup lang="ts">
// Material Symbols Rounded icon (research R8). Decorative by default; `label` makes it an image with a name.
const { size = 'md', label } = defineProps<{ name: string; size?: 'sm' | 'md' | 'lg'; label?: string }>();

// Inline style: the font's own `.material-symbols-rounded { font-size: 24px }` is unlayered and beats utilities.
const FONT_SIZES = { sm: 'var(--eh-font-size-lg)', md: 'var(--eh-font-size-2xl)', lg: 'var(--eh-font-size-3xl)' };
</script>

<template>
	<span
		class="material-symbols-rounded select-none"
		:style="{ fontSize: FONT_SIZES[size] }"
		:role="label ? 'img' : undefined"
		:aria-label="label"
		:aria-hidden="label ? undefined : 'true'"
	>
		{{ name }}
	</span>
</template>
