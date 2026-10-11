// Ported from directus/tests/blackbox/tests/db/routes/permissions/check-item-permissions.test.ts (with its .seed.ts,
// feature 004, T067). Backoffice: the collections and items are made through the API of Directus (/collections, /items are later
// features); each app runs the cases with its own app-access user and its own permissions (CreatePermission of that
// app), and the two answers are compared after the assertions of the blackbox test.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import {
	attachPolicy,
	cleanup,
	createPolicy,
	CreatePermission,
	createRoleTree,
	createUser,
	type TestUser,
	uniqueName,
} from './fixtures.js';
import { startFlow } from './flow.js';

const run = Date.now().toString(36);
const collection = `test_collection_permissions_${run}`;
const collectionItemName = 'Bunny';
const singleton = `test_singleton_permissions_${run}`;
const singletonItemName = 'Carrot';

beforeAll(async () => {
	// Seed (check-item-permissions.seed.ts)
	for (const [name, meta] of [
		[collection, {}],
		[singleton, { singleton: true }],
	] as const) {
		await appRequest('directus', 'POST', '/collections', {
			collection: name,
			meta,
			schema: {},
			fields: [{ field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } }],
		});

		await appRequest('directus', 'POST', `/fields/${name}`, { field: 'name', type: 'string' });
	}

	await appRequest('directus', 'POST', `/items/${collection}`, { name: collectionItemName });
	await appRequest('directus', 'PATCH', `/items/${singleton}`, { name: singletonItemName });
}, 300_000);

afterAll(async () => {
	await cleanup();
	await appRequest('directus', 'DELETE', `/collections/${collection}`);
	await appRequest('directus', 'DELETE', `/collections/${singleton}`);
	await closeHostDb();
}, 300_000);

/** An app-access user (USER.APP_ACCESS of the blackbox suite), one per app. */
async function appAccessUser(prefix: string): Promise<{ user: TestUser; role: string }> {
	const { leaf } = await createRoleTree('directus', prefix);
	await attachPolicy('directus', await createPolicy('directus', prefix, { app: true }), { role: leaf });
	return { user: await createUser('directus', prefix, { role: leaf }), role: leaf };
}

describe('/permissions/me/:collection/:id?', () => {
	describe('retrieves item permissions', () => {
		it('admin', async () => {
			const transcripts = await scenario(urls(), async (ctx) => {
				const flow = await startFlow(ctx);
				const response = await flow.req('GET', `/permissions/me/${collection}/1`);

				// Assert
				expect(response.status).toEqual(200);
				expect((response.json as any).data).toMatchObject({
					update: { access: true },
					delete: { access: true },
					share: { access: true },
				});

				return flow.transcript();
			});

			assertSameTranscripts(transcripts, 'admin');
		});

		it('user: collection item with update access', async () => {
			const prefix = uniqueName('parity-check-item');

			const transcripts = await scenario(urls(), async (ctx) => {
				const flow = await startFlow(ctx);
				const { user, role } = await appAccessUser(`${prefix}-${ctx.app}`);
				const headers = { authorization: `Bearer ${user.token}` };

				const response1 = await flow.req('GET', `/permissions/me/${collection}/1`, undefined, headers);
				expect(response1.status).toEqual(200);
				expect((response1.json as any).data).toMatchObject({
					update: { access: false },
					delete: { access: false },
					share: { access: false },
				});

				await CreatePermission(ctx.app, {
					role,
					permissions: [
						{
							collection,
							action: 'update',
							permissions: { _and: [{ name: { _eq: collectionItemName } }] },
							presets: {},
							fields: ['name'],
						},
					],
					policyName: 'Check Update Collection',
				});

				const response2 = await flow.req('GET', `/permissions/me/${collection}/1`, undefined, headers);
				expect(response2.status).toEqual(200);
				expect((response2.json as any).data).toMatchObject({
					update: { access: true },
					delete: { access: false },
					share: { access: false },
				});

				return flow.transcript();
			});

			assertSameTranscripts(transcripts, 'collection item');
		});

		it('user: singleton item with update access', async () => {
			const prefix = uniqueName('parity-check-singleton');

			const transcripts = await scenario(urls(), async (ctx) => {
				const flow = await startFlow(ctx);
				const { user, role } = await appAccessUser(`${prefix}-${ctx.app}`);
				const headers = { authorization: `Bearer ${user.token}` };

				const response1 = await flow.req('GET', `/permissions/me/${singleton}`, undefined, headers);
				expect(response1.status).toEqual(200);
				expect((response1.json as any).data).toMatchObject({
					update: { access: false },
					delete: { access: false },
					share: { access: false },
				});

				await CreatePermission(ctx.app, {
					role,
					permissions: [
						{
							collection: singleton,
							action: 'update',
							permissions: { _and: [{ name: { _eq: singletonItemName } }] },
							presets: {},
							fields: ['name'],
						},
					],
					policyName: 'Check Update Singleton',
				});

				const response2 = await flow.req('GET', `/permissions/me/${singleton}`, undefined, headers);
				expect(response2.status).toEqual(200);
				expect((response2.json as any).data).toMatchObject({
					update: { access: true, presets: {}, fields: ['name'] },
					delete: { access: false },
					share: { access: false },
				});

				return flow.transcript();
			});

			assertSameTranscripts(transcripts, 'singleton item');
		});
	});

	it('returns an error when unauthenticated', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const response = await flow.req('GET', `/permissions/me/${collection}/1`, undefined, {});
			expect(response.status).toBe(403);
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'unauthenticated');
	});
});
