// Feature 007, US2 (spec FR-034 to FR-040, FR-082, SC-004, SC-005, Clarifications: byte-identical assets). Each case
// generates the derived asset at Directus, removes it, generates it again at Backoffice, and compares the status, the
// Content-Type, the bytes and the name of the derived object; then it asks Directus again and checks that no object
// is written (the file Backoffice made is reused). The first block compares both apps with the result images of
// directus/tests/e2e/tests/endpoints/assets (made by the sharp of Directus): the gate of research R2.
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type App, urls } from '../auth/fixtures.js';
import { getStorages, type StorageLocation } from '../config.js';
import { appRequest } from '../directus-api.js';
import { capture } from '../parity.js';
import { admin, assetFixture, fixture, multipart } from './helpers.js';
import { deleteDerived, listObjects } from './storage-capture.js';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const created: string[] = [];

async function upload(storage: StorageLocation, data: Buffer, filename: string, type: string): Promise<string> {
	const { body, headers } = multipart([
		{ name: 'storage', value: storage },
		{ name: 'file', data, filename, contentType: type },
	]);

	const res = await fetch(new URL('/files', urls().directus), {
		method: 'POST',
		headers: { ...(await admin()), ...headers },
		body,
	});
	if (!res.ok) throw new Error(`upload ${filename}: ${res.status} ${await res.text()}`);
	const id = ((await res.json()) as { data: { id: string } }).data.id;
	created.push(id);
	return id;
}

afterAll(async () => {
	const ids = created.splice(0);
	if (ids.length) await appRequest('directus', 'DELETE', '/files', ids).catch(() => undefined);
}, 120_000);

interface Generated {
	status: number;
	type: string | undefined;
	sha: string;
	size: number;
	derived: string[];
}

/** GET /assets/:id?query at one app; returns the response and the derived objects of the file afterwards. */
async function generate(
	app: App,
	storage: StorageLocation,
	id: string,
	query: string,
	accept?: string,
): Promise<Generated> {
	const res = await capture(urls()[app], {
		path: `/assets/${id}?${query}`,
		headers: { ...(await admin()), ...(accept ? { accept } : {}) },
	});

	const bytes = res.bytes ?? Buffer.alloc(0);
	const derived = (await listObjects(storage, id))
		.filter((key) => key.includes('__'))
		.map((k) => k.replace(id, '<id>'));

	return { status: res.status, type: res.headers['content-type'], sha: sha(bytes), size: bytes.length, derived };
}

/** Directus first, then Backoffice from scratch, then Directus again on the object Backoffice wrote. */
async function compareApps(storage: StorageLocation, id: string, query: string, accept?: string) {
	await deleteDerived(storage, id);
	const directus = await generate('directus', storage, id, query, accept);
	await deleteDerived(storage, id);
	const backoffice = await generate('backoffice', storage, id, query, accept);
	const reused = await generate('directus', storage, id, query, accept);

	return { directus, backoffice, reused };
}

function expectSame(label: string, result: Awaited<ReturnType<typeof compareApps>>) {
	expect(result.backoffice, label).toEqual(result.directus);
	// SC-005: Directus serves the object Backoffice made, and writes nothing new.
	expect(result.reused, `${label} (reused)`).toEqual(result.directus);
}

describe('gate: the result images of the Directus e2e assets test (research R2)', () => {
	let id: string;

	beforeAll(async () => {
		id = await upload('local', assetFixture('image.jpg'), 'image.jpg', 'image/jpeg');
	});

	it.each([
		['width=50', 'img_50x50.jpg'],
		['quality=10', 'img_quality_10.jpg'],
		['format=webp', 'img_format_webp.webp'],
		[`transforms=${encodeURIComponent(JSON.stringify([['grayscale']]))}`, 'img_grayscale.jpg'],
	])('%s: both apps return the bytes of %s', async (query, expected) => {
		const result = await compareApps('local', id, query);
		const reference = sha(assetFixture(expected));

		expectSame(query, result);
		expect(result.directus.sha, `Directus ${query}`).toBe(reference);
		expect(result.backoffice.sha, `Backoffice ${query}`).toBe(reference);
	});
});

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

/** Every option of a transformation on the main fixture (FR-082). */
const FULL: [string, string?][] = [
	['width=120&height=80&fit=cover'],
	['width=120&height=80&fit=contain'],
	['width=120&height=80&fit=inside&withoutEnlargement=true'],
	['width=2000&fit=outside&withoutEnlargement=true'],
	['width=2000&withoutEnlargement=false'],
	['width=100&format=png'],
	['format=webp&quality=50'],
	['format=avif&width=160'],
	['format=tiff&width=160'],
	['format=jpg&quality=30'],
	['format=auto&width=200', 'image/avif,image/webp,image/*,*/*;q=0.8'],
	['format=auto&width=200', 'image/webp'],
	['format=auto&width=200', '*/*'],
	['width=100&height=100&fit=cover&focal_point_x=10&focal_point_y=10'],
	['width=100&height=100&fit=cover&focal_point_x=0&focal_point_y=400'],
	[
		`width=60&transforms=${json([
			['blur', 2],
			['rotate', 90],
		])}`,
	],
	[
		`transforms=${json([
			['resize', { width: 50 }],
			['toFormat', 'png'],
			['toFormat', 'webp', { quality: 20 }],
		])}`,
	],
	['key=system-medium-cover', 'image/avif,image/webp,*/*'],
	['key=system-small-contain'],
];

