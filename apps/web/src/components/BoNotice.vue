<script setup lang="ts">
import BoIcon from './BoIcon.vue';

const { type = 'info' } = defineProps<{ type?: 'info' | 'success' | 'warning' | 'danger' }>();

// Icons as v-notice of Directus, colors from the component-specs Alert recipe (danger = error).
const TYPES = {
	info: {
		icon: 'info',
		box: 'border-blue-light-500 bg-blue-light-50 dark:border-blue-light-500/30 dark:bg-blue-light-500/15',
		iconColor: 'text-blue-light-600 dark:text-blue-light-500',
	},
	success: {
		icon: 'check_circle',
		box: 'border-success-500 bg-success-50 dark:border-success-500/30 dark:bg-success-500/15',
		iconColor: 'text-success-600 dark:text-success-500',
	},
	warning: {
		icon: 'warning',
		box: 'border-warning-500 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/15',
		iconColor: 'text-warning-600 dark:text-warning-500',
	},
	danger: {
		icon: 'error',
		box: 'border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15',
		iconColor: 'text-error-600 dark:text-error-500',
	},
};
</script>

<template>
	<div
		:role="type === 'danger' ? 'alert' : 'status'"
		class="flex items-start gap-3 rounded-xl border p-4"
		:class="TYPES[type].box"
	>
		<BoIcon :name="TYPES[type].icon" class="-mt-0.5" :class="TYPES[type].iconColor" />
		<div class="min-w-0 flex-1 text-sm text-gray-500 dark:text-gray-400"><slot /></div>
	</div>
</template>
