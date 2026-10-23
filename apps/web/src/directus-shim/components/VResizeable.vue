<!-- Ported from directus/app/src/components/v-resizeable.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): v-resizeable sets the width of its first child; the grab bar is dragged with the
// pointer as in DR (snap zones, double click resets) and is also a focusable `separator` (design-system XII):
// Left/Right ±10 px (±50 with Shift, mirrored in RTL), Home/End = min/max width, Enter = the default width. With
// `alwaysShowHandle` the bar is a border line that turns brand on hover, as DR.
import { useElementVisibility, useEventListener } from '@vueuse/core';
import { clamp } from 'lodash-es';
import { computed, ref, watch } from 'vue';
import { useUserStore } from '../../stores/user.ts';

type SnapZone = {
	snapPos: number;
	width: number;
	direction?: 'left' | 'right';
	onSnap?: () => void;
	onPointerUp?: () => void;
};

export type ResizeableOptions = { snapZones?: SnapZone[]; alwaysShowHandle?: boolean; disableTransition?: boolean };

const props = withDefaults(
	defineProps<{
		width: number;
		minWidth?: number;
		maxWidth?: number;
		defaultWidth?: number;
		disabled?: boolean;
		options?: ResizeableOptions | undefined;
	}>(),
	{
		minWidth: (props) => props.width,
		maxWidth: Infinity,
		defaultWidth: (props) => props.minWidth ?? props.width,
		options: undefined,
	},
);

const emit = defineEmits<{
	'update:width': [value: number];
	dragging: [value: boolean];
	transitionEnd: [];
}>();

const STEP = 10;
const LARGE_STEP = 50;

const wrapper = ref<HTMLDivElement>();

const target = computed(() => {
	const firstChild = wrapper.value?.firstElementChild;

	if (firstChild instanceof HTMLElement && !firstChild?.hasAttribute('data-grab-bar')) {
		return firstChild;
	}

	return undefined;
});

const targetIsVisible = useElementVisibility(target);

const active = ref(false);
const dragging = ref(false);
let dragStartX = 0;
let dragStartWidth = 0;
let previousX = 0;
let animationFrameID: number;
let previousCursor: string;

useEventListener(window, 'pointermove', onPointerMove);
useEventListener(window, 'pointerup', onPointerUp);

useEventListener(target, 'transitionend', (event: TransitionEvent) => {
	if (event.target === target.value && event.propertyName === 'width') {
		emit('transitionEnd');
	}
});

// useSync: the width is the caller's (v-model:width).
const internalWidth = computed({
	get: () => props.width,
	set: (value: number) => emit('update:width', value),
});

const userStore = useUserStore();

const isRTL = computed(() => userStore.textDirection === 'rtl');

watch(
	[internalWidth, target, () => props.maxWidth],
	([width, target, maxWidth]) => {
		if (!target) return;

		const finalWidth = width > maxWidth ? maxWidth : width;

		target.style.inlineSize = `${finalWidth}px`;
	},
	{ immediate: true },
);

watch(dragging, (dragging) => {
	emit('dragging', dragging);
});

function resetWidth() {
	internalWidth.value = props.defaultWidth;
}

function onKeydown(event: KeyboardEvent) {
	const step = event.shiftKey ? LARGE_STEP : STEP;
	const grow = isRTL.value ? -step : step;
	let next: number;

	if (event.key === 'ArrowRight') next = props.width + grow;
	else if (event.key === 'ArrowLeft') next = props.width - grow;
	else if (event.key === 'Home') next = props.minWidth;
	else if (event.key === 'End' && Number.isFinite(props.maxWidth)) next = props.maxWidth;
	else if (event.key === 'Enter') next = props.defaultWidth;
	else return;

	event.preventDefault();
	internalWidth.value = clamp(next, props.minWidth, props.maxWidth);
}

function onPointerDown(event: PointerEvent) {
	if (target.value) {
		dragging.value = true;
		previousCursor = document.body.style.cursor;
		document.body.style.cursor = 'ew-resize';
		dragStartX = event.pageX;
		dragStartWidth = target.value.offsetWidth;
		previousX = event.pageX;
	}
}

function onPointerMove(event: PointerEvent) {
	if (!dragging.value) return;

	animationFrameID = window.requestAnimationFrame(() => {
		const dragDelta = event.pageX - dragStartX;

		const newWidth = clamp(
			isRTL.value ? dragStartWidth - dragDelta : dragStartWidth + dragDelta,
			props.minWidth,
			props.maxWidth,
		);

		const snapZones = props.options?.snapZones;

		if (Array.isArray(snapZones)) {
			let direction;

			if (event.pageX < previousX) {
				direction = 'left';
			} else if (event.pageX > previousX) {
				direction = 'right';
			}

			previousX = event.pageX;

			for (const zone of snapZones) {
				if (zone.direction && !direction) return;

				if ((!zone.direction || zone.direction === direction) && Math.abs(newWidth - zone.snapPos) < zone.width) {
					internalWidth.value = zone.snapPos;

					if (zone.onSnap) zone.onSnap();
					return;
				}
			}
		}

		internalWidth.value = newWidth;
	});
}

function onPointerUp() {
	if (!dragging.value) return;

	dragging.value = false;
	document.body.style.cursor = previousCursor;

	const snapZones = props.options?.snapZones;

	if (Array.isArray(snapZones)) {
		for (const zone of snapZones) {
			if (Math.abs(props.width - zone.snapPos) < zone.width) {
				if (zone.onPointerUp) zone.onPointerUp();
				break;
			}
		}
	}

	if (animationFrameID) {
		window.cancelAnimationFrame(animationFrameID);
	}
}
</script>

<template>
	<div
		v-if="!disabled"
		ref="wrapper"
		class="resize-wrapper relative max-h-full"
		:class="{
			'[&>:first-child]:transition-[width] [&>:first-child]:duration-300 motion-reduce:[&>:first-child]:transition-none':
				!dragging && !options?.disableTransition,
		}"
	>
		<slot />

		<!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- a focusable separator (role) -->
		<div
			v-if="targetIsVisible"
			role="separator"
			aria-orientation="vertical"
			tabindex="0"
			:aria-label="$t('width')"
			:aria-valuenow="Math.round(width)"
			:aria-valuemin="Math.round(minWidth)"
			:aria-valuemax="Number.isFinite(maxWidth) ? Math.round(maxWidth) : undefined"
			data-grab-bar
			class="absolute inset-y-0 end-0 z-10 w-1 translate-x-1/2 cursor-ew-resize touch-none transition select-none hover:bg-brand-500 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:bg-brand-500 active:opacity-100 motion-reduce:transition-none rtl:-translate-x-1/2 dark:hover:bg-brand-400 dark:focus-visible:outline-brand-400"
			:class="[
				options?.alwaysShowHandle ? 'bg-gray-200 dark:bg-gray-800' : 'bg-brand-500 opacity-0 dark:bg-brand-400',
				{ 'delay-300': active },
			]"
			@pointerenter="active = true"
			@pointerleave="active = false"
			@pointerdown.self="onPointerDown"
			@dblclick="resetWidth"
			@keydown="onKeydown"
		/>
	</div>
	<slot v-else />
</template>
