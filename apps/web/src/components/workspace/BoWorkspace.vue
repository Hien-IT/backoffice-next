<!-- Ported from directus/app/src/components/v-workspace.vue -->
<script setup lang="ts">
// Backoffice (spec 017 FR-021, recipe Q-29 / layout-patterns §13): the tiles sit on an 18 px CSS grid, sized from the
// furthest tile as in Directus (edit mode adds 25 cells). Only the `tile` slot rendering the flows editor uses is
// ported: no zoom to fit, no default tile rendering, no content padding (the canvas scroller pads instead). 018
// (Insights) extends it.
import { computed } from 'vue';
import type { AppTile } from './BoWorkspaceTile.vue';

const props = withDefaults(
	defineProps<{
		/** What tiles to render inside the workspace */
		tiles: AppTile[];
		/** Enables the edit mode */
		editMode?: boolean;
		/** Grid cell size in px */
		gridSize?: number;
	}>(),
	{ editMode: false, gridSize: 18 },
);

defineSlots<{ tile(props: { tile: AppTile }): unknown }>();

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
</script>

<template>
	<div
		class="bo-workspace relative min-h-full min-w-full"
		:class="{ editing: editMode }"
		data-workspace
		:style="{
			display: 'grid',
			inlineSize: `${workspaceSize.width}px`,
			blockSize: `${workspaceSize.height}px`,
			gridTemplateColumns: `repeat(auto-fill, ${gridSize}px)`,
			gridTemplateRows: `repeat(auto-fill, ${gridSize}px)`,
			'--grid-size': `${gridSize}px`,
		}"
	>
		<template v-for="tile in tiles" :key="tile.id">
			<slot name="tile" :tile="tile" />
		</template>
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

:global(.dark) .bo-workspace::before {
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
