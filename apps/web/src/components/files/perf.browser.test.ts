// Feature 015 T097 (SC-007, FR-040): opening the image editor (ImageEditor, Cropper.js) on a 4000×3000 image takes
// under 2 s from the `load` event of its `img` to Cropper's `ready` event, in chromium with the production Vue build
// (runs with PERF=1 only, vitest.config.ts). Median of 3 opens after a warm-up open (the Cropper.js chunk is then
// loaded, as for a user who opened the editor once); the budget holds on the reference machine and scales with
// machineFactor() elsewhere (test-utils/perf.ts). The image is drawn from pixel bytes (no color strings) and served as
// a data URL through a mocked getAssetUrl, as ImageEditor.browser.test.ts does.
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import { useSettingsStore } from '../../stores/settings.ts';
import { mockApi } from '../../test-utils/fetch.ts';
import { machineFactor } from '../../test-utils/perf.ts';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import ImageEditor from './ImageEditor.vue';

vi.mock('../../utils/get-asset-url.ts', () => ({ getAssetUrl: vi.fn() }));

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

const WIDTH = 4000;
const HEIGHT = 3000;
const BUDGET_MS = 2000;
const RUNS = 3;

let imageUrl: string;

beforeAll(() => {
	// A gradient, so the PNG is a real-size decode and not a flat block.
	const canvas = document.createElement('canvas');
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const context = canvas.getContext('2d')!;
	const image = context.createImageData(WIDTH, HEIGHT);

	for (let y = 0; y < HEIGHT; y++) {
		for (let x = 0; x < WIDTH; x++) {
			const offset = (y * WIDTH + x) * 4;
			image.data[offset] = x & 255;
			image.data[offset + 1] = y & 255;
			image.data[offset + 2] = (x + y) & 255;
			image.data[offset + 3] = 255;
		}
	}

	context.putImageData(image, 0, 0);
	imageUrl = canvas.toDataURL('image/png');
});

async function open(): Promise<number> {
	setActivePinia(createPinia());
	useSettingsStore().settings = { custom_aspect_ratios: null } as never;
	vi.mocked(getAssetUrl).mockReturnValue(imageUrl);
	mockApi({
		'GET /files/file-1': {
			type: 'image/png',
			filesize: 1000,
			filename_download: 'large.png',
			folder: null,
			width: WIDTH,
			height: HEIGHT,
			focal_point_x: null,
			focal_point_y: null,
		},
	});

	let loadedAt = 0;
	let readyAt = 0;
	// `load` and `ready` do not bubble to document from the editor image in every case; capture sees them all.
	const onLoad = (event: Event) => {
		if (event.target instanceof HTMLImageElement && event.target.closest('.editor')) loadedAt ||= performance.now();
	};
	const onReady = () => (readyAt ||= performance.now());
	document.addEventListener('load', onLoad, true);
	document.addEventListener('ready', onReady, true);

	const wrapper = mount(ImageEditor, {
		props: { id: 'file-1', modelValue: true },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	try {
		await vi.waitFor(() => expect(readyAt).toBeGreaterThan(0), { timeout: 15_000 });
		expect(document.querySelector('.cropper-container')).not.toBeNull();
		expect(loadedAt).toBeGreaterThan(0);
		return readyAt - loadedAt;
	} finally {
		document.removeEventListener('load', onLoad, true);
		document.removeEventListener('ready', onReady, true);
		wrapper.unmount();
	}
}

test('the image editor on a 4000×3000 image is ready under 2 s after the image loads', async () => {
	await open();

	const timings: number[] = [];
	for (let run = 0; run < RUNS; run++) timings.push(await open());

	const median = [...timings].sort((a, b) => a - b)[Math.floor(RUNS / 2)]!;
	const factor = machineFactor();
	// eslint-disable-next-line no-console
	console.log(
		`SC-007 image editor 4000x3000 load -> ready: ${timings.map((t) => t.toFixed(0)).join(', ')} ms (median ${median.toFixed(0)}, budget ${(BUDGET_MS * factor).toFixed(0)}, machine factor ${factor.toFixed(2)})`,
	);
	expect(median).toBeLessThan(BUDGET_MS * factor);
});
