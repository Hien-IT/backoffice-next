// Feature 004, US3.3 to US3.5 and the CRUD of /policies (contracts/permissions-api.md §1): request forms, SEARCH with
// keys, ip_access validation, nested permissions (the CreatePermission fixture of the blackbox suite), the last admin
// rule and GET /policies/me. Each app runs the same flow with its own fixture (scenario()).
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { uniqueName } from './fixtures.js';
import { startFlow } from './flow.js';
import { onlyBootstrapAdmin } from './last-admin.js';

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

afterAll(async () => {
	const { data } = await appRequest(
		'directus',
		'GET',
		`/policies?filter=${json({ name: { _starts_with: 'parity-policies' } })}&fields=id&limit=-1`,
	);

	if (data.length) await appRequest('directus', 'DELETE', '/policies', { keys: data.map((p: any) => p.id) });
	await closeHostDb();
}, 60_000);

/** The names of each app's fixture differ by the app suffix; give both the same one. */
function same<T extends Record<string, unknown>>(transcripts: T, prefix: string): T {
	return Object.fromEntries(
		Object.entries(transcripts).map(([app, t]) => [
			app,
			JSON.parse(JSON.stringify(t).split(`${prefix}-${app}`).join(`${prefix}-<app>`)),
		]),
	) as T;
}

describe('/policies CRUD', () => {
	it('POST one and many, GET, SEARCH with keys, GET /:pk, PATCH, DELETE', async () => {
		const prefix = uniqueName('parity-policies');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;

			const one = await flow.req('POST', '/policies?fields=id,name,icon,app_access,admin_access,enforce_tfa', {
				name: `${name}-a`,
				app_access: true,
			});

			const a = (one.json as any).data.id;
			flow.name(a, 'a');

			const many = await flow.req('POST', '/policies?fields=id,name&sort=name', [
				{ name: `${name}-b`, enforce_tfa: true },
				{ name: `${name}-c`, ip_access: ['10.0.0.0/8', '192.168.1.1-192.168.1.9', '::1'] },
			]);

			const [b, c] = (many.json as any).data.map((p: any) => p.id);
			flow.name(b, 'b');
			flow.name(c, 'c');

			const filter = json({ name: { _starts_with: name } });
			await flow.req('GET', `/policies?filter=${filter}&fields=name,ip_access&sort=name&meta=filter_count`);
			await flow.req('SEARCH', '/policies?fields=name', { keys: [b] });
			await flow.req('SEARCH', '/policies', { query: { filter: { name: { _eq: `${name}-c` } }, fields: ['name'] } });
			await flow.req('GET', `/policies/${a}?fields=name,roles,users,permissions`);
			await flow.req('GET', '/policies/me');
			await flow.req('GET', '/policies/xme');
			await flow.req('PATCH', `/policies/${a}?fields=name,app_access`, { app_access: false });
			await flow.req('PATCH', '/policies?fields=name,icon&sort=name', { keys: [b, c], data: { icon: 'lock' } });
			await flow.req('DELETE', '/policies', [b]);
			await flow.req('DELETE', `/policies/${c}`);
			await flow.rows('directus_policies', (q) => q.where('name', 'like', `${name}%`), { orderBy: 'name' });
			await flow.activity();
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'policies CRUD');
	});

	it('OPTIONS and validateBatch errors', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			await flow.req('OPTIONS', '/policies');
			await flow.req('OPTIONS', '/policies/me');
			await flow.req('OPTIONS', '/policies/me/globals');
			await flow.req('PATCH', '/policies', { data: {} });
			await flow.req('DELETE', '/policies', { keys: [], query: {} });
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'policies errors');
	});
});

describe('US3.4: ip_access', () => {
	it.each([[['*']], [['not-an-ip']], [['10.0.0.1/99']], ['10.0.0.1'], [[42]]])(
		'%j → the same answer at both apps, nothing written',
		async (ipAccess) => {
			const prefix = uniqueName('parity-policies-ip');

			const transcripts = await scenario(urls(), async (ctx) => {
				const flow = await startFlow(ctx);
				const name = `${prefix}-${ctx.app}`;
				await flow.req('POST', '/policies?fields=name,ip_access', { name, ip_access: ipAccess });

				const created = await flow.req('POST', '/policies?fields=id', { name: `${name}-ok` });
				const id = (created.json as any).data.id;
				flow.name(id, 'ok');

				await flow.req('PATCH', `/policies/${id}?fields=ip_access`, { ip_access: ipAccess });
				await flow.rows('directus_policies', (q) => q.where('name', 'like', `${name}%`), {
					orderBy: 'name',
					columns: ['name', 'ip_access'],
				});
				return flow.transcript();
			});

			assertSameTranscripts(same(transcripts, prefix), `ip_access ${JSON.stringify(ipAccess)}`);
		},
	);

	it('the message of a wrong value', async () => {
		const res = await appRequest('backoffice', 'POST', '/policies', {
			name: uniqueName('parity-policies-ip-msg'),
			ip_access: ['*'],
		}).catch((error: Error) => error.message);

		expect(res).toContain(
			'IP Access contains an incorrect value. Valid values are: IP addresses, IP ranges and CIDR blocks',
		);
	});
});

describe('US3.5: nested permissions (CreatePermission of the blackbox suite)', () => {
	it('PATCH /policies/:id with permissions {create, update, delete}', async () => {
		const prefix = uniqueName('parity-policies-nested');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const policy = (await flow.req('POST', '/policies?fields=id', { name })).json as any;
			flow.name(policy.data.id, 'policy');

			await flow.req('PATCH', `/policies/${policy.data.id}?fields=id,permissions.collection,permissions.action`, {
				permissions: {
					create: [
						{ collection: 'directus_roles', action: 'read', fields: ['*'], permissions: {} },
						{ collection: 'directus_users', action: 'read', fields: ['id', 'email'], permissions: {} },
					],
					update: [],
					delete: [],
				},
			});

			const rows = await flow.req(
				'GET',
				`/permissions?filter=${json({ policy: { _eq: policy.data.id } })}&sort=collection`,
			);
			const [roles, users] = (rows.json as any).data.filter((p: any) => p.id !== null && p.id !== undefined);
			flow.name(roles.id, 'perm-roles');
			flow.name(users.id, 'perm-users');

			await flow.req('PATCH', `/policies/${policy.data.id}?fields=permissions.collection,permissions.fields`, {
				permissions: {
					create: [],
					update: [{ id: users.id, fields: ['id'] }],
					delete: [roles.id],
				},
			});

			await flow.rows('directus_permissions', (q) => q.where({ policy: policy.data.id }));
			await flow.activity();
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'nested permissions');
	});
});

describe('US3.3: the last admin', () => {
	it('deleting the admin policy or turning admin_access off: 422 at both apps, nothing changes', async () => {
		const admin = await onlyBootstrapAdmin();

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			await flow.req('PATCH', `/policies/${admin.policy}?fields=admin_access`, { admin_access: false });
			await flow.req('DELETE', `/policies/${admin.policy}`);
			await flow.req('DELETE', `/access/${admin.access}`);
			await flow.rows('directus_policies', (q) => q.where({ id: admin.policy }), {
				columns: ['id', 'admin_access'],
			});
			await flow.rows('directus_access', (q) => q.where({ id: admin.access }));
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'last admin');
		expect((transcripts.backoffice as any[])[0].response.status).toBe(422);
	});
});
