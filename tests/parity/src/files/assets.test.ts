// Feature 007, US1 and US2 (spec FR-030 to FR-041, contracts/assets.md): GET and HEAD /assets/:pk at both apps on
// the same file row, so ETag, Last-Modified and the bytes compare directly (parity()). The transformation part
// (T036) adds query validation, presets and limits; the byte matrix is transform-matrix.test.ts.
import { afterAll, beforeAll, describe, it } from 'vitest';
import { setSettings, urls } from '../auth/fixtures.js';
import { getStorages } from '../config.js';
import { appRequest } from '../directus-api.js';
import { assertParity, parity, type ParityRequest } from '../parity.js';
import { admin, fixture, multipart } from './helpers.js';
import { deleteObjects } from './storage-capture.js';

const created: string[] = [];

/** Uploads through Directus and returns the id (both apps then read the same row and object). */
async function uploadAt(baseUrl: string, storage: string, name: string, data: Buffer, type: string): Promise<string> {
	const { body, headers } = multipart([
		{ name: 'storage', value: storage },
		{ name: 'file', data, filename: name, contentType: type },
	]);

	const res = await fetch(new URL('/files', baseUrl), {
		method: 'POST',
		headers: { ...(await admin()), ...headers },
		body,
	});
	if (!res.ok) throw new Error(`upload ${name}: ${res.status} ${await res.text()}`);
	const id = ((await res.json()) as { data: { id: string } }).data.id;
	created.push(id);
	return id;
}

afterAll(async () => {
	const ids = created.splice(0);
	if (ids.length) await appRequest('directus', 'DELETE', '/files', ids).catch(() => undefined);
}, 120_000);

/** Asset requests compare the real Cache-Control: parity() sends `no-store` unless a request sets its own. */
const real = { 'cache-control': 'max-age=0' };

describe.each(getStorages())('GET /assets/:pk without transformation on %s (US1 scenario 3)', (storage) => {
	let id: string;

	beforeAll(async () => {
		id = await uploadAt(urls().directus, storage, 'photo.jpg', fixture('photo.jpg'), 'image/jpeg');
	});

	it('inline, download, a file name, HEAD: same bytes and headers', async () => {
		const headers = { ...(await admin()), ...real };

		const requests: ParityRequest[] = [
			{ path: `/assets/${id}`, headers },
			{ path: `/assets/${id}?download`, headers },
			{ path: `/assets/${id}?download=false`, headers },
			{ path: `/assets/${id}/renamed.jpg`, headers },
			{ path: `/assets/${id}.jpg`, headers },
			{ method: 'HEAD', path: `/assets/${id}`, headers },
		];

		for (const req of requests) assertParity(await parity(req));
	});

	it('Range: start-end, suffix, open end; 416 for each invalid range', async () => {
		const auth = await admin();

		for (const range of [
			'bytes=0-99',
			'bytes=-50',
			'bytes=100-',
			'bytes=5-2',
			'bytes=900000-',
			'bytes=-0',
			'bytes=x',
		]) {
			assertParity(await parity({ path: `/assets/${id}`, headers: { ...auth, ...real, range } }));
		}
	});

	it('public role without read access: 403; not a uuid: 403', async () => {
		assertParity(await parity({ path: `/assets/${id}`, headers: real }));
		assertParity(await parity({ path: '/assets/not-a-uuid', headers: { ...(await admin()), ...real } }));
		assertParity(await parity({ path: '/assets/00000000-0000-4000-8000-000000000000', headers: await admin() }));
	});
});

describe('public files of the settings, missing objects, CSP (US1 scenario 7, Edge Cases)', () => {
	let logo: string;
	let orphan: string;
	let restore: () => Promise<void>;

	beforeAll(async () => {
		logo = await uploadAt(urls().directus, 'local', 'logo.png', fixture('image-8bit.png'), 'image/png');
		orphan = await uploadAt(urls().directus, 'local', 'orphan.jpg', fixture('photo.jpg'), 'image/jpeg');
		await deleteObjects('local', [`${orphan}.jpg`]);
		restore = await setSettings({ project_logo: logo });
	});

	afterAll(async () => {
		await restore?.();
	});

	it('the project logo is served to the public role: public Cache-Control', async () => {
		assertParity(await parity({ path: `/assets/${logo}`, headers: real }));
		assertParity(await parity({ path: `/assets/${logo}?download`, headers: real }));
	});

	it('a row whose object is gone: 403', async () => {
		assertParity(await parity({ path: `/assets/${orphan}`, headers: await admin() }));
	});

	it('OPTIONS of the asset routes', async () => {
		for (const path of [
			`/assets/${logo}`,
			`/assets/${logo}/a.png`,
			'/assets/folder',
			`/assets/folder/${logo}`,
			'/assets/files',
		]) {
			assertParity(await parity({ method: 'OPTIONS', path }));
		}
	});
});

describe('assets-limit pair: ASSETS_CACHE_REVALIDATE (FR-033)', () => {
	const pair = () => ({ directusUrl: urls('assets-limit').directus, backofficeUrl: urls('assets-limit').backoffice });
	let id: string;
	let etag: string;
	let lastModified: string;

	beforeAll(async () => {
		id = await uploadAt(urls().directus, 'local', 'photo.jpg', fixture('photo.jpg'), 'image/jpeg');
		const res = await fetch(new URL(`/assets/${id}`, urls('assets-limit').directus), { headers: await admin() });
		etag = res.headers.get('etag')!;
		lastModified = res.headers.get('last-modified')!;
		await res.arrayBuffer();
	});

	it('304 for a matching If-None-Match or If-Modified-Since, 200 otherwise; max-age=0, must-revalidate', async () => {
		const auth = await admin();

		for (const conditional of [
			{ 'if-none-match': etag },
			{ 'if-modified-since': lastModified },
			{ 'if-none-match': '"1"' },
			{ 'if-modified-since': 'Thu, 01 Jan 1970 00:00:00 GMT' },
			{},
		]) {
			assertParity(await parity({ path: `/assets/${id}`, headers: { ...auth, ...real, ...conditional } }, pair()));
		}
	});

	it('the public role is checked before the 304', async () => {
		assertParity(await parity({ path: `/assets/${id}`, headers: { ...real, 'if-none-match': etag } }, pair()));
	});
});
