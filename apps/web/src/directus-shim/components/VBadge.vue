<!-- Ported from directus/app/src/components/v-badge.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7, recipe Q-44 "Badge solid small, dot 8 px"): new, Badge solid error colors;
// `bordered` is a ring in the page background instead of the drop shadows.
import VIcon from './VIcon.vue';

withDefaults(
	defineProps<{
		value?: string | number | boolean | null;
		dot?: boolean;
		left?: boolean;
		bottom?: boolean;
		icon?: string | null;
		bordered?: boolean;
		disabled?: boolean;
	}>(),
	{
		value: null,
		icon: null,
	},
);
</script>

<template>
	<div class="relative inline-block">
		<span
			v-if="!disabled"
			class="pointer-events-none absolute z-1 inline-flex items-center justify-center rounded-full bg-error-600 font-extrabold text-white"
			:class="[
				dot ? 'size-2' : 'h-3.5 w-max min-w-3.5 px-1.25 text-[0.5rem]',
				left ? (dot ? '-start-1' : '-start-1.75') : dot ? '-end-1' : '-end-1.75',
				bottom ? (dot ? '-bottom-1' : '-bottom-1.75') : dot ? '-top-1' : '-top-1.75',
				{ 'ring-2 ring-white dark:ring-gray-900': bordered },
			]"
		>
			<template v-if="!dot">
				<VIcon v-if="icon" :name="icon" x-small />
				<span v-else>{{ value }}</span>
			</template>
		</span>

		<slot />
	</div>
</template>
