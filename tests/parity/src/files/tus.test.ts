// Feature 007, US4 (spec FR-015, FR-050 to FR-054, R-18, contracts/tus-storage.md): resumable uploads on the
// assets-limit pair (TUS on, Redis lock and clock), the time-dependent expiration on assets-stress, OPTIONS with CORS
// on the cors-hsts pair, and the main pair with TUS off. An upload started at one app continues at the other.
import { createHash } from 'node:crypto';
import http from 'node:http';
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { type App, urls } from '../auth/fixtures.js';
import { getStorages, type StorageLocation } from '../config.js';
import { appRequest } from '../directus-api.js';
import { assertParity, parity } from '../parity.js';
import { createUser } from '../permissions/fixtures.js';
import { closeRedis, redis } from '../redis.js';
import { admin, fixture } from './helpers.js';
import { captureObjects, fileRows, listObjects } from './storage-capture.js';

const run = Math.random().toString(16).slice(2, 8);
const CHUNK = 8 * 1024 * 1024; // TUS_CHUNK_SIZE default (8mb)
const created: string[] = [];

afterAll(async () => {
	const ids = created.splice(0);
	if (ids.length) await appRequest('directus', 'DELETE', '/files', ids).catch(() => undefined);
	await closeHostDb();
	await closeRedis();
}, 120_000);

const b64 = (value: string) => Buffer.from(value).toString('base64');
const metadata = (values: Record<string, string>) =>
	Object.entries(values)
		.map(([k, v]) => `${k} ${b64(v)}`)
		.join(',');

interface TusResponse {
	status: number;
	headers: Record<string, string>;
	body: string;
}

/** A raw TUS request (node:http: HEAD and PATCH bodies the way tus-js-client sends them). */
function tus(base: string, method: string, path: string, headers: Record<string, string>, body?: Buffer) {
	return new Promise<TusResponse>((resolve, reject) => {
		const req = http.request(
			new URL(path, base),
			{
				method,
				headers: { 'tus-resumable': '1.0.0', ...headers, ...(body ? { 'content-length': String(body.length) } : {}) },
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (c: Buffer) => chunks.push(c));
				res.on('end', () =>
					resolve({
						status: res.statusCode ?? 0,
						headers: Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, String(v)])),
						body: Buffer.concat(chunks).toString('utf8'),
					}),
				);
			},
		);

		req.on('error', reject);
		if (body) req.write(body);
		req.end();
	});
}

const pair = () => urls('assets-limit');

async function create(app: App, length: number, meta: Record<string, string>, base = pair()[app]) {
	const res = await tus(base, 'POST', '/files/tus', {
		...(await admin()),
		'upload-length': String(length),
		'upload-metadata': metadata(meta),
	});

	return { res, id: res.headers['location']?.split('/').pop() ?? '' };
}

async function patch(app: App, tusId: string, offset: number, chunk: Buffer, base = pair()[app]) {
	return tus(
		base,
		'PATCH',
		`/files/tus/${tusId}`,
		{ ...(await admin()), 'upload-offset': String(offset), 'content-type': 'application/offset+octet-stream' },
		chunk,
	);
}

/** 20 MB of bytes that do not compress, so the S3 parts have their real size. */
function payload(size: number): Buffer {
	const out = Buffer.alloc(size);
	for (let i = 0; i < size; i += 32) createHash('sha256').update(String(i)).digest().copy(out, i);
	return out;
}

/** TUS writes to the first location of STORAGE_LOCATIONS (FR-052): local on assets-limit, s3 on cors-hsts. */
const TUS_PAIRS = (
	[
		['local', 'assets-limit'],
		['s3', 'cors-hsts'],
	] as const
).filter(([storage]) => getStorages().includes(storage));

