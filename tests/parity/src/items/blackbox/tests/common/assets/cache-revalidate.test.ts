// Ported from directus/tests/blackbox/tests/common/assets/cache-revalidate.test.ts
// Backoffice (T048): the two nodes the original spawns are the assets-limit pair (ASSETS_CACHE_REVALIDATE=true) and the
// assets-stress pair (ASSETS_CACHE_TTL=1h), both read env/profile-blackbox.env; the env names the node by URL.
import { createReadStream } from 'node:fs';
import { join } from 'path';
import config, { type Env, getStorages, getUrl, hasProfile, nodeUrl, paths } from '@common/config';
import vendors, { type Vendor } from '@common/get-dbs-to-test';
import { USER } from '@common/variables';
import { cloneDeep } from 'lodash-es';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const assetsDirectory = [paths.cwd, 'assets'];
// Backoffice: `local` and `s3` of the parity env (PARITY_STORAGES), `minio` is `s3` (T048).
const storages = getStorages();

const imageFile = {
	name: 'directus.png',
};

const replacementFile = {
	name: 'directus.avif',
};

const imageFilePath = join(...assetsDirectory, imageFile.name);
const replacementFilePath = join(...assetsDirectory, replacementFile.name);

describe.skipIf(!hasProfile('assets-limit') || !hasProfile('assets-stress'))('/assets cache control', () => {
	const envs = {} as Record<Vendor, { envRevalidate: Env; envDefault: Env }>;

	beforeAll(async () => {
		for (const vendor of vendors) {
			const envRevalidate = cloneDeep(config.envs);
			envRevalidate[vendor]['ASSETS_CACHE_REVALIDATE'] = 'true';
			envRevalidate[vendor]['URL'] = nodeUrl('assets-limit', 1);

			const envDefault = cloneDeep(config.envs);
			envDefault[vendor]['ASSETS_CACHE_TTL'] = '1h';
			envDefault[vendor]['URL'] = nodeUrl('assets-stress', 1);

			envs[vendor] = { envRevalidate, envDefault };
		}
	});

	describe('GET /assets/:id with ASSETS_CACHE_REVALIDATE=true', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('returns must-revalidate Cache-Control with ETag based on modified_on (%s)', async (vendor) => {
				const env = envs[vendor].envRevalidate;

				const insertResponse = await request(getUrl(vendor, env))
					.post('/files')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.field('storage', storage)
					.attach('file', createReadStream(imageFilePath));

				const fileId = insertResponse.body.data.id;
				const modifiedOn = insertResponse.body.data.modified_on;

				const response = await request(getUrl(vendor, env))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				expect(response.statusCode).toBe(200);
				expect(response.headers['cache-control']).toBe('max-age=0, must-revalidate');
				expect(response.headers['etag']).toBe(`"${Math.floor(new Date(modifiedOn).getTime() / 1000)}"`);
				expect(response.headers['last-modified']).toBe(new Date(modifiedOn).toUTCString());
			});

			it.each(vendors)('returns 304 when If-None-Match matches the ETag (%s)', async (vendor) => {
				const env = envs[vendor].envRevalidate;

				const insertResponse = await request(getUrl(vendor, env))
					.post('/files')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.field('storage', storage)
					.attach('file', createReadStream(imageFilePath));

				const fileId = insertResponse.body.data.id;

				const firstResponse = await request(getUrl(vendor, env))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const etag = firstResponse.headers['etag'];

				const response = await request(getUrl(vendor, env))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-None-Match', etag as string);

				expect(response.statusCode).toBe(304);
				expect(response.body).toEqual({});
			});

			it.each(vendors)('returns 304 when file was not modified after If-Modified-Since (%s)', async (vendor) => {
				const env = envs[vendor].envRevalidate;

				const insertResponse = await request(getUrl(vendor, env))
					.post('/files')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.field('storage', storage)
					.attach('file', createReadStream(imageFilePath));

				const fileId = insertResponse.body.data.id;

				const firstResponse = await request(getUrl(vendor, env))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const lastModified = firstResponse.headers['last-modified'];

				const response = await request(getUrl(vendor, env))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-Modified-Since', lastModified as string);

				expect(response.statusCode).toBe(304);
			});

			it.each(vendors)('returns 200 with new ETag after the file is replaced (%s)', async (vendor) => {
				const env = envs[vendor].envRevalidate;

				const insertResponse = await request(getUrl(vendor, env))
					.post('/files')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.field('storage', storage)
					.attach('file', createReadStream(imageFilePath));

				const fileId = insertResponse.body.data.id;

				const firstResponse = await request(getUrl(vendor, env))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const oldEtag = firstResponse.headers['etag'];
				const oldLastModified = firstResponse.headers['last-modified'];

				// Wait a second to ensure modified_on changes as ETag is not in milliseconds
				await new Promise((resolve) => setTimeout(resolve, 1000));

				await request(getUrl(vendor, env))
					.patch(`/files/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.attach('file', createReadStream(replacementFilePath));

				const response = await request(getUrl(vendor, env))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-None-Match', oldEtag as string);

				expect(response.statusCode).toBe(200);
				expect(response.headers['etag']).not.toBe(oldEtag);
				expect(response.headers['last-modified']).not.toBe(oldLastModified);
			});
		});
	});

	describe('GET /assets/:id with ASSETS_CACHE_REVALIDATE=false (default)', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('returns max-age Cache-Control without revalidation (%s)', async (vendor) => {
				const env = envs[vendor].envDefault;

				const insertResponse = await request(getUrl(vendor, env))
					.post('/files')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.field('storage', storage)
					.attach('file', createReadStream(imageFilePath));

				const fileId = insertResponse.body.data.id;

				const response = await request(getUrl(vendor, env))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				expect(response.statusCode).toBe(200);
				expect(response.headers['cache-control']).toContain('max-age=3600');
				expect(response.headers['cache-control']).not.toContain('must-revalidate');
			});

			it.each(vendors)('returns 200 with full body even when If-None-Match is sent (%s)', async (vendor) => {
				const env = envs[vendor].envDefault;

				const insertResponse = await request(getUrl(vendor, env))
					.post('/files')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.field('storage', storage)
					.attach('file', createReadStream(imageFilePath));

				const fileId = insertResponse.body.data.id;

				const firstResponse = await request(getUrl(vendor, env))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const etag = firstResponse.headers['etag'];

				const response = await request(getUrl(vendor, env))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-None-Match', etag as string);

				expect(response.statusCode).toBe(200);
			});
		});
	});
});
