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

// DR v-badge.vue:67-68,75-76: size and offset hooks (a dot keeps its 8 px size, offsets still apply).
const SIZE = 'h-(--v-badge-size,0.875rem) w-max min-w-(--v-badge-size,0.875rem) px-1.25 text-[0.5rem]';
const X = {
	start: 'start-[calc(var(--v-badge-size,0.875rem)/-2_+_var(--v-badge-offset-x,0rem))]',
	end: 'end-[calc(var(--v-badge-size,0.875rem)/-2_+_var(--v-badge-offset-x,0rem))]',
};
const Y = {
	top: 'top-[calc(var(--v-badge-size,0.875rem)/-2_+_var(--v-badge-offset-y,0rem))]',
	bottom: 'bottom-[calc(var(--v-badge-size,0.875rem)/-2_+_var(--v-badge-offset-y,0rem))]',
};
const DOT_X = {
	start: 'start-[calc(-0.25rem_+_var(--v-badge-offset-x,0rem))]',
	end: 'end-[calc(-0.25rem_+_var(--v-badge-offset-x,0rem))]',
};
const DOT_Y = {
	top: 'top-[calc(-0.25rem_+_var(--v-badge-offset-y,0rem))]',
	bottom: 'bottom-[calc(-0.25rem_+_var(--v-badge-offset-y,0rem))]',
};
</script>

<template>
	<div class="v-badge relative inline-block">
		<span
			v-if="!disabled"
			class="pointer-events-none absolute z-1 inline-flex items-center justify-center rounded-full bg-error-600 font-extrabold text-white"
			:class="[
				dot ? 'size-2' : SIZE,
				left ? (dot ? DOT_X.start : X.start) : dot ? DOT_X.end : X.end,
				bottom ? (dot ? DOT_Y.bottom : Y.bottom) : dot ? DOT_Y.top : Y.top,
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