describe.each(TUS_PAIRS)('upload across both apps on %s (US4 scenarios 1, 2)', (storage, profile) => {
	const pairOf = () => urls(profile);

	it.each([
		['directus', 'backoffice'],
		['backoffice', 'directus'],
	] as const)(
		'created at %s, chunks alternate, finished at the other app',
		async (first, second) => {
			const data = payload(20 * 1024 * 1024);
			const { res, id } = await create(
				first,
				data.length,
				{ filename_download: `big-${run}.bin`, type: 'application/octet-stream' },
				pairOf()[first],
			);

			expect(res.status, 'create').toBe(201);
			expect(res.headers['location']).toMatch(new RegExp(`^http://localhost:8155/files/tus/${id}$`));

			const row = await hostDb()('directus_files').where({ tus_id: id }).first();
			created.push(row.id);

			// In progress: hidden from /files, 403 on /files/:pk and /assets/:pk at both apps (FR-015).
			for (const app of [first, second]) {
				const list = await appRequest(app, 'GET', `/files?filter[id][_eq]=${row.id}`, undefined, pairOf()[app]);
				expect(list.data, `${app} list`).toEqual([]);
				const one = await fetch(new URL(`/files/${row.id}`, pairOf()[app]), { headers: await admin() });
				expect(one.status, `${app} /files/:pk`).toBe(403);
				const asset = await fetch(new URL(`/assets/${row.id}`, pairOf()[app]), { headers: await admin() });
				expect(asset.status, `${app} /assets/:pk`).toBe(403);
			}

			let offset = 0;
			let turn = 0;
			let last: TusResponse | undefined;

			while (offset < data.length) {
				const app = turn++ % 2 === 0 ? second : first;
				const head = await tus(pairOf()[app], 'HEAD', `/files/tus/${id}`, await admin());
				expect(Number(head.headers['upload-offset']), `${app} HEAD`).toBe(offset);

				last = await patch(app, id, offset, data.subarray(offset, offset + CHUNK), pairOf()[app]);
				expect(last.status, `${app} PATCH`).toBe(204);
				offset = Number(last.headers['upload-offset']);
			}

			expect(last!.headers['directus-file-id']).toBe(row.id);

			const [done] = await fileRows(hostDb(), [row.id]);
			expect(done).toMatchObject({ storage, filesize: data.length, filename_disk: '<id>.bin' });
			expect(done).not.toHaveProperty('tus_id');

			const [object] = await captureObjects(storage as StorageLocation, row.id);
			expect(object!.sha256).toBe(createHash('sha256').update(data).digest('hex'));
		},
		300_000,
	);
});

describe('protocol at both apps (US4 scenario 3, FR-050, FR-051)', () => {
	it('the same answers to errors, foreign uploads and OPTIONS', async () => {
		const results: Record<App, unknown> = {} as never;

		for (const app of ['directus', 'backoffice'] as const) {
			const base = pair()[app];
			const auth = await admin();
			const tooLarge = await tus(base, 'POST', '/files/tus', {
				...auth,
				'upload-length': String(31 * 1024 * 1024),
				'upload-metadata': metadata({ filename_download: 'big.bin' }),
			});
			const noName = await tus(base, 'POST', '/files/tus', {
				...auth,
				'upload-length': '10',
				'upload-metadata': metadata({ type: 'x/y' }),
			});
			const badMeta = await tus(base, 'POST', '/files/tus', {
				...auth,
				'upload-length': '10',
				'upload-metadata': 'a b c',
			});

			const { id } = await create(app, 10, { filename_download: 'small.txt' });
			const row = await hostDb()('directus_files').where({ tus_id: id }).first();
			created.push(row.id);

			const user = await createUser('directus', `tus-other-${run}-${app}`);
			const foreign = await tus(base, 'HEAD', `/files/tus/${id}`, { authorization: `Bearer ${user.token}` });
			const replaceBusy = await tus(base, 'POST', '/files/tus', {
				...auth,
				'upload-length': '10',
				'upload-metadata': metadata({ filename_download: 'r.txt', id: row.id }),
			});
			const options = await tus(base, 'OPTIONS', `/files/tus/${id}`, auth);
			const offsetMismatch = await patch(app, id, 5, Buffer.from('abc'));

			const pick = (r: TusResponse) => ({
				status: r.status,
				body: r.body.replace(id, '<id>'),
				tus: Object.fromEntries(
					Object.entries(r.headers).filter(([k]) => k.startsWith('tus-') || k === 'upload-offset'),
				),
			});

			results[app] = {
				tooLarge: pick(tooLarge),
				noName: pick(noName),
				badMeta: pick(badMeta),
				foreign: pick(foreign),
				replaceBusy: pick(replaceBusy),
				options: pick(options),
				offsetMismatch: pick(offsetMismatch),
			};
		}

		expect(results.backoffice).toEqual(results.directus);
		expect(results.directus).toMatchObject({
			tooLarge: { status: 413 },
			noName: { status: 400 },
			options: { status: 204 },
		});
	}, 120_000);

	it('OPTIONS with CORS on (cors-hsts pair) and the collection path with CORS off', async () => {
		for (const path of ['/files/tus', '/files/tus/abc']) {
			assertParity(
				await parity(
					{ method: 'OPTIONS', path },
					{ directusUrl: urls('cors-hsts').directus, backofficeUrl: urls('cors-hsts').backoffice },
				),
			);
			assertParity(
				await parity({ method: 'OPTIONS', path }, { directusUrl: pair().directus, backofficeUrl: pair().backoffice }),
			);
		}
	});

	it('TUS off on the main pair: the requests fall to /files like Directus', async () => {
		const headers = await admin();
		assertParity(await parity({ method: 'POST', path: '/files/tus', headers }));
		assertParity(await parity({ method: 'PATCH', path: '/files/tus/abc', headers, body: { title: 'x' } }));
		assertParity(await parity({ method: 'OPTIONS', path: '/files/tus/abc' }));
	});
});

