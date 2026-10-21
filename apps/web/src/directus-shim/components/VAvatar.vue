<!-- Ported from directus/app/src/components/v-avatar.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7, recipe Q-44 Avatar): new; round by default as the recipe, `tile` = rounded-lg
// (so `round` changes nothing); sizes 24/32/40/48/56 px; a string `border` is the border color
// (`--v-avatar-border-color` like Directus).
import { computed } from 'vue';

interface Props {
	tile?: boolean;
	round?: boolean;
	border?: boolean | string;
	xSmall?: boolean;
	small?: boolean;
	large?: boolean;
	xLarge?: boolean;
	clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	tile: false,
});

const size = computed(() => {
	if (props.xSmall) return 'size-6';
	if (props.small) return 'size-8';
	if (props.large) return 'size-12';
	if (props.xLarge) return 'size-14';
	// Directus v-avatar.vue:58-59: the default size reads --v-avatar-size.
	return 'size-(--v-avatar-size,2.5rem)';
});
</script>

<template>
	<component
		:is="clickable ? 'button' : 'div'"
		:type="clickable ? 'button' : undefined"
		class="v-avatar relative flex shrink-0 items-center justify-center overflow-hidden bg-gray-100 text-gray-700 whitespace-nowrap dark:bg-white/5 dark:text-white/80 [&>img]:size-full [&>img]:object-cover"
		:class="[
			size,
			tile && !round ? 'rounded-lg' : 'rounded-full',
			{
				'border-2': border,
				'border-gray-200 dark:border-gray-800': border === true,
				'border-(--v-avatar-border-color)': typeof border === 'string',
				'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400':
					clickable,
			},
		]"
		:style="typeof border === 'string' ? { '--v-avatar-border-color': border } : undefined"
	>
		<slot />
	</component>
</template>
