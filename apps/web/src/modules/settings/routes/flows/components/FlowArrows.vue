<!-- Ported from directus/app/src/modules/settings/routes/flows/components/arrows/arrows.vue -->
<script setup lang="ts">
// Backoffice (spec 017 FR-024, recipe Q-29): the SVG over the canvas in theme colours (resolve brand, reject orange and
// dashed so the branch is not told by colour only, subdued gray), no RTL mirroring (no RTL language), the fade only
// without reduced motion. The SVG starts at the workspace origin (no content padding here).
import { computed, unref } from 'vue';
import { GRID_SIZE, PANEL_HEIGHT, PANEL_WIDTH } from '../constants.ts';
import type { ArrowInfo, ParentInfo } from '../types.ts';
import { generateArrows } from './arrows/lib/generate-arrows.ts';

const props = withDefaults(
	defineProps<{
		panels: Record<string, any>[];
		arrowInfo?: ArrowInfo | undefined;
		parentPanels: Record<string, ParentInfo>;
		editMode?: boolean;
		hoveredPanel?: string | null;
		subdued?: boolean;
	}>(),
	{
		arrowInfo: undefined,
		editMode: false,
		hoveredPanel: null,
		subdued: false,
	},
);

const size = computed(() => {
	let width = 0,
		height = 0;

	for (const panel of props.panels) {
		width = Math.max(width, (panel['x'] + PANEL_WIDTH) * GRID_SIZE);
		height = Math.max(height, (panel['y'] + PANEL_HEIGHT) * GRID_SIZE);
	}

	if (props.arrowInfo) {
		width = Math.max(width, props.arrowInfo.pos.x + 10);
		height = Math.max(height, props.arrowInfo.pos.y + 10);
	}

	return { width: width + 100, height: height + 100 };
});

const arrows = computed(() => {
	return generateArrows(props.panels as any, {
		arrowInfo: props.arrowInfo,
		editMode: props.editMode,
		hoveredPanel: props.hoveredPanel,
		parentPanels: props.parentPanels,
		size: unref(size),
	});
});

const STROKE = {
	resolve: 'stroke-brand-500 dark:stroke-brand-400',
	reject: 'stroke-orange-500 dark:stroke-orange-400',
	subdued: 'stroke-gray-400 dark:stroke-gray-600',
};
</script>

<template>
	<svg
		:width="size.width"
		:height="size.height"
		class="pointer-events-none absolute start-0 top-0 z-1"
		aria-hidden="true"
		data-flow-arrows
	>
		<TransitionGroup
			enter-active-class="transition-[opacity,transform] duration-150 motion-reduce:transition-none"
			leave-active-class="transition-[opacity,transform] duration-150 motion-reduce:transition-none"
			enter-from-class="opacity-0 -translate-x-1"
			leave-to-class="opacity-0 -translate-x-1"
		>
			<path
				v-for="arrow in arrows"
				:key="arrow.id"
				:class="[subdued || arrow.loner ? STROKE.subdued : STROKE[arrow.type], { 'opacity-60': arrow.isHint }]"
				:data-arrow="arrow.type"
				:data-hint="arrow.isHint ? '' : undefined"
				:d="arrow.d"
				fill="transparent"
				stroke-width="2"
				stroke-linecap="round"
				:stroke-dasharray="arrow.type === 'reject' ? '6 4' : undefined"
			/>
		</TransitionGroup>
	</svg>
</template>
