// Owner 2026-10-23 (D-173): while API requests run (the requests store that drives the sidebar logo loader, like the
// Directus module-bar logo sprite) the favicon plays drawn sprites: a runner, then a cyclist, then a swimmer, each
// sport changing into the next (favicon-sprites.ts), white on the favicon circle in the project color. A started gait
// cycle or change plays to its end, as the Directus sprite does; no animation with prefers-reduced-motion.
import { usePreferredReducedMotion } from '@vueuse/core';
import { onScopeDispose, ref, type Ref, watch } from 'vue';
import { useRequestsStore } from '../stores/requests.ts';
import { drawScene, type Scene, timeline } from './favicon-sprites.ts';

export const FAVICON_FRAME_MS = 100;

const SIZE = 64;

/** One frame as a PNG data URL, null when the canvas is not available. */
export function drawFaviconFrame(scene: Scene, color: string): string | null {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
	ctx.fill();
	ctx.clip();
	ctx.strokeStyle = ctx.fillStyle = '#FFF'; // raw-color-allowed: white mark of the favicon, like generate-favicon.ts
	drawScene(ctx, scene);

	return canvas.toDataURL('image/png');
}

/** The data URL of the current frame while requests run, null otherwise (the normal favicon). */
export function useFaviconLoader(color: Ref<string>) {
	const requestsStore = useRequestsStore();
	const motion = usePreferredReducedMotion();
	const href = ref<string | null>(null);

	const steps = timeline();
	let frames: (string | null)[] = [];
	let framesColor = '';
	let timer: ReturnType<typeof setInterval> | undefined;
	let index = 0;

	function stop() {
		clearInterval(timer);
		timer = undefined;
		href.value = null;
	}

	function start() {
		if (timer || motion.value === 'reduce') return;

		if (framesColor !== color.value) {
			frames = steps.map(({ scene }) => drawFaviconFrame(scene, color.value));
			framesColor = color.value;
		}

		if (frames.includes(null)) return;

		index = 0;
		href.value = frames[0]!;
		timer = setInterval(() => {
			index = (index + 1) % frames.length;
			if (steps[index]!.stop && !requestsStore.queueHasItems) return stop();
			href.value = frames[index]!;
		}, FAVICON_FRAME_MS);
	}

	watch(
		() => requestsStore.queueHasItems,
		(hasItems) => {
			if (hasItems) start();
		},
		{ immediate: true },
	);

	onScopeDispose(stop);

	return href;
}
