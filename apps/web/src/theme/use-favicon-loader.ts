// Owner 2026-10-23 (D-173): while API requests run (the requests store that drives the sidebar logo loader, like the
// Directus module-bar logo sprite) the favicon cycles run → bike → swim: Material Symbols glyphs drawn white on the
// favicon circle in the project color. A started cycle plays to its end, as the Directus sprite does; no animation
// with prefers-reduced-motion.
import { usePreferredReducedMotion } from '@vueuse/core';
import { onScopeDispose, ref, type Ref, watch } from 'vue';
import { useRequestsStore } from '../stores/requests.ts';

export const FAVICON_FRAMES = ['directions_run', 'directions_bike', 'pool'] as const;
export const FAVICON_FRAME_MS = 250;

const SIZE = 64;
const FONT = `44px "Material Symbols Rounded"`;

/** One frame as a PNG data URL, null when the canvas or the icon font is not available. */
export function drawFaviconFrame(icon: string, color: string): string | null {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#FFF'; // raw-color-allowed: white mark of the favicon, like generate-favicon.ts
	ctx.font = FONT;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(icon, SIZE / 2, SIZE / 2);

	return canvas.toDataURL('image/png');
}

/** The data URL of the current frame while requests run, null otherwise (the normal favicon). */
export function useFaviconLoader(color: Ref<string>) {
	const requestsStore = useRequestsStore();
	const motion = usePreferredReducedMotion();
	const href = ref<string | null>(null);

	let frames: (string | null)[] = [];
	let framesColor = '';
	let timer: ReturnType<typeof setInterval> | undefined;
	let index = 0;

	function stop() {
		clearInterval(timer);
		timer = undefined;
		href.value = null;
	}

	async function start() {
		if (timer || motion.value === 'reduce') return;

		if (framesColor !== color.value) {
			await document.fonts?.load(FONT, FAVICON_FRAMES.join(''));
			frames = FAVICON_FRAMES.map((icon) => drawFaviconFrame(icon, color.value));
			framesColor = color.value;
		}

		if (timer || frames.includes(null) || !requestsStore.queueHasItems) return;

		index = 0;
		href.value = frames[0]!;
		timer = setInterval(() => {
			index = (index + 1) % frames.length;
			if (index === 0 && !requestsStore.queueHasItems) return stop();
			href.value = frames[index]!;
		}, FAVICON_FRAME_MS);
	}

	watch(
		() => requestsStore.queueHasItems,
		(hasItems) => {
			if (hasItems) void start();
		},
		{ immediate: true },
	);

	onScopeDispose(stop);

	return href;
}