/** The classes of images that can change the output bytes (FR-082), each with a few transformations. */
const IMAGES: [string, string][] = [
	['photo-rotated.jpg', 'image/jpeg'],
	['photo-cmyk.jpg', 'image/jpeg'],
	['image-8bit.png', 'image/png'],
	['image-16bit.png', 'image/png'],
	['image-alpha.png', 'image/png'],
	['image.webp', 'image/webp'],
	['image.tiff', 'image/tiff'],
	['image.avif', 'image/avif'],
	['image-static.gif', 'image/gif'],
	['image-animated.gif', 'image/gif'],
	['image-wide.png', 'image/png'],
	['photo-truncated.jpg', 'image/jpeg'],
	['document.pdf', 'application/pdf'],
	['drawing.svg', 'image/svg+xml'],
];

const SHORT: [string, string?][] = [
	['width=90&height=60&fit=cover'],
	['format=auto&width=120', 'image/avif,image/webp,*/*'],
	['format=png&width=70'],
	[
		`transforms=${json([
			['rotate', 45],
			['flatten', { background: '#ff0000' }],
		])}&width=50`,
	],
];

describe('photo.jpg: every option (FR-082)', () => {
	let id: string;

	beforeAll(async () => {
		id = await upload('local', fixture('photo.jpg'), 'photo.jpg', 'image/jpeg');
	});

	it.each(FULL.map(([q, a]) => [q, a ?? 'none'] as const))('%s (Accept %s)', async (query, accept) => {
		expectSame(query, await compareApps('local', id, query, accept === 'none' ? undefined : accept));
	});
});

describe.each(IMAGES)('%s (FR-082)', (name, type) => {
	let id: string;

	beforeAll(async () => {
		id = await upload('local', fixture(name), name, type);
	});

	it.each(SHORT.map(([q, a]) => [q, a ?? 'none'] as const))('%s (Accept %s)', async (query, accept) => {
		expectSame(`${name} ${query}`, await compareApps('local', id, query, accept === 'none' ? undefined : accept));
	});
});

describe.each(getStorages().filter((s) => s !== 'local'))('derived assets on %s (FR-035)', (storage) => {
	let id: string;

	beforeAll(async () => {
		id = await upload(storage, fixture('photo.jpg'), 'photo.jpg', 'image/jpeg');
	});

	it.each(SHORT.map(([q, a]) => [q, a ?? 'none'] as const))('%s (Accept %s)', async (query, accept) => {
		expectSame(query, await compareApps(storage, id, query, accept === 'none' ? undefined : accept));
	});
});

describe('limits and races (FR-037, R-17)', () => {
	it('a row without or with a wrong size: resize skipped, pre-check 400, sharp pixel limit 500 (FR-037)', async () => {
		const id = await upload('local', fixture('image-huge.png'), 'huge.png', 'image/png');
		const { data: row } = await appRequest('directus', 'GET', `/files/${id}?fields=width,height`);

		// Metadata extraction hits limitInputPixels too, so the row has no size. resolvePreset then drops the resize
		// step (the original is served); a toFormat step reaches the pre-check on the row size.
		const resizeOnly = await compareApps('local', id, 'width=50');
		const withFormat = await compareApps('local', id, 'format=webp');

		await appRequest('directus', 'PATCH', `/files/${id}`, { width: 100, height: 100 });
		const understated = await compareApps('local', id, 'width=50');

		expectSame('resize only', resizeOnly);
		expectSame('with format', withFormat);
		expectSame('pixel limit', understated);

		expect({
			row,
			resizeOnly: [resizeOnly.directus.status, resizeOnly.directus.size],
			withFormat: withFormat.directus.status,
			understated: understated.directus.status,
		}).toEqual({
			row: { width: null, height: null },
			resizeOnly: [200, fixture('image-huge.png').length],
			withFormat: 400,
			understated: 500,
		});
	});

	it('R-17: both apps generate the same new derived asset at once; one object and the same bytes remain', async () => {
		const id = await upload('local', fixture('photo.jpg'), 'race.jpg', 'image/jpeg');
		const query = 'width=333&height=222&fit=cover';

		const [a, b] = await Promise.all(
			(['directus', 'backoffice'] as const).map((app) => generate(app, 'local', id, query)),
		);
		const settled = await generate('directus', 'local', id, query);

		expect(a!.status).toBe(200);
		expect(b!.status).toBe(200);
		expect(settled.derived).toHaveLength(1);
		// Whichever request wrote last, the object holds the full image both apps compute.
		expect(settled.sha).toBe((await compareApps('local', id, query)).directus.sha);
	});
});
