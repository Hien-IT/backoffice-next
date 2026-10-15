// Feature 015 (T050): a fixed 400×300 PNG drawn in the browser (Vitest browser project): four quadrants of different
// channels so crop, rotate and flip results can be checked by pixel. Pixel bytes, not color strings (raw-color guard).
export const FIXED_WIDTH = 400;
export const FIXED_HEIGHT = 300;

/** RGBA of the quadrant that holds pixel (x, y): top-left red, top-right green, bottom-left blue, bottom-right white. */
export function quadrant(x: number, y: number): [number, number, number, number] {
	const right = x >= FIXED_WIDTH / 2;
	const bottom = y >= FIXED_HEIGHT / 2;
	if (!bottom) return right ? [0, 255, 0, 255] : [255, 0, 0, 255];
	return right ? [255, 255, 255, 255] : [0, 0, 255, 255];
}

/** The PNG as a data URL. */
export function fixedPngDataUrl(): string {
	const canvas = document.createElement('canvas');
	canvas.width = FIXED_WIDTH;
	canvas.height = FIXED_HEIGHT;
	const context = canvas.getContext('2d')!;
	const image = context.createImageData(FIXED_WIDTH, FIXED_HEIGHT);

	for (let y = 0; y < FIXED_HEIGHT; y++) {
		for (let x = 0; x < FIXED_WIDTH; x++) image.data.set(quadrant(x, y), (y * FIXED_WIDTH + x) * 4);
	}

	context.putImageData(image, 0, 0);
	return canvas.toDataURL('image/png');
}
