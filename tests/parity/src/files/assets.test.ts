// Feature 007, US1 and US2 (spec FR-030 to FR-041, contracts/assets.md): GET and HEAD /assets/:pk at both apps on
// the same file row, so ETag, Last-Modified and the bytes compare directly (parity()). The transformation part
// (T036) adds query validation, presets and limits; the byte matrix is transform-matrix.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setSettings, urls } from '../auth/fixtures.js';
import { getStorages } from '../config.js';
import { appRequest } from '../directus-api.js';
import { assertParity, capture, parity, type ParityRequest } from '../parity.js';
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

describe('transformation query (US2 scenarios 3 to 7, FR-030)', () => {
	let id: string;
	let pdf: string;

	beforeAll(async () => {
		id = await uploadAt(urls().directus, 'local', 'photo.jpg', fixture('photo.jpg'), 'image/jpeg');
		pdf = await uploadAt(urls().directus, 'local', 'document.pdf', fixture('document.pdf'), 'application/pdf');
	});

	const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

	it('invalid transforms, unknown keys, sharp argument errors: 400 like Directus', async () => {
		const headers = { ...(await admin()), ...real };

		for (const query of [
			'transforms=nope',
			`transforms=${json({ a: 1 })}`,
			`transforms=${json(Array(6).fill(['blur', 1]))}`,
			`transforms=${json([['toFile', 'x']])}`,
			`transforms=${json([['blur', 'not-a-number']])}`,
			'key=unknown',
			'width=abc',
			'fit=nope&width=10&height=10',
		]) {
			assertParity(await parity({ path: `/assets/${id}?${query}`, headers }, { sequential: true }));
		}
	});

	it('format=auto follows Accept and adds it to Vary; a PDF or SVG is served untouched', async () => {
		const auth = await admin();

		for (const accept of ['image/avif,image/webp,image/*,*/*;q=0.8', 'image/webp', '*/*', undefined]) {
			const headers = { ...auth, ...real, ...(accept ? { accept } : {}) };
			assertParity(await parity({ path: `/assets/${id}?format=auto&width=64`, headers }, { sequential: true }));
		}

		assertParity(
			await parity({ path: `/assets/${pdf}?width=10&format=png`, headers: { ...auth, ...real } }, { sequential: true }),
		);
	});

	it('withoutEnlargement=false is on, ?download=false still downloads, query keys outside the list are ignored', async () => {
		const headers = { ...(await admin()), ...real };

		for (const query of [
			'width=4000&withoutEnlargement=false',
			'width=4000&withoutEnlargement=true',
			'download=false',
			'foo=bar&width=20',
		]) {
			assertParity(await parity({ path: `/assets/${id}?${query}`, headers }, { sequential: true }));
		}
	});

	it.each(['all', 'presets', 'none'])(
		'storage_asset_transform=%s with presets, free parameters and transforms=[] (R-16)',
		async (mode) => {
			const restore = await setSettings({
				storage_asset_transform: mode,
				storage_asset_presets: [{ key: 'thumb', width: 40, height: 40, fit: 'cover', quality: 70, format: 'webp' }],
			});

			try {
				const headers = { ...(await admin()), ...real };

				for (const query of [
					'key=thumb',
					'key=thumb&width=10',
					'key=system-small-cover',
					'key=nope',
					'width=12',
					'width=12&transforms=[]',
					'transforms=[]',
				]) {
					assertParity(await parity({ path: `/assets/${id}?${query}`, headers }, { sequential: true }));
				}
			} finally {
				await restore();
			}
		},
	);
});

describe('assets-stress pair: one transformation at a time, 100 ms timeout (FR-037, US2 scenario 6)', () => {
	const pair = () => urls('assets-stress');

	it('busy (503) and timeout (503) at both apps, no partial object left', async () => {
		const id = await uploadAt(urls().directus, 'local', 'huge-ok.png', fixture('image-8bit.png'), 'image/png');
		const headers = await admin();

		for (const app of ['directus', 'backoffice'] as const) {
			const base = pair()[app];
			// Many different new transformations at once with ASSETS_TRANSFORM_MAX_CONCURRENT=1, like the Directus blackbox
			// limit.test.ts: the ones over the limit answer 503 (busy, or the 100 ms timeout). Each app gets its own sizes:
			// the second app would serve the derived assets the first one wrote to the shared storage.
			const statuses = await Promise.all(
				Array.from({ length: 30 }, async (_, n) => {
					const size = (app === 'directus' ? 4000 : 4100) + n;
					const url = new URL(`/assets/${id}?width=${size}&height=${size}`, base);
					return (await fetch(url, { headers })).status;
				}),
			);

			expect(statuses, app).toContain(503);
		}

		// The timeout is clamped to at least one second (100ms → 1 s), so the work must take longer than that. Each app
		// works on its own copy: right after the 503, the aborted write can leave an empty object for a moment (R-17).
		const blur = encodeURIComponent(JSON.stringify([['blur', 80]]));
		const { listObjects } = await import('./storage-capture.js');
		const results: Record<string, unknown> = {};

		for (const app of ['directus', 'backoffice'] as const) {
			const own = await uploadAt(urls().directus, 'local', 'big.jpg', fixture('photo.jpg'), 'image/jpeg');
			const res = await capture(pair()[app], {
				path: `/assets/${own}?width=6000&height=6000&fit=fill&transforms=${blur}`,
				headers,
			});

			let left: string[] = [];

			for (let i = 0; i < 20; i++) {
				left = (await listObjects('local', own)).filter((key) => key.includes('__'));
				if (left.length === 0) break;
				await new Promise((resolve) => setTimeout(resolve, 250));
			}

			results[app] = { status: res.status, body: res.json, left: left.length };
		}

		expect(results['backoffice']).toEqual(results['directus']);
		expect(results['directus']).toMatchObject({ status: 503, left: 0 });
	}, 120_000);

	it('HEAD with a transformation generates the derived asset (FR-032)', async () => {
		const id = await uploadAt(urls().directus, 'local', 'head.jpg', fixture('photo.jpg'), 'image/jpeg');
		const { listObjects, deleteDerived } = await import('./storage-capture.js');

		for (const app of ['directus', 'backoffice'] as const) {
			await deleteDerived('local', id);
			const res = await fetch(new URL(`/assets/${id}?width=77`, urls()[app]), {
				method: 'HEAD',
				headers: await admin(),
			});
			expect(res.status, app).toBe(200);
			expect(
				(await listObjects('local', id)).filter((key) => key.includes('__')),
				app,
			).toHaveLength(1);
		}
	});
});
