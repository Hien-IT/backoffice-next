// Ported from directus/tests/e2e/tests/endpoints/files/files.test.ts
// Backoffice (research R7 of spec 007): the repo has no harness of directus/tests/e2e; the assertions run unchanged
// against each app (the SDK calls become fetch), on `local` and, like `options.extras.minio`, on the `s3` location.
// The fixture is tests/parity/fixtures/assets/files-image.jpg (directus/tests/e2e/tests/endpoints/files/image.jpg).
import { createHash } from 'crypto';
import { describe, expect, test } from 'vitest';
import { APPS, urls } from '../auth/fixtures.js';
import { getStorages } from '../config.js';
import { admin, assetFixture } from './helpers.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

async function api(app: (typeof APPS)[number], method: string, path: string, body?: FormData) {
	const res = await fetch(new URL(path, urls()[app]), { method, headers: await admin(), ...(body ? { body } : {}) });
	return res;
}

async function uploadFiles(app: (typeof APPS)[number], form: FormData) {
	const res = await api(app, 'POST', '/files', form);
	if (!res.ok) throw new Error(`upload: ${res.status}`);
	return ((await res.json()) as { data: Record<string, any> }).data;
}

describe.each(APPS)('%s', (app) => {
	describe.each(getStorages())('storage %s', (storage) => {
		test('upload a file', async () => {
			const file = assetFixture('files-image.jpg');
			const blob = new Blob([file], { type: 'image/jpg' });
			const form = new FormData();
			// Storage needs to be set before file, otherwise it defaults to the first option of env.STORAGE_LOCATIONS
			// TODO: Look into documenting this behavior
			form.set('storage', storage);
			form.set('file', blob, 'image.jpg');

			const upload = await uploadFiles(app, form);
			const read = await (await api(app, 'GET', `/assets/${upload['id']}`)).arrayBuffer();

			const originalHash = createHash('sha256').update(file).digest('hex');
			const uploadHash = createHash('sha256').update(Buffer.from(read)).digest('hex');

			expect(originalHash).toEqual(uploadHash);

			const fileInfo = ((await (await api(app, 'GET', `/files/${upload['id']}`)).json()) as any).data;

			expect(fileInfo).toMatchObject({
				filename_disk: expect.toSatisfy((value: string) => UUID.test(value.toLowerCase())),
				filename_download: 'image.jpg',
				filesize: expect.toSatisfy((val) => String(val) === '41274'),
				id: upload['id'],
				storage,
				title: 'Image',
				type: 'image/jpg',
			});

			await api(app, 'DELETE', `/files/${upload['id']}`);
		});

		test('delete a file', async () => {
			const file = assetFixture('files-image.jpg');
			const blob = new Blob([file], { type: 'image/jpg' });
			const form = new FormData();
			form.set('storage', storage);
			form.set('file', blob, 'image.jpg');

			const upload = await uploadFiles(app, form);

			expect((await api(app, 'DELETE', `/files/${upload['id']}`)).status).toBe(204);
			expect((await api(app, 'GET', `/files/${upload['id']}`)).ok).toBe(false);
		});
	});
});
