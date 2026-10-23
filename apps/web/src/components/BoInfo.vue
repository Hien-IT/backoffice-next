<!-- Ported from directus/app/src/components/v-info.vue -->
<script setup lang="ts">
// Backoffice: the blank page card of the design-system (Card empty-page classes, layout-patterns BoForm empty state);
// the type colors the round icon box with the Badge light pairs of component-specs (no new contrast pair).
import BoIcon from './BoIcon.vue';

const { icon = false, type = 'info' } = defineProps<{
	/** The title to display in the info */
	title: string;
	/** What icon to render above the title */
	icon?: string | false;
	/** Styling of the info */
	type?: 'info' | 'success' | 'warning' | 'danger' | 'primary';
}>();

// DR `info` is the neutral foreground: the light Badge pair; the others are their Badge light pairs.
const ICON = {
	info: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80',
	primary: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
	success: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400',
	warning: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
	danger: 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400',
};
</script>

<template>
	<div
		class="flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-5 py-7 text-center xl:px-10 xl:py-12 dark:border-gray-800 dark:bg-white/[0.03]"
	>
		<div v-if="icon !== false" class="mb-3.5 flex size-16 items-center justify-center rounded-full" :class="ICON[type]">
			<BoIcon :name="icon" size="lg" />
		</div>
		<h2 class="m-0 text-base font-medium text-gray-800 dark:text-white/90">{{ title }}</h2>
		<p v-if="$slots['default']" class="m-0 mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400"><slot /></p>
		<div v-if="$slots['append']" class="mt-4 flex flex-col items-center gap-3"><slot name="append" /></div>
	</div>
</template>