describe('replace, delete in progress, lock (FR-012, FR-015, FR-053)', () => {
	it('replace_id: the target keeps its row and extension, old objects and derived assets go away', async () => {
		const results: Record<string, unknown> = {};

		for (const app of ['directus', 'backoffice'] as const) {
			const form = new FormData();
			form.set('file', new Blob([fixture('photo.jpg')], { type: 'image/jpeg' }), 'photo.jpg');
			const res = await fetch(new URL('/files', pair()[app]), { method: 'POST', headers: await admin(), body: form });
			const target = ((await res.json()) as { data: { id: string } }).data.id;
			created.push(target);
			await (await fetch(new URL(`/assets/${target}?width=20`, pair()[app]), { headers: await admin() })).arrayBuffer();

			const png = fixture('image-8bit.png');
			const { id } = await create(app, png.length, { filename_download: 'new.png', type: 'image/png', id: target });
			const done = await patch(app, id, 0, png);

			const [row] = await fileRows(hostDb(), [target]);
			const objects = (await listObjects('local', target)).map((k) => k.replace(target, '<id>'));
			const temp = await hostDb()('directus_files').where({ tus_id: id }).count({ n: '*' });

			results[app] = {
				status: done.status,
				fileId: done.headers['directus-file-id'] === target,
				row: {
					filename_disk: row!['filename_disk'],
					filename_download: row!['filename_download'],
					type: row!['type'],
					filesize: row!['filesize'],
				},
				objects,
				temp: Number(temp[0]!['n']),
			};
		}

		expect(results['backoffice']).toEqual(results['directus']);
		// Spec Edge Cases: the target keeps `.jpg` although the type is image/png now (unlike uploadOne).
		expect(results['directus']).toMatchObject({
			row: { filename_disk: '<id>.jpg', type: 'image/png' },
			objects: ['<id>.jpg'],
		});
	}, 120_000);

	it('DELETE /files/:id of an upload in progress (FR-015): the row goes, the partial object stays', async () => {
		const results: Record<string, unknown> = {};

		for (const app of ['directus', 'backoffice'] as const) {
			const { id } = await create(app, 100, { filename_download: `partial-${run}.txt` });
			await patch(app, id, 0, Buffer.alloc(40, 1));
			const row = await hostDb()('directus_files').where({ tus_id: id }).first();

			const res = await fetch(new URL(`/files/${row.id}`, pair()[app]), { method: 'DELETE', headers: await admin() });
			const left = await hostDb()('directus_files').where({ id: row.id }).count({ n: '*' });
			results[app] = {
				status: res.status,
				rows: Number(left[0]!['n']),
				objects: (await listObjects('local', row.id)).length,
			};
			if (Number(left[0]!['n'])) created.push(row.id);
		}

		expect(results['backoffice']).toEqual(results['directus']);
		// Measured on Directus 11.17.4 (T040): deleteMany does not see the row (tus_id filter), the object stays.
		expect(results['directus']).toEqual({ status: 204, rows: 0, objects: 1 });
	});

	it('the lock of an upload is the same Redis key at both apps', async () => {
		const { id } = await create('directus', 2 * CHUNK, { filename_download: `lock-${run}.bin` });
		const row = await hostDb()('directus_files').where({ tus_id: id }).first();
		created.push(row.id);

		// A PATCH that sends half its body, then waits: the lock is held meanwhile.
		const req = http.request(new URL(`/files/tus/${id}`, pair().backoffice), {
			method: 'PATCH',
			headers: {
				...(await admin()),
				'tus-resumable': '1.0.0',
				'upload-offset': '0',
				'content-type': 'application/offset+octet-stream',
				'content-length': String(CHUNK),
			},
		});

		const done = new Promise<number>((resolve) =>
			req.on('response', (res) => (res.resume(), resolve(res.statusCode ?? 0))),
		);
		req.write(Buffer.alloc(CHUNK / 2, 2));

		let keys: string[] = [];

		for (let i = 0; i < 40 && keys.length === 0; i++) {
			await new Promise((resolve) => setTimeout(resolve, 100));
			keys = (await redis().keys(`*${id}*`)).filter((key) => !key.includes('cache'));
		}

		req.end(Buffer.alloc(CHUNK / 2, 2));
		expect(await done).toBe(204);
		// useLock(): the Redis kv of namespace REDIS_LOCK_NAMESPACE (default directus:lock), key = upload id.
		expect(keys).toHaveLength(1);
		expect(keys[0]).toMatch(new RegExp(`^directus:lock.*${id}$`));
	}, 60_000);
});

