// Owner 2026-10-23 (D-173): while API requests run (the requests store that drives the sidebar logo loader, like the
// DR module-bar logo sprite) the favicon plays drawn sprites: a runner, then a cyclist, then a swimmer, each
// sport changing into the next (favicon-sprites.ts), white on the favicon circle in the project color. A started gait
// cycle or change plays to its end, as the DR sprite does, then the normal favicon is back. Where the animation
// is not shown well (canAnimateFavicon) the favicon never changes.
import { usePreferredReducedMotion } from '@vueuse/core';
import { onScopeDispose, ref, type Ref, watch } from 'vue';
import { useRequestsStore } from '../stores/requests.ts';
import { drawScene, type Scene, timeline } from './favicon-sprites.ts';

export const FAVICON_FRAME_MS = 100;

const SIZE = 64;

/**
 * Whether this browser and device get the animation: a canvas that exports PNG, no reduced motion, a pointer device
 * (phones and tablets show no tab favicon), a desktop browser that repaints a changed favicon (Safari does not
 * reliably, owner 2026-10-23: "trình duyệt hoặc máy tính không hỗ trợ thì không hiện"), and more than two CPU cores.
 */
export function canAnimateFavicon(): boolean {
	const ua = navigator.userAgent;
	const safari = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Firefox/.test(ua);
	const mobile = /Android|iPhone|iPad|iPod|Mobi/.test(ua) || matchMedia('(pointer: coarse)').matches;
	const weak = (navigator.hardwareConcurrency ?? 4) <= 2;
	const motion = matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (safari || mobile || weak || motion) return false;

	try {
		return document.createElement('canvas').toDataURL('image/png').startsWith('data:image/png');
	} catch {
		return false;
	}
}

/** One frame as a PNG data URL, null when the canvas is not available. */
export function drawFaviconFrame(scene: Scene, color: string): string | null {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	try {
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
		ctx.fill();
		ctx.clip();
		ctx.strokeStyle = ctx.fillStyle = '#FFF'; // raw-color-allowed: white mark of the favicon, like generate-favicon.ts
		drawScene(ctx, scene);
		return canvas.toDataURL('image/png');
	} catch {
		return null;
	}
}

/** The data URL of the current frame while requests run, null otherwise (the normal favicon). */
export function useFaviconLoader(color: Ref<string>) {
	const requestsStore = useRequestsStore();
	const motion = usePreferredReducedMotion();
	const href = ref<string | null>(null);
	const supported = canAnimateFavicon();

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
		// Reduced motion is also read live: it may be switched on while the app is open.
		if (timer || !supported || motion.value === 'reduce') return;

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
