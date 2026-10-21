<!-- Ported from directus/app/src/components/v-workspace.vue -->
<script setup lang="ts">
// Backoffice (spec 017 FR-021, recipe Q-29 / layout-patterns §13): the tiles sit on an 18 px CSS grid, sized from the
// furthest tile as in Directus (edit mode adds 25 cells). Only the `tile` slot rendering the flows editor uses is
// ported: no default tile rendering, no content padding (the scroller pads instead). Feature 018 (FR-022) adds
// `zoomToFit`: one CSS scale of the grid from the top left corner (Directus `zoomScale`), measured against the scroll
// container this workspace sits in (the app has no `main-element` injection: research T001 (b)); the outer box takes the
// scaled size. Without zoom the outer box is `display: contents`, so the flows canvas keeps its layout.
import { useElementSize, useParentElement } from '@vueuse/core';
import { computed, ref } from 'vue';
import type { AppTile } from './BoWorkspaceTile.vue';

const props = withDefaults(
	defineProps<{
		/** What tiles to render inside the workspace */
		tiles: AppTile[];
		/** Enables the edit mode */
		editMode?: boolean;
		/** Grid cell size in px */
		gridSize?: number;
		/** Scales the grid down so every tile fits the scroll container (018) */
		zoomToFit?: boolean;
	}>(),
	{ editMode: false, gridSize: 18, zoomToFit: false },
);

defineSlots<{ tile(props: { tile: AppTile; gridSize: number }): unknown }>();

const box = ref<HTMLElement | null>(null);
const scroller = useParentElement(box);
const { width: scrollerWidth, height: scrollerHeight } = useElementSize(scroller);

const workspaceSize = computed(() => {
	const furthestTileX = props.tiles.reduce(
		(aggr, tile) => {
			if (tile.x + tile.width > aggr.x + aggr.width) {
				aggr.x = tile.x;
				aggr.width = tile.width;
			}

			return aggr;
		},
		{ x: 0, width: 0 },
	);

	const furthestTileY = props.tiles.reduce(
		(aggr, tile) => {
			if (tile.y + tile.height > aggr.y + aggr.height) {
				aggr.y = tile.y;
				aggr.height = tile.height;
			}

			return aggr;
		},
		{ y: 0, height: 0 },
	);

	if (props.editMode === true) {
		return {
			width: (furthestTileX.x + furthestTileX.width + 25) * props.gridSize,
			height: (furthestTileY.y + furthestTileY.height + 25) * props.gridSize,
		};
	}

	return {
		width: (furthestTileX.x + furthestTileX.width - 1) * props.gridSize,
		height: (furthestTileY.y + furthestTileY.height - 1) * props.gridSize,
	};
});

const zoomScale = computed(() => {
	if (props.zoomToFit === false || !scroller.value) return 1;

	// useElementSize measures the content box: the scroller's padding plays the part of Directus --content-padding.
	const scaleWidth = scrollerWidth.value / workspaceSize.value.width;
	const scaleHeight = scrollerHeight.value / workspaceSize.value.height;

	const scale = Math.min(scaleWidth, scaleHeight);
	return Number.isFinite(scale) && scale > 0 ? scale : 1;
});
</script>

<template>
	<div
		ref="box"
		:class="zoomToFit ? 'relative overflow-hidden' : 'contents'"
		:style="
			zoomToFit
				? { inlineSize: `${workspaceSize.width * zoomScale}px`, blockSize: `${workspaceSize.height * zoomScale}px` }
				: undefined
		"
	>
		<div
			class="bo-workspace relative"
			:class="{ editing: editMode, 'min-h-full min-w-full': !zoomToFit, 'origin-top-left': zoomToFit }"
			data-workspace
			:data-zoom="zoomToFit ? zoomScale : undefined"
			:style="{
				display: 'grid',
				inlineSize: `${workspaceSize.width}px`,
				blockSize: `${workspaceSize.height}px`,
				gridTemplateColumns: `repeat(auto-fill, ${gridSize}px)`,
				gridTemplateRows: `repeat(auto-fill, ${gridSize}px)`,
				'--grid-size': `${gridSize}px`,
				transform: zoomToFit ? `scale(${zoomScale})` : undefined,
			}"
		>
			<template v-for="tile in tiles" :key="tile.id">
				<slot name="tile" :tile="tile" :grid-size="gridSize" />
			</template>
		</div>
	</div>
</template>

<style scoped>
/* The dot grid of the edit mode (Directus `.workspace::before`), in theme colors. */
.bo-workspace::before {
	position: absolute;
	inset: -0.25rem;
	background-image: radial-gradient(var(--color-gray-300) 10%, transparent 10%);
	background-position: -0.3125rem -0.3125rem;
	background-size: var(--grid-size) var(--grid-size);
	opacity: 0;
	transition: opacity 150ms ease;
	content: '';
	pointer-events: none;
}

.dark .bo-workspace::before {
	background-image: radial-gradient(var(--color-gray-700) 10%, transparent 10%);
}

.bo-workspace.editing::before {
	opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
	.bo-workspace::before {
		transition: none;
	}
}
</style>
