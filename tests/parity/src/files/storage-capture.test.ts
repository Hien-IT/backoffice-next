// Feature 007 (T019, contracts/parity.md §2): the storage capture reads the same objects and rows on both storage
// locations, so the parity files can compare what each app leaves behind.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getStorages, knexConfig } from '../config.js';
import { adminToken, appUrl, directusRequest } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { captureObjects, deleteDerived, deleteObjects, fileRows, listObjects } from './storage-capture.js';

const photo = readFileSync(new URL('../../fixtures/files/photo.jpg', import.meta.url));
const photoSha = createHash('sha256').update(photo).digest('hex');

async function upload(storage: string): Promise<string> {
	const form = new FormData();
	form.append('storage', storage);
	form.append('file', new Blob([photo], { type: 'image/jpeg' }), 'photo.jpg');
	return (await directusRequest('POST', '/files', form)).data.id;
}

describe.each(getStorages())('storage capture on %s (feature 007)', (storage) => {
	const [vendor] = getDbsToTest();
	let db: Knex;
	let id: string;

	beforeAll(async () => {
		db = knex(knexConfig[vendor!]);
		id = await upload(storage);
	});

	afterAll(async () => {
		await directusRequest('DELETE', `/files/${id}`).catch(() => undefined);
		await db.destroy();
	});

	it('lists and digests the uploaded object', async () => {
		const objects = await captureObjects(storage, id);

		expect(objects).toEqual([expect.objectContaining({ key: `${id}.jpg`, size: photo.length, sha256: photoSha })]);

		if (storage === 's3') expect(objects[0]!.contentType).toBe('image/jpeg');
	});

	it('reads the row without volatile columns and with <id> in filename_disk', async () => {
		const [row] = await fileRows(db, [id]);

		expect(row).toMatchObject({
			storage,
			filename_disk: '<id>.jpg',
			filename_download: 'photo.jpg',
			type: 'image/jpeg',
			filesize: photo.length,
			width: 640,
			height: 480,
			metadata: { ifd0: { Make: 'Backoffice', Model: 'Parity Fixture 1' } },
		});

		expect(row).not.toHaveProperty('id');
		expect(row).not.toHaveProperty('uploaded_on');
	});

	it('deletes only the derived assets', async () => {
		const res = await fetch(new URL(`/assets/${id}?width=40`, appUrl('directus')), {
			headers: { authorization: `Bearer ${await adminToken('directus')}` },
		});

		expect(res.status).toBe(200);
		await res.arrayBuffer();

		const before = await listObjects(storage, id);
		expect(before).toHaveLength(2);
		expect(before.filter((key) => key.includes('__'))).toHaveLength(1);

		expect(await deleteDerived(storage, id)).toHaveLength(1);
		expect(await listObjects(storage, id)).toEqual([`${id}.jpg`]);
	});

	it('deleteObjects ignores an empty list', async () => {
		await deleteObjects(storage, []);
		expect(await listObjects(storage, id)).toEqual([`${id}.jpg`]);
	});
});
