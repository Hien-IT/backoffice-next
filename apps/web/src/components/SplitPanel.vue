<script setup lang="ts">
// The horizontal split of the live preview (DR routes/item.vue): @directus/vue-split-panel with the end panel as
// primary, sizes in %, collapsible to 0; the divider looks like the 012 ResizeHandle (layout-patterns §10). Keyboard
// (D-69): Left/Right ±5 %, Home/End = min/max of the end panel; Enter (collapse) stays the package's.
import { SplitPanel } from '@directus/vue-split-panel';
import '@directus/vue-split-panel/index.css';
import { usePreferredReducedMotion } from '@vueuse/core';
import { useTemplateRef, watchEffect } from 'vue';

const size = defineModel<number>('size', { default: 50 });
const collapsed = defineModel<boolean>('collapsed', { default: false });

const {
	minSize = 0,
	maxSize = 100,
	snapPoints = [],
	collapseThreshold,
	disabled = false,
	label,
} = defineProps<{
	minSize?: number;
	maxSize?: number;
	snapPoints?: number[];
	collapseThreshold?: number;
	disabled?: boolean;
	/** Accessible name of the divider (role=separator). */
	label: string;
}>();

const STEP = 5;

const reducedMotion = usePreferredReducedMotion();
const panel = useTemplateRef<{ $el: HTMLElement }>('panel');

// ponytail: the package hardcodes aria-valuemin=0, aria-valuemax=100 and aria-label="Resize" as static attributes
// (never patched again), so they are set on its divider here; revisit when the package exposes them.
watchEffect(
	() => {
		const divider = panel.value?.$el.querySelector(':scope > .sp-divider');
		divider?.setAttribute('aria-valuemin', String(minSize));
		divider?.setAttribute('aria-valuemax', String(maxSize));
		divider?.setAttribute('aria-label', label);
		divider?.setAttribute('aria-orientation', 'vertical');
	},
	{ flush: 'post' },
);

// Capture phase on the root runs before the package's own divider handler (±1 %, Home = 100 % for primary end).
function onKeydown(event: KeyboardEvent) {
	const target = event.target as HTMLElement;
	if (disabled || !target.classList.contains('sp-divider') || target.parentElement !== panel.value?.$el) return;

	let next: number;
	// The end panel is primary: moving the divider left grows it.
	if (event.key === 'ArrowLeft') next = size.value + STEP;
	else if (event.key === 'ArrowRight') next = size.value - STEP;
	else if (event.key === 'Home') next = minSize;
	else if (event.key === 'End') next = maxSize;
	else return;

	event.preventDefault();
	event.stopPropagation();
	size.value = Math.min(maxSize, Math.max(minSize, next));
}
</script>

<template>
	<SplitPanel
		ref="panel"
		v-model:size="size"
		v-model:collapsed="collapsed"
		primary="end"
		size-unit="%"
		collapsible
		:collapsed-size="0"
		v-bind="collapseThreshold === undefined ? {} : { collapseThreshold }"
		:min-size="minSize"
		:max-size="maxSize"
		:snap-points="snapPoints"
		:transition-duration="reducedMotion === 'reduce' ? 0 : 150"
		:disabled="disabled"
		:ui="{
			// Room for the 3px focus ring of the form inputs, which the scrolling pane clipped at its left edge; the negative
			// margins keep the content where it was. `!`: the library's unlayered `.sp-start { overflow: hidden }` beats
			// utilities; the panes scroll on their own as Directus routes/item.vue:1069-1077.
			start: 'overflow-auto! -ms-1 -mt-1 ps-1 pe-1 pt-1 pb-1',
			divider:
				'group touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400 [.sp-collapsed>&]:hidden',
			end: 'overflow-y-auto!',
		}"
		@keydown.capture="onKeydown"
	>
		<template #start><slot name="start" /></template>
		<template #divider>
			<div
				class="flex h-full w-1.5 cursor-col-resize justify-center bg-transparent transition-colors group-hover:bg-brand-500/20 group-[.sp-disabled]:cursor-auto group-[.sp-disabled]:bg-transparent motion-reduce:transition-none"
			>
				<div class="h-full w-px bg-gray-200 dark:bg-gray-800" />
			</div>
		</template>
		<template #end><slot name="end" /></template>
	</SplitPanel>
</template>
