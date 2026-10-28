import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useRequestsStore } from '../stores/requests.ts';
import { knee, SPRITE_CYCLES, SPRITE_FRAMES, timeline, TRANSITION_FRAMES } from './favicon-sprites.ts';
import { canAnimateFavicon, drawFaviconFrame, FAVICON_FRAME_MS, useFaviconLoader } from './use-favicon-loader.ts';

// Chromium: the frames need a canvas.
const COLOR = '#465fff'; // raw-color-allowed: test color
let scope: ReturnType<typeof effectScope>;

const CHROME =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const faked: string[] = [];

/** Overrides a navigator getter for one test (a desktop Chrome with 8 cores by default, whatever the runner is). */
function fakeNavigator(name: 'userAgent' | 'hardwareConcurrency', value: string | number) {
	Object.defineProperty(navigator, name, { get: () => value, configurable: true });
	faked.push(name);
}

beforeEach(() => {
	setActivePinia(createPinia());
	scope = effectScope();
	fakeNavigator('userAgent', CHROME);
	fakeNavigator('hardwareConcurrency', 8);
});

afterEach(() => {
	scope.stop();
	faked.splice(0).forEach((name) => delete (navigator as unknown as Record<string, unknown>)[name]);
	vi.restoreAllMocks();
});

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

// Owner 2026-10-28: a request longer than the 3.5 s of the requests queue (and than one loop) keeps the sprites playing.
test('a request longer than one loop keeps the sprites playing, then the normal favicon is back', async () => {
	const store = useRequestsStore();
	const href = scope.run(() => useFaviconLoader(ref(COLOR)))!;
	const loop = timeline().length * FAVICON_FRAME_MS;

	const id = store.startRequest();
	await vi.waitFor(() => expect(href.value).toMatch(/^data:image\/png/));
	const first = href.value;

	let stopped = false;
	let restarted = false;
	const sample = setInterval(() => {
		stopped ||= href.value === null;
		restarted ||= performance.now() - started > loop / 2 && href.value === first;
	}, 10);
	const started = performance.now();
	await new Promise((resolve) => setTimeout(resolve, loop + 1000));
	clearInterval(sample);

	expect(stopped).toBe(false);
	expect(restarted).toBe(true);
	store.endRequest(id);
	// The next stop may be after the rest of a gait cycle and a whole change.
	await vi.waitFor(() => expect(href.value).toBeNull(), {
		timeout: FAVICON_FRAME_MS * (SPRITE_FRAMES + TRANSITION_FRAMES + 2),
	});
}, 15_000);

test('desktop Chrome, Edge and Firefox get the animation', () => {
	expect(canAnimateFavicon()).toBe(true);
	fakeNavigator('userAgent', `${CHROME} Edg/131.0.0.0`);
	expect(canAnimateFavicon()).toBe(true);
	fakeNavigator('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:132.0) Gecko/20100101 Firefox/132.0');
	expect(canAnimateFavicon()).toBe(true);
});

test.each([
	[
		'Safari',
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
	],
	[
		'an iPhone',
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1',
	],
	[
		'an Android phone',
		'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
	],
])('%s gets no animation', (_, userAgent) => {
	fakeNavigator('userAgent', userAgent);
	expect(canAnimateFavicon()).toBe(false);
});

test('a touch-only device, a two-core machine or reduced motion gets no animation', () => {
	fakeNavigator('hardwareConcurrency', 2);
	expect(canAnimateFavicon()).toBe(false);
	fakeNavigator('hardwareConcurrency', 8);

	const matchMedia = window.matchMedia.bind(window);
	for (const query of ['(pointer: coarse)', '(prefers-reduced-motion: reduce)']) {
		vi.spyOn(window, 'matchMedia').mockImplementation(
			(q) => (q === query ? { matches: true } : matchMedia(q)) as MediaQueryList,
		);
		expect(canAnimateFavicon()).toBe(false);
		vi.restoreAllMocks();
	}
});

test('where the animation is not supported the favicon never changes', async () => {
	fakeNavigator(
		'userAgent',
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
	);
	const store = useRequestsStore();
	const href = scope.run(() => useFaviconLoader(ref(COLOR)))!;

	store.startRequest();
	await new Promise((resolve) => setTimeout(resolve, FAVICON_FRAME_MS * 3));
	expect(href.value).toBeNull();
});
