// Ported from directus/tests/blackbox/tests/db/routes/collections/schema-cache.test.ts
// Backoffice (feature 006, research R7): the four nodes this file spawned are the containers of the profile pairs
// schema-cache (Redis bus) and schema-cache-nomsg (no Redis), with the env the original gave them; node 1 is the app
// under test, node 2 the other app (nodeUrl), so each run checks one direction between Directus and the new app. The
// pairs without messenger are restarted first, like the fresh processes of the original.
import config, { type Env, getUrl, hasProfile, nodeUrl } from '@common/config';
import { CreateCollection } from '@common/functions';
import vendors, { type Vendor } from '@common/get-dbs-to-test';
import { USER } from '@common/variables';
import type { Knex } from 'knex';
import knex from 'knex';
import { cloneDeep } from 'lodash-es';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { awaitDirectusConnection } from '../../../../../../await-connection.js';
import { compose } from '../../../../../../docker.js';

const newCollectionName = 'schema-caching-test';

describe.skipIf(!hasProfile('schema-cache'))('Schema Caching Tests', () => {
	describe('GET /collections/:collection', () => {
		describe('schema change propagates across nodes using messenger', () => {
			const databases = new Map<string, Knex>();
			const envs = {} as Record<Vendor, [Env, Env]>;

			beforeAll(async () => {
				for (const vendor of vendors) {
					databases.set(vendor, knex(config.knexConfig[vendor]));

					const env1 = cloneDeep(config.envs);
					env1[vendor]['URL'] = nodeUrl('schema-cache', 1);

					const env2 = cloneDeep(env1);
					env2[vendor]['URL'] = nodeUrl('schema-cache', 2);

					envs[vendor] = [env1, env2];
				}
			}, 180_000);

			afterAll(async () => {
				for (const [, connection] of databases) {
					await connection.destroy();
				}
			});

			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const env1 = envs[vendor][0];
				const env2 = envs[vendor][1];

				await CreateCollection(vendor, { collection: newCollectionName, env: env1 });

				await request(getUrl(vendor, env1))
					.post(`/utils/cache/clear`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor, env1)).get(`/fields`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor, env2))
					.post(`/utils/cache/clear`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor, env2)).get(`/fields`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Action
				const responseBefore = await request(getUrl(vendor, env1))
					.get(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const responseBefore2 = await request(getUrl(vendor, env2))
					.get(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor, env1))
					.delete(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const responseAfter = await request(getUrl(vendor, env1))
					.get(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const responseAfter2 = await request(getUrl(vendor, env2))
					.get(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Assert
				expect(responseBefore.statusCode).toBe(200);
				expect(responseBefore2.statusCode).toBe(200);
				expect(responseAfter.statusCode).toBe(403);
				expect(responseAfter2.statusCode).toBe(403);
			});
		});

		describe('schema change does not propagate across nodes without messenger', () => {
			const databases = new Map<string, Knex>();
			const envs = {} as Record<Vendor, [Env, Env]>;

			beforeAll(async () => {
				compose('restart', 'directus-schema-cache-nomsg', 'backoffice-api-schema-cache-nomsg');

				for (const vendor of vendors) {
					databases.set(vendor, knex(config.knexConfig[vendor]));

					const env3 = cloneDeep(config.envs);
					env3[vendor]['URL'] = nodeUrl('schema-cache-nomsg', 1);

					const env4 = cloneDeep(env3);
					env4[vendor]['URL'] = nodeUrl('schema-cache-nomsg', 2);

					envs[vendor] = [env3, env4];
				}

				await Promise.all([
					awaitDirectusConnection(nodeUrl('schema-cache-nomsg', 1)),
					awaitDirectusConnection(nodeUrl('schema-cache-nomsg', 2)),
				]);
			}, 180_000);

			afterAll(async () => {
				for (const [, connection] of databases) {
					await connection.destroy();
				}
			});

			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const env3 = envs[vendor][0];
				const env4 = envs[vendor][1];

				await CreateCollection(vendor, { collection: newCollectionName, env: env3 });

				await request(getUrl(vendor, env3))
					.post(`/utils/cache/clear`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor, env3)).get(`/fields`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor, env4))
					.post(`/utils/cache/clear`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor, env4)).get(`/fields`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Action
				const responseBefore = await request(getUrl(vendor, env3))
					.get(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const responseBefore2 = await request(getUrl(vendor, env4))
					.get(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor, env3))
					.delete(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const responseAfter = await request(getUrl(vendor, env3))
					.get(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const responseAfter2 = await request(getUrl(vendor, env4))
					.get(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Assert
				expect(responseBefore.statusCode).toBe(200);
				expect(responseBefore2.statusCode).toBe(200);
				expect(responseAfter.statusCode).toBe(403);
				expect(responseAfter2.statusCode).toBe(200);
			});
		});
	});
});
