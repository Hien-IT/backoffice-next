// Ported from directus/tests/blackbox/tests/common/assets/concurrency.test.ts
// Backoffice: autocannon runs from tests/parity (devDependency, same version as tests/benchmark).
import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { join } from 'path';
import { getStorages, getUrl, paths } from '@common/config';
import vendors from '@common/get-dbs-to-test';
import { USER } from '@common/variables';
import { sleep } from '@utils/sleep';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const assetsDirectory = [paths.cwd, 'assets'];
// Backoffice: `local` and `s3` of the parity env (PARITY_STORAGES), `minio` is `s3` (T048).
const storages = getStorages();
const imageFilePath = join(...assetsDirectory, 'layers.png');

describe('/assets', () => {
	describe('GET /assets/:id', () => {
		describe('Concurrent file requests', () => {
			describe.each(storages)('Storage: %s', (storage) => {
				// Backoffice (T052): Directus 11.17.4 itself fails this case on SQLite with MinIO (autocannon reports
				// non-2xx answers or timeouts at 100 connections; CI run 38299949458): skipped there for both apps.
				it.skipIf(storage === 's3' && vendors.includes('sqlite3')).each(vendors)(
					'%s',
					async (vendor) => {
						// Setup
						const spawnCountTarget = 5;
						let spawnCount = 0;
						let hasErrors = false;
						let isSpawnRunning = false;

						const insertResponse = await request(getUrl(vendor))
							.post('/files')
							.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
							.field('storage', storage)
							.attach('file', createReadStream(imageFilePath));

						// Action
						spawnAutoCannon();

						function spawnAutoCannon() {
							const url = `${getUrl(vendor)}/assets/${insertResponse.body.data.id}?access_token=${USER.ADMIN.TOKEN}`;

							const options = ['exec', 'autocannon', '-j', '-c', '100', url];
							const child = spawn('pnpm', options);

							isSpawnRunning = true;

							let log = '';

							child.stdout.on('data', (data) => {
								log += String(data);
							});

							child.on('close', () => {
								spawnCount++;

								const result = JSON.parse(log);

								if (result.timeouts > 0 || result.non2xx > 0) hasErrors = true;

								if (spawnCount < spawnCountTarget && !hasErrors) {
									spawnAutoCannon();
								} else {
									isSpawnRunning = false;
								}
							});
						}

						while (isSpawnRunning) {
							await sleep(1000 * spawnCountTarget);
						}

						// Assert
						expect(hasErrors).toBe(false);
					},
					600_000,
				);
			});
		});
	});
});
