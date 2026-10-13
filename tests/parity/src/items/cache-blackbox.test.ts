// Ported from directus/tests/blackbox/tests/db/app/cache.test.ts
// Also ports app/cache.seed.ts, routes/permissions/cache-purge.test.ts and cache-purge.seed.ts (feature 005, T031).
// Backoffice: the four Directus instances that the original spawns (memory, memory with purge, Redis, Redis with purge)
// are the profile pairs cache-mem, cache-mem-purge, cache-redis, cache-redis-purge (research R5); every case runs at
// each app of the pair with the original assertions. Feature 010: POST /utils/cache/clear and /presets go to the app
// under test, like every request of the original. The ignored collection is `test_cache_ignored` (CACHE_AUTO_PURGE_IGNORE_LIST of the profile env).
// The admin of the parity env replaces USER.ADMIN of the blackbox seed. Each case first empties the collection through
// Directus: cache-redis has CACHE_VALUE_MAX_SIZE=1kb and the four pairs write the same collections.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Profile } from '../config.js';
import { adminToken, appRequest } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { profileUrls } from '../profiles.js';

const PROFILES = ['cache-mem', 'cache-mem-purge', 'cache-redis', 'cache-redis-purge'] as const satisfies Profile[];
const APP_NAMES = ['directus', 'backoffice'] as const;

const cacheStatusHeader = 'x-cache-status';
const collectionFirst = 'test_app_cache_first';
const collectionIgnored = 'test_cache_ignored';
const collectionPerms = 'test_perms_cache_purge';
const COLLECTIONS = [collectionFirst, collectionIgnored, collectionPerms];

// PUBLIC_URL of env/<vendor>.env, which the profile pairs keep.
const publicURL = readFileSync(new URL(`../../env/${getDbsToTest()[0]}.env`, import.meta.url), 'utf8')
	.split('\n')
	.find((line) => line.startsWith('PUBLIC_URL='))!
	.slice('PUBLIC_URL='.length)
	.trim();

const running = PROFILES.filter((profile) => profileUrls(profile));
const setupOf = (profile: Profile) => profileUrls(profile)!.directusUrl!;
let token: string;

async function ignoreMissing(promise: Promise<unknown>) {
	await promise.catch(() => undefined);
}

/** Every pair has its own bus: clearing at its Directus makes both of its apps read the new schema. */
async function clearEveryPair() {
	for (const profile of running)
		await appRequest('directus', 'POST', '/utils/cache/clear?system', undefined, setupOf(profile));
}

beforeAll(async () => {
	token = await adminToken('directus');
	if (running.length === 0) return;

	const setup = setupOf(running[0]!);

	for (const collection of COLLECTIONS) {
		await ignoreMissing(appRequest('directus', 'DELETE', `/collections/${collection}`, undefined, setup));
		await appRequest(
			'directus',
			'POST',
			'/collections',
			{
				collection,
				schema: {},
				meta: {},
				fields: [
					{
						field: 'id',
						type: 'integer',
						meta: { hidden: true },
						schema: { is_primary_key: true, has_auto_increment: true },
					},
					{ field: 'string_field', type: 'string' },
				],
			},
			setup,
		);
	}

	await clearEveryPair();
}, 300_000);

afterAll(async () => {
	if (running.length === 0) return;

	for (const collection of COLLECTIONS) {
		await ignoreMissing(
			appRequest('directus', 'DELETE', `/collections/${collection}`, undefined, setupOf(running[0]!)),
		);
	}

	await clearEveryPair();
}, 300_000);

