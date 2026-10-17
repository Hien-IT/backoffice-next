<!-- Ported from directus/app/src/components/v-workspace-tile.vue -->
<script setup lang="ts">
// Backoffice (spec 017 FR-025, recipe Q-30): only the move drag of the flows editor (no resize, the flows editor passes
// `resizable: false`), no RTL mirroring (no RTL language in the app). The tile is placed on the workspace grid and
// exposes its cell in `data-pos-x` / `data-pos-y` for the E2E comparison with the Directus app (SC-002). Dragging is
// pointer only, as Directus (recorded a11y exception, FR-106); the edit and options buttons are keyboard reachable.
import { throttle } from 'lodash-es';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../BoMenu.vue';

export type AppTile = {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	name?: string;
	icon?: string;
	showHeader?: boolean;
	draggable?: boolean;
	data?: Record<string, any>;
	[key: string]: any;
};

export type TilePosition = { position_x?: number | undefined; position_y?: number | undefined };

const props = withDefaults(
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
		icon?: string | undefined;
		/** Allows to hide the header */
		showHeader?: boolean;
		/** If enabled, makes the tile draggable */
		draggable?: boolean;
		/** Enable the edit mode of the panel */
		editMode?: boolean;
		/** Shows options when the `editMode` is active */
		showOptions?: boolean;
		/** Constantly updates position, not only after the drag end */
		alwaysUpdatePosition?: boolean;
		/** Grid cell size in px */
		gridSize?: number;
	}>(),
	{
		name: undefined,
		icon: 'space_dashboard',
		showHeader: true,
		editMode: false,
		draggable: true,
		showOptions: true,
		alwaysUpdatePosition: false,
		gridSize: 18,
	},
);

const emit = defineEmits<{
	update: [value: TilePosition];
	move: [];
	duplicate: [];
	delete: [];
	edit: [];
}>();

const { t } = useI18n();

const editedPosition = reactive<TilePosition>({ position_x: undefined, position_y: undefined });

const { onPointerDown, dragging } = useDragDrop();

const positioning = computed(() => ({
	x: dragging.value ? (editedPosition.position_x ?? props.x) : props.x,
	y: dragging.value ? (editedPosition.position_y ?? props.y) : props.y,
}));

const menuItems = computed<BoMenuItem[]>(() => [
	{ text: t('copy_to'), icon: 'input', disabled: props.id.startsWith('_'), onSelect: () => emit('move') },
	{ text: t('duplicate'), icon: 'control_point_duplicate', onSelect: () => emit('duplicate') },
	{ text: t('delete'), icon: 'delete', danger: true, onSelect: () => emit('delete') },
]);

function useDragDrop() {
	const dragging = ref(false);

	let pointerStartPosX = 0;
	let pointerStartPosY = 0;
	let panelStartPosX = 0;
	let panelStartPosY = 0;

	const onPointerMove = throttle((event: PointerEvent) => {
		if (props.editMode === false || dragging.value === false || props.draggable === false) return;

		const gridDeltaX = Math.round((event.pageX - pointerStartPosX) / props.gridSize);
		const gridDeltaY = Math.round((event.pageY - pointerStartPosY) / props.gridSize);

		editedPosition.position_y = Math.max(1, panelStartPosY + gridDeltaY);
		editedPosition.position_x = Math.max(1, panelStartPosX + gridDeltaX);

		if (props.alwaysUpdatePosition) emit('update', { ...editedPosition });
	}, 20);

	return { dragging, onPointerDown };

	function onPointerDown(event: PointerEvent) {
		if (props.editMode === false || props.draggable === false || event.button !== 0) return;

		dragging.value = true;

		pointerStartPosX = event.pageX;
		pointerStartPosY = event.pageY;
		panelStartPosX = props.x;
		panelStartPosY = props.y;

		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointermove', onPointerMove);
	}

	function onPointerUp() {
		dragging.value = false;
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointermove', onPointerMove);
		onPointerMove.cancel();

		if (Object.values(editedPosition).every((v) => v === undefined)) return;

		emit('update', { ...editedPosition });

		editedPosition.position_x = undefined;
		editedPosition.position_y = undefined;
	}
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`;
</script>

<template>
	<div
		class="bo-workspace-tile relative z-1 flex flex-col rounded-xl border bg-white shadow-theme-xs transition-[border-color,box-shadow] hover:z-3 motion-reduce:transition-none dark:bg-gray-900"
		:class="[
			editMode && draggable
				? 'cursor-move border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
				: 'border-gray-200 dark:border-gray-800',
			{ 'z-3! border-brand-300! shadow-theme-md select-none dark:border-brand-700!': dragging },
		]"
		:style="{ gridRow: `${positioning.y} / span ${height}`, gridColumn: `${positioning.x} / span ${width}` }"
		:data-tile-id="id"
		:data-pos-x="positioning.x"
		:data-pos-y="positioning.y"
		@pointerdown="onPointerDown"
	>
		<div
			v-if="showHeader"
			class="flex h-10 shrink-0 items-center gap-2 border-b border-gray-200 px-3 dark:border-gray-800"
		>
			<slot name="icon">
				<BoIcon :name="icon ?? 'space_dashboard'" size="sm" class="text-gray-500 dark:text-gray-400" />
			</slot>
			<span class="truncate text-theme-xs font-medium text-gray-500 uppercase dark:text-gray-400">{{ name }}</span>
		</div>

		<div v-if="editMode" class="absolute end-1 top-1 z-2 flex items-center gap-0.5" @pointerdown.stop>
			<button type="button" :class="ICON_BTN" :aria-label="t('edit')" :title="t('edit')" @click="emit('edit')">
				<BoIcon name="edit" size="sm" />
			</button>

			<BoMenu v-if="showOptions" :items="menuItems" side="bottom" align="end">
				<template #trigger>
					<button type="button" :class="ICON_BTN" :aria-label="t('item_options', { item: name ?? '' })">
						<BoIcon name="more_vert" size="sm" />
					</button>
				</template>
			</BoMenu>
		</div>

		<div
			v-if="dragging"
			class="pointer-events-none absolute -top-6 start-0 rounded bg-gray-800 px-1.5 font-mono text-theme-xs text-white"
			aria-hidden="true"
		>
			({{ positioning.x - 1 }}:{{ positioning.y - 1 }})
		</div>

		<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden" :class="{ 'pointer-events-none': editMode }">
			<slot />
			<div
				v-if="$slots['footer']"
				class="mt-auto border-t border-gray-200 px-3 py-2 dark:border-gray-800"
				:class="{ 'pointer-events-auto': editMode }"
				@pointerdown.stop
			>
				<slot name="footer" />
			</div>
		</div>
		<slot name="body" />
	</div>
</template>
