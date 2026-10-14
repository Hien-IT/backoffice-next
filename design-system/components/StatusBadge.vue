<!--
  EXAMPLE ONLY (design-system/components): not production code. Recipe from TailAdmin src/components/ui/Badge.vue
  and src/components/tables/basic-tables/BasicTableOne.vue (MIT, © TailAdmin, see ../LICENSE-TailAdmin.md).
  The status is never shown by color alone: the label is visible text (default slot) and each status has its own icon shape.
-->
<script setup lang="ts">
import { computed } from 'vue';

type Status = 'neutral' | 'success' | 'warning' | 'error' | 'info';

const props = withDefaults(defineProps<{ status?: Status; size?: 'sm' | 'md' }>(), {
	status: 'neutral',
	size: 'md',
});

// Final light badge recipe (docs/component-specs.md, Badge; owner decision C-1): -700 text on -50, dark -400 on -500/15,
// all >= 4.5:1 (contrast table in docs/migration-guide.md). neutral is the Badge "light" color.
const colors: Record<Status, string> = {
	neutral: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80',
	success: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400',
	warning: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
	error: 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400',
	info: 'bg-blue-light-50 text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-400',
};

// 12x12 glyphs drawn with currentColor: dot, check, triangle, cross, "i".
const icons: Record<Status, string> = {
	neutral: 'M6 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
	success: 'M2.5 6.5 5 9l4.5-5.5',
	warning: 'M6 1.5 11 10.5H1L6 1.5Zm0 3.5v2.5m0 1.5v.01',
	error: 'M3 3l6 6M9 3 3 9',
	info: 'M6 5.5V9m0-5.5v.01',
};

const classes = computed(() => [
	'inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 font-medium whitespace-nowrap',
	props.size === 'sm' ? 'text-theme-xs' : 'text-sm',
	colors[props.status],
]);
</script>

<template>
	<span :class="classes">
		<svg
			class="size-3 shrink-0"
			viewBox="0 0 12 12"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path :d="icons[status]" :fill="status === 'neutral' ? 'currentColor' : 'none'" />
		</svg>
		<slot />
	</span>
</template>