describe.each(PROFILES)('%s', (profile) => {
	const purge = profile.endsWith('-purge');

	describe.skipIf(!profileUrls(profile)).each(APP_NAMES)('%s', (app) => {
		const url = () => (app === 'directus' ? profileUrls(profile)!.directusUrl! : profileUrls(profile)!.backofficeUrl!);
		const setup = () => setupOf(profile);
		const auth = () => `Bearer ${token}`;

		/** cache.seed.ts seedDBValues, after emptying the collection (see the header). */
		async function reseed(collection: string) {
			await appRequest('directus', 'DELETE', `/items/${collection}`, { query: { limit: -1 } }, setup());
			await appRequest('directus', 'POST', `/items/${collection}`, { string_field: randomUUID() }, setup());
		}

		describe('App Caching Tests', () => {
			describe('Does not purge cache browsing app without Referer header', () => {
				it.each([collectionFirst, collectionIgnored])('%s', async (collection) => {
					// Setup
					await reseed(collection);
					await request(url()).post(`/utils/cache/clear`).set('Authorization', auth());

					// Action
					await request(url()).get(`/items/${collection}`).set('Authorization', auth());

					await request(url())
						.patch('/users/me/track/page')
						.send({ last_page: `/content/${collection}` })
						.set('Authorization', auth());

					const presetId = (await request(url()).post('/presets').send({ collection }).set('Authorization', auth()))
						.body.data.id;

					await request(url()).patch(`/presets/${presetId}`).send({ collection }).set('Authorization', auth());

					const response = await request(url()).get(`/items/${collection}`).set('Authorization', auth());

					// Assert
					expect(response.statusCode).toBe(200);
					expect(response.headers[cacheStatusHeader]).toBe('HIT');
				});
			});

			describe('Does not purge cache when browsing app with Referer header', () => {
				it.each([collectionFirst, collectionIgnored])('%s', async (collection) => {
					// Setup
					const referer = `${publicURL}/admin/content/${collection}/`;
					await reseed(collection);
					await request(url()).post(`/utils/cache/clear`).set('Referer', referer).set('Authorization', auth());

					// Action
					await request(url()).get(`/items/${collection}`).set('Referer', referer).set('Authorization', auth());

					await request(url())
						.patch('/users/me/track/page')
						.send({ last_page: `/content/${collection}` })
						.set('Referer', referer)
						.set('Authorization', auth());

					const presetId = (
						await request(url())
							.post('/presets')
							.send({ collection })
							.set('Referer', referer)
							.set('Authorization', auth())
					).body.data.id;

					await request(url())
						.patch(`/presets/${presetId}`)
						.send({ collection })
						.set('Referer', referer)
						.set('Authorization', auth());

					const response = await request(url())
						.get(`/items/${collection}`)
						.set('Referer', referer)
						.set('Authorization', auth());

					// Assert
					expect(response.statusCode).toBe(200);

					if (collection === collectionFirst) {
						expect(response.headers[cacheStatusHeader]).toBe(purge ? 'HIT' : 'MISS');
					} else {
						expect(response.headers[cacheStatusHeader]).toBe('MISS');
					}
				});
			});

			describe('Purges cache when item is mutated', () => {
				it.each([collectionFirst, collectionIgnored])('%s', async (collection) => {
					// Setup
					await reseed(collection);
					await request(url()).post(`/utils/cache/clear`).set('Authorization', auth());

					// Action
					await request(url()).get(`/items/${collection}`).set('Authorization', auth());

					await request(url())
						.post(`/items/${collection}`)
						.send({ string_field: randomUUID() })
						.set('Authorization', auth());

					const response = await request(url()).get(`/items/${collection}`).set('Authorization', auth());

					// Assert
					expect(response.statusCode).toBe(200);

					if (collection === collectionFirst) {
						expect(response.headers[cacheStatusHeader]).toBe(purge ? 'MISS' : 'HIT');
					} else {
						expect(response.headers[cacheStatusHeader]).toBe('HIT');
					}
				});
			});

			describe('Purges cache when item is mutated with Referer header', () => {
				it.each([collectionFirst, collectionIgnored])('%s', async (collection) => {
					// Setup
					const referer = `${publicURL}/admin/content/${collection}/`;
					await reseed(collection);
					await request(url()).post(`/utils/cache/clear`).set('Authorization', auth());

					// Action
					await request(url()).get(`/items/${collection}`).set('Referer', referer).set('Authorization', auth());

					await request(url())
						.post(`/items/${collection}`)
						.send({ string_field: randomUUID() })
						.set('Referer', referer)
						.set('Authorization', auth());

					const response = await request(url())
						.get(`/items/${collection}`)
						.set('Referer', referer)
						.set('Authorization', auth());

					// Assert
					expect(response.statusCode).toBe(200);
					expect(response.headers[cacheStatusHeader]).toBe('MISS');
				});
			});

			describe('Purges cache when item is mutated with an external Referer header', () => {
				it.each([collectionFirst, collectionIgnored])('%s', async (collection) => {
					// Setup
					const referer = `http://external.com/admin/content/${collection}`;
					await reseed(collection);
					await request(url()).post(`/utils/cache/clear`).set('Authorization', auth());

					// Action
					await request(url()).get(`/items/${collection}`).set('Referer', referer).set('Authorization', auth());

					await request(url())
						.post(`/items/${collection}`)
						.send({ string_field: randomUUID() })
						.set('Referer', referer)
						.set('Authorization', auth());

					const response = await request(url())
						.get(`/items/${collection}`)
						.set('Referer', referer)
						.set('Authorization', auth());

					// Assert
					expect(response.statusCode).toBe(200);

					if (collection === collectionFirst) {
						expect(response.headers[cacheStatusHeader]).toBe(purge ? 'MISS' : 'HIT');
					} else {
						expect(response.headers[cacheStatusHeader]).toBe('HIT');
					}
				});
			});
		});

		describe('Permissions Cache Purging Tests', () => {
			const action = 'read';
			const updatedAction = 'update';
			let policyId: string;

			beforeAll(async () => {
				const policy = await appRequest(
					'directus',
					'POST',
					'/policies',
					{ name: 'Cache Purge Test', admin_access: false, app_access: false },
					setup(),
				);

				policyId = policy.data.id;
			}, 60_000);

			afterAll(async () => {
				// The permissions of the policy go with it (ON DELETE CASCADE).
				await appRequest('directus', 'DELETE', `/policies/${policyId}`, undefined, setup());
			});

			async function clearCacheAndFetchOnce() {
				await request(url()).post(`/utils/cache/clear`).set('Authorization', auth());
				await request(url()).get(`/items/${collectionPerms}`).set('Authorization', auth());
			}

			const create = async (body: object) =>
				(await request(url()).post('/permissions').send(body).set('Authorization', auth())).body.data;

			const mutations: Record<string, () => Promise<unknown>> = {
				createOne: async () => {
					await clearCacheAndFetchOnce();
					await create({ collection: collectionPerms, action, policy: policyId });
				},
				createMany: async () => {
					await clearCacheAndFetchOnce();
					await create(Array(5).fill({ collection: collectionPerms, action, policy: policyId }));
				},
				updateOne: async () => {
					const itemId = (await create({ collection: collectionPerms, action, policy: policyId })).id;
					await clearCacheAndFetchOnce();
					await request(url())
						.patch(`/permissions/${itemId}`)
						.send({ action: updatedAction })
						.set('Authorization', auth());
				},
				updateMany: async () => {
					const itemIds = (await create(Array(5).fill({ collection: collectionPerms, action, policy: policyId })))
						.map((item: { id?: number }) => item.id)
						.filter((v: unknown) => v);

					await clearCacheAndFetchOnce();

					await request(url())
						.patch('/permissions')
						.send({ keys: itemIds, data: { action: updatedAction } })
						.set('Authorization', auth());
				},
				updateBatch: async () => {
					const itemIds = (await create(Array(5).fill({ collection: collectionPerms, action, policy: policyId }))).map(
						(item: { id?: number }) => item.id,
					);

					await clearCacheAndFetchOnce();

					await request(url())
						.patch('/permissions')
						.send(
							Array(5)
								.fill(0)
								.map((_, index) => ({ id: itemIds[index], action: updatedAction })),
						)
						.set('Authorization', auth());
				},
				deleteOne: async () => {
					const itemId = (await create({ collection: collectionPerms, action, policy: policyId })).id;
					await clearCacheAndFetchOnce();
					await request(url()).delete(`/permissions/${itemId}`).set('Authorization', auth());
				},
				deleteMany: async () => {
					const itemIds = (await create(Array(5).fill({ collection: collectionPerms, action, policy: policyId })))
						.map((item: { id?: number }) => item.id)
						.filter((v: unknown) => v);

					await clearCacheAndFetchOnce();
					await request(url()).delete('/permissions').send(itemIds).set('Authorization', auth());
				},
			};

			it.each(Object.keys(mutations))('Purges cache after %s in permissions', async (mutationKey) => {
				// Action
				await mutations[mutationKey]!();

				const response = await request(url()).get(`/items/${collectionPerms}`).set('Authorization', auth());

				// Assert
				expect(response.statusCode).toBe(200);
				expect(response.headers[cacheStatusHeader]).toBe('MISS');
			});
		});
	});
});
