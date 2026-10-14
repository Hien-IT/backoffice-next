<!-- Ported from directus/app/src/views/private/private-view/components/private-view-resize-handle.vue -->
<script setup lang="ts">
// Backoffice: the handle does the resizing itself (Directus uses the divider of @directus/vue-split-panel): pointer
// drag and arrow keys (±16 px), a focusable window splitter (role=separator, FR-027). Layout is ltr only (D-46).
const size = defineModel<number>({ required: true });

const {
	min,
	max,
	location = 'start',
} = defineProps<{
	min: number;
	max: number;
	/** start: the resized pane is before the handle (nav); end: after it (sidebar), so dragging left grows it. */
	location?: 'start' | 'end';
	label: string;
}>();

const STEP = 16;

function setSize(value: number) {
	size.value = Math.round(Math.min(max, Math.max(min, value)));
}

function onKeydown(event: KeyboardEvent) {
	const sign = location === 'start' ? 1 : -1;

	if (event.key === 'ArrowRight') setSize(size.value + STEP * sign);
	else if (event.key === 'ArrowLeft') setSize(size.value - STEP * sign);
	else return;

	event.preventDefault();
}

function onPointerdown(event: PointerEvent) {
	const target = event.currentTarget as HTMLElement;
	const startX = event.clientX;
	const startSize = size.value;
	const sign = location === 'start' ? 1 : -1;

	target.setPointerCapture?.(event.pointerId);

	const onMove = (move: PointerEvent) => setSize(startSize + (move.clientX - startX) * sign);

	const onUp = () => {
		target.removeEventListener('pointermove', onMove);
		target.removeEventListener('pointerup', onUp);
		target.removeEventListener('pointercancel', onUp);
	};

	target.addEventListener('pointermove', onMove);
	target.addEventListener('pointerup', onUp);
	target.addEventListener('pointercancel', onUp);
	event.preventDefault();
}
</script>

<template>
	<div
		role="separator"
		tabindex="0"
		aria-orientation="vertical"
		:aria-label="label"
		:aria-valuenow="size"
		:aria-valuemin="min"
		:aria-valuemax="max"
		class="absolute inset-y-0 z-10 w-1 cursor-col-resize touch-none opacity-0 transition-opacity hover:bg-brand-500 hover:opacity-100 focus-visible:bg-brand-500 focus-visible:opacity-100 dark:hover:bg-brand-400 dark:focus-visible:bg-brand-400"
		:class="location === 'start' ? '-end-1' : '-start-1'"
		@keydown="onKeydown"
		@pointerdown="onPointerdown"
	/>
</template>
