<!-- Ported from directus/app/src/components/v-skeleton-loader.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): the seven v-skeleton-loader shapes with the app's loading placeholder
// (animate-pulse on gray-100, still with reduced motion): input 44px like BoInput, the tall input as a textarea, list
// items and text at the DR sizes.
withDefaults(
	defineProps<{
		/** Name of another component to mirror */
		type?:
			| 'input'
			| 'input-tall'
			| 'block-list-item'
			| 'block-list-item-dense'
			| 'list-item-icon'
			| 'text'
			| 'pagination';
	}>(),
	{ type: 'input' },
);

const PULSE = 'animate-pulse bg-gray-100 motion-reduce:animate-none dark:bg-gray-800';

const SHAPES: Record<string, string> = {
	input: `h-11 w-full rounded-lg ${PULSE}`,
	'input-tall': `h-36 w-full rounded-lg ${PULSE}`,
	'block-list-item': `h-11 w-full rounded-lg ${PULSE} [&+&]:mt-2`,
	'block-list-item-dense': `h-10 w-full rounded-lg ${PULSE} [&+&]:mt-1`,
	'list-item-icon': 'flex h-10 w-full items-center gap-3',
	text: `h-3 grow rounded-md ${PULSE}`,
	pagination: 'flex gap-1',
};
</script>

<template>
	<div
		class="v-skeleton-loader relative cursor-progress overflow-hidden"
		:class="SHAPES[type] ?? SHAPES['input']"
		aria-hidden="true"
	>
		<template v-if="type === 'list-item-icon'">
			<div class="size-6 shrink-0 rounded-full" :class="PULSE" />
			<div class="h-3 grow rounded-md" :class="PULSE" />
		</template>
		<template v-if="type === 'pagination'">
			<div v-for="page in 3" :key="page" class="size-9 rounded-lg" :class="PULSE" />
		</template>
	</div>
</template>
