import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import '../styles/index.css';
import { useRequestsStore } from '../stores/requests.ts';
import { FAVICON_FRAME_MS, FAVICON_FRAMES, drawFaviconFrame, useFaviconLoader } from './use-favicon-loader.ts';

// Chromium: the frames need a canvas and the Material Symbols font of the app CSS.
let scope: ReturnType<typeof effectScope>;

beforeEach(() => {
	setActivePinia(createPinia());
	scope = effectScope();
});

afterEach(() => scope.stop());

test('each frame is a different glyph on the color circle', async () => {
	await document.fonts.load('44px "Material Symbols Rounded"', FAVICON_FRAMES.join(''));
	const frames = FAVICON_FRAMES.map((icon) => drawFaviconFrame(icon, '#465fff')); // raw-color-allowed: test color

	expect(frames.every((frame) => frame?.startsWith('data:image/png'))).toBe(true);
	expect(new Set(frames).size).toBe(3);
});

test('run, bike, swim while a request runs, then the normal favicon after the cycle ends', async () => {
	const store = useRequestsStore();
	const href = scope.run(() => useFaviconLoader(ref('#465fff')))!; // raw-color-allowed: test color
	expect(href.value).toBeNull();

	const id = store.startRequest();
	await vi.waitFor(() => expect(href.value).toMatch(/^data:image\/png/));

	const seen = new Set<string>();
	const stop = setInterval(() => href.value && seen.add(href.value), 20);
	await new Promise((resolve) => setTimeout(resolve, FAVICON_FRAME_MS * 3));
	store.endRequest(id);
	await vi.waitFor(() => expect(href.value).toBeNull(), { timeout: FAVICON_FRAME_MS * 5 });
	clearInterval(stop);

	expect(seen.size).toBe(3);
});
