// Feature 004, the CRUD of /permissions (contracts/permissions-api.md §1), US3.7 (the limit is always -1, meta
// included) and US2.8 (a user with app access sees the minimal app permissions). /permissions/me* is US6.
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { assertParity, parity } from '../parity.js';
import { attachPolicy, cleanup, createPolicy, createRoleTree, createUser, uniqueName } from './fixtures.js';
import { startFlow } from './flow.js';

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 60_000);

describe('/permissions CRUD', () => {
	it('POST one and many, GET with limit and meta, SEARCH with keys, GET /:pk, PATCH, DELETE', async () => {
		const prefix = uniqueName('parity-permissions');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const policy = await createPolicy('directus', `${prefix}-${ctx.app}`);
			flow.name(policy, 'policy');

			const one = await flow.req('POST', '/permissions?fields=id,collection,action,fields,permissions', {
				policy,
				collection: 'directus_roles',
				action: 'read',
				fields: ['id', 'name'],
				permissions: { name: { _contains: 'x' } },
			});

			const first = (one.json as any).data.id;
			flow.name(first, 'p1');

			const many = await flow.req('POST', '/permissions?fields=id,collection,action&sort=id', [
				{ policy, collection: 'directus_users', action: 'read', fields: ['*'] },
				{ policy, collection: 'directus_users', action: 'update', fields: ['first_name'], validation: {} },
			]);

			const rows = ((many.json as any).data as any[]).filter((p) => p.id != null);
			rows.forEach((p, i) => flow.name(p.id, `p${i + 2}`));

			const filter = json({ policy: { _eq: policy } });
			await flow.req(
				'GET',
				`/permissions?filter=${filter}&fields=id,collection,action&sort=id&limit=1&meta=filter_count`,
			);
			await flow.req('SEARCH', '/permissions?fields=id,action', { keys: [first] });
			await flow.req('GET', `/permissions/${first}?fields=id,policy,presets,validation`);
			await flow.req('GET', '/permissions/xme');
			await flow.req('PATCH', `/permissions/${first}?fields=id,fields`, { fields: ['id'] });
			await flow.req(
				'PATCH',
				'/permissions?fields=id,action&sort=id',
				rows.map((p) => ({ id: p.id, presets: {} })),
			);
			await flow.req('DELETE', '/permissions', [first]);
			await flow.req('DELETE', '/permissions', { query: { filter: { policy: { _eq: policy } } } });
			await flow.rows('directus_permissions', (q) => q.where({ policy }));
			await flow.activity();
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'permissions CRUD');
	});

	it('OPTIONS and validateBatch errors', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			await flow.req('OPTIONS', '/permissions');
			await flow.req('OPTIONS', '/permissions/1');
			await flow.req('PATCH', '/permissions', {});
			await flow.req('POST', '/permissions', { collection: 'directus_roles' });
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'permissions errors');
	});
});

describe('US3.7, US2.8: reads', () => {
	it('?limit=1 returns every row with the same meta at both apps (admin, app minimal permissions appended)', async () => {
		const result = await parity({
			path: '/permissions?limit=1&meta=*&fields=collection,action,policy',
			headers: { authorization: `Bearer ${await (await import('../directus-api.js')).adminToken('directus')}` },
		});

		assertParity(result);
		expect((result.backoffice.json as any).data.length).toBeGreaterThan(1);
	});

	it('a user with app access and no permission on directus_permissions', async () => {
		const prefix = uniqueName('parity-permissions-app');
		const { leaf } = await createRoleTree('directus', prefix);
		await attachPolicy('directus', await createPolicy('directus', prefix, { app: true }), { role: leaf });
		const user = await createUser('directus', prefix, { role: leaf });

		for (const path of ['/permissions', '/permissions?filter[collection][_eq]=directus_users', '/permissions/1']) {
			const result = await parity({ path, headers: { authorization: `Bearer ${user.token}` } });
			assertParity(result);
		}
	});
});
