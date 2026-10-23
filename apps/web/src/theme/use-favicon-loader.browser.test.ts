import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useRequestsStore } from '../stores/requests.ts';
import { knee, SPRITE_CYCLES, SPRITE_FRAMES, timeline, TRANSITION_FRAMES } from './favicon-sprites.ts';
import { drawFaviconFrame, FAVICON_FRAME_MS, useFaviconLoader } from './use-favicon-loader.ts';

// Chromium: the frames need a canvas.
const COLOR = '#465fff'; // raw-color-allowed: test color
let scope: ReturnType<typeof effectScope>;

beforeEach(() => {
	setActivePinia(createPinia());
	scope = effectScope();
});

afterEach(() => scope.stop());

test('every frame of a gait cycle and of a change is a different drawing', () => {
	const steps = timeline();
	const frames = steps.map(({ scene }) => drawFaviconFrame(scene, COLOR));

	expect(steps).toHaveLength(3 * (SPRITE_FRAMES * SPRITE_CYCLES + TRANSITION_FRAMES));
	expect(frames.every((frame) => frame?.startsWith('data:image/png'))).toBe(true);
	// The second gait cycle of a sport repeats the first one.
	expect(new Set(frames).size).toBe(3 * (SPRITE_FRAMES + TRANSITION_FRAMES));
});

test('the animation may stop at the start of a gait cycle only, never inside a change', () => {
	const stops = timeline().flatMap(({ stop }, i) => (stop ? [i] : []));
	const sport = SPRITE_FRAMES * SPRITE_CYCLES + TRANSITION_FRAMES;

	expect(stops).toEqual([0, 6, sport, sport + 6, 2 * sport, 2 * sport + 6]);
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
	await new Promise((resolve) => setTimeout(resolve, FAVICON_FRAME_MS * SPRITE_FRAMES * SPRITE_CYCLES * 1.5));
	store.endRequest(id);
	await vi.waitFor(() => expect(href.value).toBeNull(), { timeout: FAVICON_FRAME_MS * (SPRITE_FRAMES + 2) });
	clearInterval(sample);

	// The runner's frames and at least the start of the cyclist.
	expect(seen.size).toBeGreaterThan(SPRITE_FRAMES);
});
