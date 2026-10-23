<!-- Ported from directus/app/src/components/v-workspace-tile.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): v-workspace-tile on BoWorkspaceTile, resizable by default as DR; `color`
// colors the header icon, `note` is the header info tooltip. `preview` is declared as in DR, which never emits it
// from the tile. Dragging and resizing stay pointer only (recorded a11y exception of BoWorkspaceTile).
import BoIcon from '../../components/BoIcon.vue';
import BoWorkspaceTile from '../../components/workspace/BoWorkspaceTile.vue';

export type { AppTile } from '../../components/workspace/BoWorkspaceTile.vue';

withDefaults(
	defineProps<{
		/** The id of the tile */
		id: string;
		x: number;
		y: number;
		width: number;
		height: number;
		/** What title to display on the panel */
		name?: string | undefined;
		/** What icon to show next to the title */
		icon?: string;
		/** The color theme of the panel */
		color?: string;
		/** Adds a note beneath the title */
		note?: string | undefined;
		/** Allows to hide the header */
		showHeader?: boolean;
		minWidth?: number;
		minHeight?: number;
		/** If enabled, makes the tile draggable */
		draggable?: boolean;
		/** Add or remove rounded corners from the panels */
		borderRadius?: [boolean, boolean, boolean, boolean];
		/** If enabled, allows for resizing of the tile */
		resizable?: boolean;
		/** Enable the edit mode of the panel */
		editMode?: boolean;
		/** Shows options when the `editMode` is active */
		showOptions?: boolean;
		/** Constantly updates position, not only after the dragend */
		alwaysUpdatePosition?: boolean;
		/** Grid cell size in px */
		gridSize?: number;
	}>(),
	{
		name: undefined,
		icon: 'space_dashboard',
		color: 'var(--theme--primary)',
		note: undefined,
		showHeader: true,
		minWidth: 8,
		minHeight: 6,
		resizable: true,
		editMode: false,
		draggable: true,
		borderRadius: () => [true, true, true, true],
		showOptions: true,
		alwaysUpdatePosition: false,
		gridSize: 18,
	},
);

defineEmits(['update', 'move', 'duplicate', 'delete', 'edit', 'preview']);
</script>

<template>
	<BoWorkspaceTile
		:id="id"
		class="v-workspace-tile"
		:x="x"
		:y="y"
		:width="width"
		:height="height"
		:name="name"
		:icon="icon"
		:note="note"
		:show-header="showHeader"
		:min-width="minWidth"
		:min-height="minHeight"
		:draggable="draggable"
		:border-radius="borderRadius"
		:resizable="resizable"
		:edit-mode="editMode"
		:show-options="showOptions"
		:always-update-position="alwaysUpdatePosition"
		:grid-size="gridSize"
		@update="$emit('update', $event)"
		@move="$emit('move')"
		@duplicate="$emit('duplicate')"
		@delete="$emit('delete')"
		@edit="$emit('edit')"
	>
		<template #icon><BoIcon :name="icon" size="sm" :style="{ color }" /></template>
		<slot />
		<template v-if="$slots['footer']" #footer><slot name="footer" /></template>
		<template v-if="$slots['body']" #body><slot name="body" /></template>
	</BoWorkspaceTile>
</template>
