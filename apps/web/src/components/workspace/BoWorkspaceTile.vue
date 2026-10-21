<!-- Ported from directus/app/src/components/v-workspace-tile.vue -->
<script setup lang="ts">
// Backoffice (spec 017 FR-025, recipe Q-30): the move drag of the flows editor, no RTL mirroring (no RTL language in the
// app). Feature 018 (FR-024, recipe Q-34) adds the 8 resize handles of the Insights dashboard (`resizable`, off by
// default so the flows editor keeps its behaviour), the min size clamp, the `W×H` label and the per-corner radius
// (`borderRadius`). The tile exposes its cell and size in `data-pos-x/y`, `data-width/height` for the E2E comparison
// with the Directus app (SC-002). Dragging and resizing are pointer only, as Directus (recorded a11y exceptions, 017
// FR-106, 018 FR-027); the edit and options buttons are keyboard reachable. Unlike Directus the pointer listeners are
// always removed on release (an empty edit leaves them attached there; no effect on the data). With `unselectable`
// (Insights, owner 2026-10-18) the tile in edit mode is not selectable and starts no native drag (Directus:
// `user-select: none` only once dragging): on webkit a text selection left by a previous drag turned the next pointer
// drag into a native one, which stopped the pointer events after the first move (CI run 39076577997). The flows canvas
// keeps the Directus behaviour.
import { throttle } from 'lodash-es';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../BoMenu.vue';
import BoTooltip from '../BoTooltip.vue';

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

export type TilePosition = {
	position_x?: number | undefined;
	position_y?: number | undefined;
	width?: number | undefined;
	height?: number | undefined;
};

type Operation =
	| 'move'
	| 'resize-top'
	| 'resize-right'
	| 'resize-bottom'
	| 'resize-left'
	| 'resize-top-left'
	| 'resize-top-right'
	| 'resize-bottom-right'
	| 'resize-bottom-left';

