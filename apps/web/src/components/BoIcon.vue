<script setup lang="ts">
// Material Symbols Rounded icon (research R8). Decorative by default; `label` makes it an image with a name.
const { size = 'md', label } = defineProps<{ name: string; size?: 'sm' | 'md' | 'lg'; label?: string }>();

// Inline style: the font's own `.material-symbols-rounded { font-size: 24px }` is unlayered and beats utilities.
// 18px, 24px (Modal title size) and 30px (TailAdmin title-sm).
const FONT_SIZES = { sm: 'var(--text-lg)', md: 'var(--text-2xl)', lg: 'var(--text-title-sm)' };
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