describe('S3 parts (R-18)', () => {
	it.runIf(getStorages().includes('s3'))('a PATCH smaller than a part is dropped on S3 at both apps', async () => {
		// The cors-hsts pair writes TUS uploads to MinIO (STORAGE_LOCATIONS=s3,local).
		const results: Record<string, unknown> = {};
		const s3 = urls('cors-hsts');

		for (const app of ['directus', 'backoffice'] as const) {
			const { id, res } = await create(app, 20 * 1024 * 1024, { filename_download: `r18-${run}.bin` }, s3[app]);
			const row = await hostDb()('directus_files').where({ tus_id: id }).first();
			created.push(row.id);
			const small = await patch(app, id, 0, Buffer.alloc(3 * 1024 * 1024, 3), s3[app]);
			results[app] = {
				create: res.status,
				status: small.status,
				offset: small.headers['upload-offset'],
				storage: row.storage,
			};
		}

		expect(results['backoffice']).toEqual(results['directus']);
		expect(results['directus']).toMatchObject({ create: 201, status: 204, offset: '0', storage: 's3' });
	});
});

describe('expiration on the assets-stress pair (US4 scenario 4, FR-054)', () => {
	it('incomplete uploads older than TUS_UPLOAD_EXPIRATION are removed by the synchronized cleanup', async () => {
		const stress = urls('assets-stress');
		const ids: Record<string, string> = {};

		for (const app of ['directus', 'backoffice'] as const) {
			const { id } = await create(app, 100, { filename_download: `expire-${run}-${app}.txt` }, stress[app]);
			await patch(app, id, 0, Buffer.alloc(10, 1), stress[app]);
			ids[app] = (await hostDb()('directus_files').where({ tus_id: id }).first()).id;
		}

		let left = 2;

		for (let i = 0; i < 90 && left > 0; i++) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			left = Number((await hostDb()('directus_files').whereIn('id', Object.values(ids)).count({ n: '*' }))[0]!['n']);
		}

		expect(left).toBe(0);
		expect(await redis().keys('directus-sync:clock:tus-cleanup:*')).not.toEqual([]);
	}, 120_000);
});
