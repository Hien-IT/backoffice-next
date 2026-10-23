<script setup lang="ts">
import { computed } from 'vue';
import BoIcon from './BoIcon.vue';

const {
	type = 'info',
	icon = null,
	center = false,
} = defineProps<{
	type?: 'normal' | 'info' | 'success' | 'warning' | 'danger';
	/** Replaces the icon of the type (v-notice `icon`); false hides it (null default: no Boolean absent-cast). */
	icon?: string | false | null;
	/** Centers the content (v-notice `center`, spec 020). */
	center?: boolean;
}>();

// Icons as v-notice of DR, colors from the component-specs Alert recipe (danger = error).
const TYPES = {
	normal: {
		icon: 'info',
		box: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]',
		iconColor: 'text-gray-500 dark:text-gray-400',
	},
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

// An unknown type (e.g. a form field type falling through to a notice root) gets the normal look, as v-notice.
const look = computed(() => TYPES[type as keyof typeof TYPES] ?? TYPES.normal);
// Owner 2026-10-24 (D-178): in a form field (the interface slot of BoForm) a notice is as high as an input, like the DR
// v-notice (min-block-size: input height, padding 0.6875rem 0.875rem), so it lines up with the field beside it;
// elsewhere the TailAdmin Alert padding stays.
</script>

<template>
	<div
		:role="type === 'danger' ? 'alert' : type === 'normal' ? undefined : 'status'"
		class="flex items-start gap-3 rounded-xl border p-4 in-[[data-interface]]:min-h-11 in-[[data-interface]]:px-3.5 in-[[data-interface]]:py-2.5"
		:class="[look.box, { 'justify-center text-center': center }]"
	>
		<BoIcon v-if="icon !== false" :name="icon ?? look.icon" class="-mt-0.5" :class="look.iconColor" />
		<div class="min-w-0 text-sm text-gray-500 dark:text-gray-400" :class="{ 'flex-1': !center }">
			<!-- v-notice `title` slot (spec 020): the heading line above the text. -->
			<p v-if="$slots['title']" class="m-0 font-medium text-gray-800 dark:text-white/90"><slot name="title" /></p>
			<slot />
		</div>
	</div>
</template>
