<!-- Ported from directus/app/src/displays/color/color.vue -->
<script setup lang="ts">
import Color from 'color';
import { computed } from 'vue';
import ValueNull from '../../components/render/ValueNull.vue';
import { cssVar } from '../../utils/css-var.ts';

interface ColorProps {
	value?: string | null;
	defaultColor?: string | null;
}

const props = withDefaults(defineProps<ColorProps>(), {
	value: null,
	defaultColor: '#B0BEC5', // raw-color-allowed: Directus data default (Q-C)
});

const color = computed(() => props.value ?? props.defaultColor);

// Backoffice: the page background of the theme (white, gray-900 in dark mode) stands in for `--theme--background`.
const pageBackground = () =>
	cssVar(document.documentElement.classList.contains('dark') ? '--color-gray-900' : '--color-white');

const addBorder = computed(() => {
	if (color.value === null) return false;

	try {
		const valueColor = Color(color.value);
		const pageColor = Color(pageBackground());
		return valueColor.contrast(pageColor) < 1.1;
	} catch {
		// There's a chance the color isn't supported by color-js (like with color-mix or other modern
		// CSS), in which case we'll just show the dot as-is
		return false;
	}
});
</script>

<template>
	<div class="color-dot inline-flex items-center">
		<ValueNull v-if="value === null && defaultColor === null" />
		<div
			class="dot inline-block size-2.25 shrink-0 rounded-full"
			:class="{ 'with-border border border-gray-500': addBorder }"
			:style="{ backgroundColor: color ?? undefined }"
		/>
	</div>
</template>
