<!-- Ported from directus/app/src/components/v-workspace.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): v-workspace on BoWorkspace. Without a `tile` slot each tile is a VWorkspaceTile
// holding the default slot `{ tile, gridSize }` and its six events are re-emitted with the tile, as Directus. Zoom to fit
// measures the scroll container BoWorkspace sits in (the `main-element` of Directus).
import BoWorkspace from '../../components/workspace/BoWorkspace.vue';
import VWorkspaceTile, { type AppTile } from './VWorkspaceTile.vue';

withDefaults(
	defineProps<{
		/** What tiles to render inside the workspace */
		tiles: AppTile[];
		/** Enables the edit mode */
		editMode?: boolean;
		/** Sets zoom and position so that all components are perfectly shown */
		zoomToFit?: boolean;
		/** Makes the panel resizable */
		resizable?: boolean;
		/** Grid cell size in px — must match CSS grid-template value */
		gridSize?: number;
	}>(),
	{ editMode: false, zoomToFit: false, resizable: true, gridSize: 18 },
);

defineEmits<{
	update: [value: { edits: Event; id: AppTile['id'] }];
	move: [value: AppTile['id']];
	delete: [value: AppTile['id']];
	duplicate: [value: AppTile];
	edit: [value: AppTile];
	preview: [value: AppTile];
}>();
</script>

<template>
	<BoWorkspace :tiles="tiles" :edit-mode="editMode" :zoom-to-fit="zoomToFit" :grid-size="gridSize">
		<template #tile="{ tile }">
			<slot v-if="$slots['tile']" name="tile" :tile="tile" />
			<VWorkspaceTile
				v-else
				v-bind="tile"
				:edit-mode="editMode"
				:resizable="resizable"
				:grid-size="gridSize"
				@preview="$emit('preview', tile)"
				@edit="$emit('edit', tile)"
				@update="$emit('update', { edits: $event, id: tile.id })"
				@move="$emit('move', tile.id)"
				@delete="$emit('delete', tile.id)"
				@duplicate="$emit('duplicate', tile)"
			>
				<slot :tile="tile" :grid-size="gridSize" />
			</VWorkspaceTile>
		</template>
	</BoWorkspace>
</template>
