// Feature 007, US3 scenario 4 (spec FR-021, FR-041, contracts/assets.md §3): the zip archives of a folder tree and of
// a list of files. The archive bytes hold the time of compression, so each app's archive is unzipped and compared by
// entry path and content; the headers compare through parity() (the date in the file name is normalized).
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APPS, urls } from '../auth/fixtures.js';
import { appRequest } from '../directus-api.js';
import { assertParity, parity } from '../parity.js';
import { admin, fixture, multipart } from './helpers.js';

const run = Math.random().toString(16).slice(2, 8);
const files: string[] = [];
const folders: string[] = [];

async function folder(name: string, parent: string | null): Promise<string> {
	const { data } = await appRequest('directus', 'POST', '/folders', { name, parent });
	folders.push(data.id);
	return data.id;
}

async function upload(folderId: string, filename: string, data: Buffer, type = 'image/jpeg'): Promise<string> {
	const { body, headers } = multipart([
		{ name: 'folder', value: folderId },
		{ name: 'filename_download', value: filename },
		{ name: 'file', data, filename, contentType: type },
	]);

	const res = await fetch(new URL('/files', urls().directus), {
		method: 'POST',
		headers: { ...(await admin()), ...headers },
		body,
	});
	const id = ((await res.json()) as { data: { id: string } }).data.id;
	files.push(id);
	return id;
}

/** Entry path → sha256 of the archive one app sends. */
async function entries(app: (typeof APPS)[number], method: string, path: string, body?: unknown) {
	const res = await fetch(new URL(path, urls()[app]), {
		method,
		headers: { ...(await admin()), ...(body ? { 'content-type': 'application/json' } : {}) },
		...(body ? { body: JSON.stringify(body) } : {}),
	});

	expect(res.status, `${app} ${path}`).toBe(200);
	const unzipped = unzipSync(new Uint8Array(await res.arrayBuffer()));

	return Object.fromEntries(
		Object.entries(unzipped)
			.map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex').slice(0, 16)] as const)
			.sort(([a], [b]) => a.localeCompare(b)),
	);
}

let root: string;
let sub: string;
let other: string;
const ids: string[] = [];

beforeAll(async () => {
	root = await folder(`zip-${run}`, null);
	sub = await folder('photos', root);
	other = await folder('other', null);

	ids.push(await upload(root, 'dup.jpg', fixture('photo.jpg')));
	ids.push(await upload(root, 'dup.jpg', fixture('photo-rotated.jpg')));
	ids.push(await upload(root, 'photos', fixture('document.pdf'), 'application/pdf'));
	ids.push(await upload(sub, 'inner.png', fixture('image-8bit.png'), 'image/png'));
	ids.push(await upload(other, 'dup.jpg', fixture('photo-cmyk.jpg')));
});

afterAll(async () => {
	if (files.length) await appRequest('directus', 'DELETE', '/files', files.splice(0)).catch(() => undefined);
	for (const id of folders.splice(0).reverse())
		await appRequest('directus', 'DELETE', `/folders/${id}`).catch(() => undefined);
});

describe('zip archives (US3 scenario 4)', () => {
	it('POST /assets/folder/:pk: same entries and contents at both apps, names deduplicated like Directus', async () => {
		const [directus, backoffice] = await Promise.all(APPS.map((app) => entries(app, 'POST', `/assets/folder/${root}`)));

		expect(backoffice).toEqual(directus);
		// Spec FR-041 (measured on Directus): entries under the root folder name; two files of one folder get ` (1)` after
		// the extension; a file and a sub folder of the same name are deduplicated apart (both `photos`).
		expect(Object.keys(directus!)).toEqual([
			`zip-${run}/`,
			`zip-${run}/dup.jpg`,
			`zip-${run}/dup.jpg (1)`,
			`zip-${run}/photos`,
			`zip-${run}/photos/`,
			`zip-${run}/photos/inner.png`,
		]);
	});

	it('POST /assets/files: same entries, files of two folders with the same name both at the root', async () => {
		const body = { ids: [ids[0], ids[4]] };
		const [directus, backoffice] = await Promise.all(APPS.map((app) => entries(app, 'POST', '/assets/files', body)));

		expect(backoffice).toEqual(directus);
	});

	it('headers, errors of the body, an unknown folder and the public role', async () => {
		const headers = await admin();
		const binary = (captured: any) => ({ ...captured, bytes: Buffer.from('<zip>'), text: '<zip>' });

		assertParity(await parity({ method: 'POST', path: `/assets/folder/${root}`, headers, normalize: binary }));
		assertParity(
			await parity({ method: 'POST', path: '/assets/files', headers, body: { ids: [ids[3]] }, normalize: binary }),
		);

		for (const body of [{}, { ids: [] }, { ids: ['not-a-uuid'] }, { ids: 'x' }]) {
			assertParity(await parity({ method: 'POST', path: '/assets/files', headers, body }));
		}

		assertParity(
			await parity({ method: 'POST', path: '/assets/folder/00000000-0000-4000-8000-000000000000', headers }),
		);
		assertParity(await parity({ method: 'POST', path: `/assets/folder/${root}` }));
		assertParity(await parity({ method: 'POST', path: '/assets/files', body: { ids: [ids[0]] } }));
	});
});
