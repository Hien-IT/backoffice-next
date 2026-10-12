// Ported from directus/tests/e2e/tests/endpoints/assets/assets.test.ts
// Backoffice (research R7 of spec 007): no harness of directus/tests/e2e here; the same requests run against each app
// with the admin of the parity environment, and `toMatchFile` becomes a byte comparison with the result images of
// the Directus test (tests/parity/fixtures/assets). Each app works on its own upload, so neither reuses the derived
// assets of the other (transform-matrix.test.ts covers the reuse).
import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { APPS, urls } from '../auth/fixtures.js';
import { admin, assetFixture } from './helpers.js';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

describe.each(APPS)('%s', (app) => {
	const base = urls()[app];
	let upload: { id: string };

	async function readAssetArrayBuffer(id: string, query: Record<string, string>) {
		const res = await fetch(new URL(`/assets/${id}?${new URLSearchParams(query)}`, base), { headers: await admin() });
		return Buffer.from(await res.arrayBuffer());
	}

	test('upload image.jpg', async () => {
		const file = assetFixture('image.jpg');
		const form = new FormData();
		form.set('file', new Blob([file], { type: 'image/jpeg' }), 'image.jpg');
		const res = await fetch(new URL('/files', base), { method: 'POST', headers: await admin(), body: form });
		upload = ((await res.json()) as { data: { id: string } }).data;
		expect(upload.id).toBeTruthy();
	});

	test('resize to 50x50', async () => {
		const scaled = await readAssetArrayBuffer(upload.id, { width: '50' });

		expect(sha(scaled)).toBe(sha(assetFixture('img_50x50.jpg')));
	});

	test('quality of 10', async () => {
		const scaled = await readAssetArrayBuffer(upload.id, { quality: '10' });

		expect(sha(scaled)).toBe(sha(assetFixture('img_quality_10.jpg')));
	});

	test('format webp', async () => {
		const scaled = await readAssetArrayBuffer(upload.id, { format: 'webp' });

		expect(sha(scaled)).toBe(sha(assetFixture('img_format_webp.webp')));
	});

	test('transform grayscale', async () => {
		const scaled = await readAssetArrayBuffer(upload.id, { transforms: JSON.stringify([['grayscale']]) });

		expect(sha(scaled)).toBe(sha(assetFixture('img_grayscale.jpg')));
	});

	test('concurrent requests', async () => {
		const time = performance.now();

		const results = await Promise.all(
			[{ width: '50' }, { height: '50' }, { quality: '10' }, { format: 'webp' }].map(async (options) => {
				const time = performance.now();
				await readAssetArrayBuffer(upload.id, options);
				const duration = performance.now() - time;
				return duration;
			}),
		);

		const duration = performance.now() - time;

		expect(results.reduce((a, b) => a + b, 0) / 2).toBeGreaterThan(duration);
	});

	const formatHeaders = [
		{ accept: 'image/avif,image/webp,image/*,*/*;q=0.8', contentType: 'image/avif' },
		{ accept: 'image/avif', contentType: 'image/avif' },
		{ accept: 'image/webp', contentType: 'image/webp' },
		{ accept: '*/*', contentType: 'image/jpeg' },
		{ accept: undefined, contentType: 'image/jpeg' },
	];

	for (const header of formatHeaders) {
		test(`format=auto with "${header.accept ?? 'no'}" Accept request header`, async () => {
			const response = await fetch(new URL(`/assets/${upload.id}?format=auto`, base), {
				headers: { ...(await admin()), ...(header.accept ? { Accept: header.accept } : {}) },
			});

			expect(response.headers.get('Content-Type')).toBe(header.contentType);
		});
	}

	test('cleanup', async () => {
		await fetch(new URL(`/files/${upload.id}`, base), { method: 'DELETE', headers: await admin() });
	});
});
