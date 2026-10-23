import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useRequestsStore } from '../stores/requests.ts';
import { knee, SPRITE_FRAMES, SPRITES } from './favicon-sprites.ts';
import { drawFaviconFrame, FAVICON_CYCLES, FAVICON_FRAME_MS, useFaviconLoader } from './use-favicon-loader.ts';

// Chromium: the frames need a canvas.
const COLOR = '#465fff'; // raw-color-allowed: test color
let scope: ReturnType<typeof effectScope>;

beforeEach(() => {
	setActivePinia(createPinia());
	scope = effectScope();
});

afterEach(() => scope.stop());

test('every frame of every sprite is a different drawing', () => {
	const frames = SPRITES.flatMap((sprite) =>
		Array.from({ length: SPRITE_FRAMES }, (_, frame) => drawFaviconFrame(sprite, frame, COLOR)),
	);

	expect(frames.every((frame) => frame?.startsWith('data:image/png'))).toBe(true);
	expect(new Set(frames).size).toBe(SPRITES.length * SPRITE_FRAMES);
});

test('the knee joins two equal segments and bends toward the front', () => {
	const [x, y] = knee([0, 0], [0, 16], 10);

	expect(Math.hypot(x, y)).toBeCloseTo(10);
	expect(Math.hypot(x, y - 16)).toBeCloseTo(10);
	expect(x).toBeGreaterThan(0);
});

test('the sprites play while a request runs, then the gait cycle ends and the normal favicon is back', async () => {
	const store = useRequestsStore();
	const href = scope.run(() => useFaviconLoader(ref(COLOR)))!;
	expect(href.value).toBeNull();

	const id = store.startRequest();
	await vi.waitFor(() => expect(href.value).toMatch(/^data:image\/png/));

	const seen = new Set<string>();
	const sample = setInterval(() => href.value && seen.add(href.value), 10);
	await new Promise((resolve) => setTimeout(resolve, FAVICON_FRAME_MS * SPRITE_FRAMES * FAVICON_CYCLES * 1.5));
	store.endRequest(id);
	await vi.waitFor(() => expect(href.value).toBeNull(), { timeout: FAVICON_FRAME_MS * (SPRITE_FRAMES + 2) });
	clearInterval(sample);

	// The runner's frames and at least the start of the cyclist.
	expect(seen.size).toBeGreaterThan(SPRITE_FRAMES);
});
