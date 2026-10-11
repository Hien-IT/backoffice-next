// Feature 004, the CRUD of /access (contracts/permissions-api.md §1): rows for a role, a user, both and the public
// role, SEARCH with keys, the last admin rule (US3.3) and GET /access/me (204). Each app runs the same flow with its
// own fixture (scenario()).
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { cleanup, createPolicy, createRoleTree, createUser, uniqueName } from './fixtures.js';
import { startFlow } from './flow.js';
import { onlyBootstrapAdmin } from './last-admin.js';

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 60_000);

describe('/access CRUD', () => {
	it('role, user, both and public rows; SEARCH with keys; PATCH; DELETE; GET /access/me', async () => {
		const prefix = uniqueName('parity-access');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const tree = await createRoleTree('directus', `${prefix}-${ctx.app}`);
			const role = tree.leaf;
			flow.name(tree.root, 'root');
			flow.name(tree.middle, 'middle');
			const user = await createUser('directus', `${prefix}-${ctx.app}`);
			const policy = await createPolicy('directus', `${prefix}-${ctx.app}`);
			flow.name(role, 'role');
			flow.name(user.id, 'user');
			flow.name(policy, 'policy');

			const fields = 'fields=id,role,user,policy,sort';
			const ids: string[] = [];

			for (const [label, body] of [
				['to-role', { policy, role }],
				['to-user', { policy, user: user.id }],
				['to-both', { policy, role, user: user.id }],
				['public', { policy }],
			] as const) {
				const res = await flow.req('POST', `/access?${fields}`, body);
				const id = (res.json as any).data?.id;

				if (id) {
					flow.name(id, label);
					ids.push(id);
				}
			}

			await flow.req('POST', `/access?${fields}`, { policy: '00000000-0000-4000-8000-000000000000', role });
			await flow.req('SEARCH', `/access?${fields}&sort=sort`, { keys: ids.slice(0, 2) });
			await flow.req('GET', `/access/${ids[0]}?${fields}`);
			await flow.req('GET', '/access/me');
			await flow.req('PATCH', `/access/${ids[0]}?${fields}`, { sort: 5 });
			await flow.req('PATCH', `/access?${fields}`, { keys: ids.slice(1), data: { sort: 2 } });
			await flow.req('DELETE', '/access', { keys: ids.slice(0, 2) });
			await flow.req('DELETE', `/access/${ids[2]}`);
			await flow.rows('directus_access', (q) => q.where({ policy }), { orderBy: 'sort' });
			await flow.activity();
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'access CRUD');
	});

	it('OPTIONS and validateBatch errors', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			await flow.req('OPTIONS', '/access');
			await flow.req('OPTIONS', '/access/me');
			await flow.req('DELETE', '/access', {});
			await flow.req('SEARCH', '/access', { keys: 'not-an-array' });
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'access errors');
	});
});

describe('US3.3: the last admin', () => {
	it('removing the access of the only admin policy: 422 at both apps, row kept', async () => {
		const admin = await onlyBootstrapAdmin();

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			await flow.req('DELETE', '/access', [admin.access]);
			await flow.req('PATCH', `/access/${admin.access}`, { role: null });
			await flow.rows('directus_access', (q) => q.where({ id: admin.access }));
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'last admin access');
		expect((transcripts.backoffice as any[])[0].response.status).toBe(422);
	});
});