const HANDLES: { operation: Operation; class: string }[] = [
	{ operation: 'resize-top', class: 'top-0 left-3 right-3 h-3 -translate-y-1/2 cursor-ns-resize' },
	{ operation: 'resize-right', class: 'right-0 top-3 bottom-3 w-3 translate-x-1/2 cursor-ew-resize' },
	{ operation: 'resize-bottom', class: 'bottom-0 left-3 right-3 h-3 translate-y-1/2 cursor-ns-resize' },
	{ operation: 'resize-left', class: 'left-0 top-3 bottom-3 w-3 -translate-x-1/2 cursor-ew-resize' },
	{ operation: 'resize-top-left', class: 'top-0 left-0 size-3 -translate-1/2 cursor-nwse-resize' },
	{ operation: 'resize-top-right', class: 'top-0 right-0 size-3 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize' },
	{ operation: 'resize-bottom-right', class: 'bottom-0 right-0 size-3 translate-1/2 cursor-nwse-resize' },
	{
		operation: 'resize-bottom-left',
		class: 'bottom-0 left-0 size-3 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
	},
];

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
		/** Info icon at the end of the header with this text as tooltip (v-workspace-tile `note`, spec 020) */
		note?: string | undefined;
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
		/** Shows the 8 resize handles in edit mode (018) */
		resizable?: boolean;
		/** In edit mode: no text selection and no native drag (018 Insights) */
		unselectable?: boolean;
		/** Smallest size in cells while resizing */
		minWidth?: number;
		minHeight?: number;
		/** Rounded corners [top-left, top-right, bottom-right, bottom-left]; all rounded while dragging */
		borderRadius?: [boolean, boolean, boolean, boolean];
	}>(),
	{
		name: undefined,
		icon: 'space_dashboard',
		showHeader: true,
		note: undefined,
		editMode: false,
		draggable: true,
		showOptions: true,
		alwaysUpdatePosition: false,
		gridSize: 18,
		resizable: false,
		unselectable: false,
		minWidth: 8,
		minHeight: 6,
		borderRadius: () => [true, true, true, true],
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

const editedPosition = reactive<TilePosition>({
	position_x: undefined,
	position_y: undefined,
	width: undefined,
	height: undefined,
});

const { onPointerDown, dragging } = useDragDrop();

const positioning = computed(() => ({
	x: dragging.value ? (editedPosition.position_x ?? props.x) : props.x,
	y: dragging.value ? (editedPosition.position_y ?? props.y) : props.y,
	width: dragging.value ? (editedPosition.width ?? props.width) : props.width,
	height: dragging.value ? (editedPosition.height ?? props.height) : props.height,
}));

const radius = computed(() => {
	const [tl, tr, br, bl] = props.borderRadius;
	if (dragging.value) return 'rounded-xl';
	return [
		tl ? 'rounded-tl-xl' : 'rounded-tl-none',
		tr ? 'rounded-tr-xl' : 'rounded-tr-none',
		br ? 'rounded-br-xl' : 'rounded-br-none',
		bl ? 'rounded-bl-xl' : 'rounded-bl-none',
	];
});

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
	let panelStartWidth = 0;
	let panelStartHeight = 0;
	let operation: Operation = 'move';

	const onPointerMove = throttle((event: PointerEvent) => {
		if (props.editMode === false || dragging.value === false || props.draggable === false) return;

		const gridDeltaX = Math.round((event.pageX - pointerStartPosX) / props.gridSize);
		const gridDeltaY = Math.round((event.pageY - pointerStartPosY) / props.gridSize);

		if (operation === 'move') {
			editedPosition.position_y = Math.max(1, panelStartPosY + gridDeltaY);
			editedPosition.position_x = Math.max(1, panelStartPosX + gridDeltaX);
		} else {
			// Same as Directus v-workspace-tile: a top/left resize keeps moving x/y once the size hits the minimum (R-54).
			if (operation.includes('top')) {
				editedPosition.height = panelStartHeight - gridDeltaY;
				editedPosition.position_y = panelStartPosY + gridDeltaY;
			}

			if (operation.includes('right')) editedPosition.width = panelStartWidth + gridDeltaX;
			if (operation.includes('bottom')) editedPosition.height = panelStartHeight + gridDeltaY;

			if (operation.includes('left')) {
				editedPosition.width = panelStartWidth - gridDeltaX;
				editedPosition.position_x = panelStartPosX + gridDeltaX;
			}

			if (editedPosition.position_x && editedPosition.position_x < 1) editedPosition.position_x = 1;
			if (editedPosition.position_y && editedPosition.position_y < 1) editedPosition.position_y = 1;
			if (editedPosition.width && editedPosition.width < props.minWidth) editedPosition.width = props.minWidth;
			if (editedPosition.height && editedPosition.height < props.minHeight) editedPosition.height = props.minHeight;
		}

		if (props.alwaysUpdatePosition) emit('update', { ...editedPosition });
	}, 20);

	return { dragging, onPointerDown };

	function onPointerDown(event: PointerEvent, op: Operation = 'move') {
		if (props.editMode === false || props.draggable === false || event.button !== 0) return;

		operation = op;
		dragging.value = true;

		pointerStartPosX = event.pageX;
		pointerStartPosY = event.pageY;
		panelStartPosX = props.x;
		panelStartPosY = props.y;
		panelStartWidth = props.width;
		panelStartHeight = props.height;

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
		editedPosition.width = undefined;
		editedPosition.height = undefined;
	}
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`;
</script>

<template>
	<div
		class="bo-workspace-tile group/tile relative z-1 flex flex-col border bg-white shadow-theme-xs transition-[border-color,box-shadow] hover:z-3 motion-reduce:transition-none dark:bg-gray-900"
		:class="[
			radius,
			editMode && draggable
				? 'cursor-move border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
				: 'border-gray-200 dark:border-gray-800',
			{ 'z-3! border-brand-300! shadow-theme-md select-none dark:border-brand-700!': dragging },
			{ 'select-none': editMode && draggable && unselectable },
		]"
		:style="{
			gridRow: `${positioning.y} / span ${positioning.height}`,
			gridColumn: `${positioning.x} / span ${positioning.width}`,
		}"
		:data-tile-id="id"
		:data-pos-x="positioning.x"
		:data-pos-y="positioning.y"
		:data-width="positioning.width"
		:data-height="positioning.height"
		@pointerdown="onPointerDown($event)"
		@dragstart="editMode && draggable && unselectable && $event.preventDefault()"
	>
		<div
			v-if="showHeader"
			class="flex h-10 shrink-0 items-center gap-2 border-b border-gray-200 px-3 dark:border-gray-800"
		>
			<slot name="icon">
				<BoIcon :name="icon ?? 'space_dashboard'" size="sm" class="text-gray-500 dark:text-gray-400" />
			</slot>
			<span class="truncate text-theme-xs font-medium text-gray-500 uppercase dark:text-gray-400">{{ name }}</span>
			<BoTooltip v-if="note" :text="note">
				<!-- eslint-disable-next-line vuejs-accessibility/no-noninteractive-tabindex -- focusable so the note tooltip opens from the keyboard -->
				<span tabindex="0" class="ms-auto inline-flex rounded" :class="FOCUS" @pointerdown.stop>
					<BoIcon name="info" size="sm" :label="note" class="text-gray-500 dark:text-gray-400" />
				</span>
			</BoTooltip>
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
			<template v-if="resizable">{{ positioning.width }}×{{ positioning.height }}</template>
		</div>

		<template v-if="editMode && resizable">
			<div
				v-for="handle in HANDLES"
				:key="handle.operation"
				class="absolute z-2 rounded-full border border-gray-300 bg-white opacity-0 transition-opacity group-hover/tile:opacity-100 hover:opacity-100 motion-reduce:transition-none dark:border-gray-600 dark:bg-gray-800"
				:class="[handle.class, { 'opacity-100': dragging }]"
				:data-resize="handle.operation.replace('resize-', '')"
				aria-hidden="true"
				@pointerdown.stop="onPointerDown($event, handle.operation)"
			/>
		</template>

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
