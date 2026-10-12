// Feature 007, US1 (spec SC-003, FR-082): a file written by one app is read, downloaded, replaced and deleted by the
// other, in both directions and on each storage location of PARITY_STORAGES. T045 adds URL import and US4 TUS.
import { createHash } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { type App, APPS, urls } from '../auth/fixtures.js';
import { getStorages } from '../config.js';
import { appRequest } from '../directus-api.js';
import { admin, fixture, multipart } from './helpers.js';
import { listObjects } from './storage-capture.js';

const sha = (bytes: Buffer | ArrayBuffer) =>
	createHash('sha256')
		.update(Buffer.from(bytes as ArrayBuffer))
		.digest('hex');

const created: string[] = [];

afterAll(async () => {
	const ids = created.splice(0);
	if (ids.length) await appRequest('directus', 'DELETE', '/files', ids).catch(() => undefined);
});

async function request(
	app: App,
	method: string,
	path: string,
	init: { body?: Buffer | string; headers?: object } = {},
) {
	return fetch(new URL(path, urls()[app]), {
		method,
		...init,
		headers: { ...(await admin()), ...init.headers } as Record<string, string>,
	});
}

async function upload(app: App, storage: string, data: Buffer, filename: string, type: string, path = '/files') {
	const { body, headers } = multipart([
		{ name: 'storage', value: storage },
		{ name: 'file', data, filename, contentType: type },
	]);

	const res = await request(app, path === '/files' ? 'POST' : 'PATCH', path, { body, headers });
	expect(res.status, `${app} upload`).toBe(200);
	return ((await res.json()) as { data: Record<string, any> }).data;
}

const other = (app: App): App => (app === 'directus' ? 'backoffice' : 'directus');

describe.each(getStorages())('cross use on %s (SC-003)', (storage) => {
	it.each(APPS)('multipart at %s: the other app reads, downloads, replaces and deletes it', async (writer) => {
		const reader = other(writer);
		const photo = fixture('photo.jpg');
		const written = await upload(writer, storage, photo, 'photo.jpg', 'image/jpeg');
		created.push(written['id']);

		const read = (await (await request(reader, 'GET', `/files/${written['id']}`)).json()) as { data: unknown };
		expect(read.data).toEqual(written);

		const download = await request(reader, 'GET', `/assets/${written['id']}?download`);
		expect(download.status).toBe(200);
		expect(sha(await download.arrayBuffer())).toBe(sha(photo));

		const png = fixture('image-8bit.png');
		const replaced = await upload(reader, storage, png, 'new.png', 'image/png', `/files/${written['id']}`);
		expect(replaced['filename_disk']).toBe(`${written['id']}.png`);

		const back = await request(writer, 'GET', `/assets/${written['id']}`);
		expect(back.headers.get('content-type')).toBe('image/png');
		expect(sha(await back.arrayBuffer())).toBe(sha(png));
		expect(await listObjects(storage, written['id'])).toEqual([`${written['id']}.png`]);

		expect((await request(reader, 'DELETE', `/files/${written['id']}`)).status).toBe(204);
		expect((await request(writer, 'GET', `/assets/${written['id']}`)).status).toBe(403);
		expect(await listObjects(storage, written['id'])).toEqual([]);
	});

	it.each(APPS)('JSON row at %s: the other app reads and updates it', async (writer) => {
		const reader = other(writer);

		const res = await request(writer, 'POST', '/files', {
			body: JSON.stringify({ type: 'text/plain', storage, filename_download: 'note.txt', title: 'Note' }),
			headers: { 'content-type': 'application/json' },
		});

		const { data } = (await res.json()) as { data: Record<string, any> };
		created.push(data['id']);

		const patched = await request(reader, 'PATCH', `/files/${data['id']}`, {
			body: JSON.stringify({ title: 'Changed' }),
			headers: { 'content-type': 'application/json' },
		});

		expect(((await patched.json()) as any).data.title).toBe('Changed');
		expect(((await (await request(writer, 'GET', `/files/${data['id']}`)).json()) as any).data.title).toBe('Changed');
	});
});
