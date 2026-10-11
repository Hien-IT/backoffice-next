// Feature 004, US4.1 to US4.8 and the CRUD of /users (contracts/permissions-api.md §1): request forms, the rules of
// directus_users (FR-050 to FR-055) and their effects on rows, sessions, activity and revisions. Each app runs the same
// flow with its own fixture (scenario()); the user limits run on the `user-limits` profile pair.
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { setSettings, urls } from '../auth/fixtures.js';
import { cookiePair } from '../auth/flows.js';
import { assertSameTranscripts, type ScenarioContext, scenario, send } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { assertParity, parity } from '../parity.js';
import { profileUrls } from '../profiles.js';
import {
	attachPolicy,
	cleanup,
	createPolicy,
	createRoleTree,
	createUser,
	TEST_PASSWORD,
	uniqueName,
} from './fixtures.js';
import { startFlow } from './flow.js';
import { onlyBootstrapAdmin } from './last-admin.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const USER_COLUMNS = ['email', 'status', 'role', 'password', 'token', 'tfa_secret', 'provider', 'last_page'];

afterAll(async () => {
	// Users made by the flows (fixtures of cleanup() are made through fixtures.ts only).
	const { data } = await appRequest(
		'directus',
		'GET',
		`/users?filter=${json({ email: { _starts_with: 'parity-users' } })}&fields=id&limit=-1`,
	);

	if (data.length) await appRequest('directus', 'DELETE', '/users', { keys: data.map((u: any) => u.id) });
	await cleanup();
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

/** A role whose users may read and update their own row. */
async function selfUpdateRole(name: string): Promise<string> {
	const { leaf } = await createRoleTree('directus', name);
	const own = { id: { _eq: '$CURRENT_USER' } };

	const policy = await createPolicy('directus', name, {
		app: true,
		permissions: [
			{ collection: 'directus_users', action: 'read', fields: ['*'], permissions: own },
			{ collection: 'directus_users', action: 'update', fields: ['*'], permissions: own },
		],
	});

	await attachPolicy('directus', policy, { role: leaf });
	return leaf;
}

const login = (ctx: ScenarioContext, email: string, password: string, mode: 'json' | 'session' = 'json') =>
	send(ctx.url, { method: 'POST', path: '/auth/login', body: { email, password, mode } }, ctx.host);

describe('/users CRUD', () => {
	it('POST one and many, GET, SEARCH (keys ignored), GET /:pk, GET /users/some, PATCH and DELETE forms', async () => {
		const prefix = uniqueName('parity-users-crud');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const email = (n: string) => `${name}-${n}@example.com`;

			const one = await flow.req('POST', '/users?fields=id,email,status,password,token', {
				email: email('a'),
				password: TEST_PASSWORD,
				token: `${name}-token`,
				first_name: 'A',
			});

			flow.name((one.json as any).data.id, 'a');

			const many = await flow.req('POST', '/users?fields=id,email&sort=email', [
				{ email: email('b'), status: 'draft' },
				{ email: email('c'), status: 'whatever' },
				{ email: email('d') },
			]);

			const [b, c, d] = (many.json as any).data.map((u: any) => u.id);
			flow.name(b, 'b');
			flow.name(c, 'c');
			flow.name(d, 'd');

			const filter = json({ email: { _starts_with: name } });
			await flow.req('GET', `/users?filter=${filter}&fields=email,status,token&sort=email&meta=filter_count`);
			await flow.req('SEARCH', '/users?fields=email', {
				keys: [b],
				query: { filter: { email: { _eq: email('c') } }, fields: ['email'] },
			});
			await flow.req('GET', `/users/${b}?fields=email,status,role,policies`);
			await flow.req('GET', '/users/some');
			await flow.req('PATCH', '/users?fields=email,status&sort=email', [{ id: b, status: 'suspended' }]);
			await flow.req('PATCH', '/users?fields=email,last_name&sort=email', { keys: [b, c], data: { last_name: 'L' } });
			await flow.req('PATCH', '/users?fields=email,title&sort=email', {
				query: { filter: { email: { _eq: email('d') } } },
				data: { title: 'T' },
			});
			await flow.req('PATCH', `/users/${c}?fields=email,status`, { status: 'archived' });
			await flow.req('DELETE', '/users', [b]);
			await flow.req('DELETE', '/users', { keys: [c] });
			await flow.req('DELETE', '/users', { query: { filter: { email: { _eq: email('d') } } } });
			await flow.rows('directus_users', (q) => q.where('email', 'like', `${name}%`), {
				orderBy: 'email',
				columns: USER_COLUMNS,
			});
			await flow.activity();
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'users CRUD');
	});

	it('OPTIONS and validateBatch errors', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			for (const path of ['/users', '/users/me', '/users/abc', '/users/me/track/page', '/users/abc/tfa/disable']) {
				await flow.req('OPTIONS', path);
			}

			await flow.req('PATCH', '/users', { data: {} });
			await flow.req('DELETE', '/users', {});
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'users errors');
	});
});

describe('US4.1 to US4.4: rules of directus_users', () => {
	it('email unique without case, invalid email, email for several users, tfa_secret, provider', async () => {
		const prefix = uniqueName('parity-users-rules');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const first = await flow.req('POST', '/users?fields=id', { email: `${name}-a@example.com` });
			const id = (first.json as any).data.id;
			flow.name(id, 'a');

			await flow.req('POST', '/users', { email: `${name}-A@EXAMPLE.com` });
			await flow.req('POST', '/users', [{ email: `${name}-x@example.com` }, { email: `${name}-X@example.com` }]);
			await flow.req('POST', '/users', { email: 'not-an-email' });
			await flow.req('PATCH', `/users/${id}`, { tfa_secret: 'ABC' });
			await flow.req('PATCH', '/users', { keys: [id, id], data: { email: `${name}-z@example.com` } });
			await flow.req('PATCH', `/users/${id}?fields=provider,external_identifier,auth_data`, {
				provider: 'other',
				external_identifier: `${name}-ext`,
			});
			await flow.rows('directus_users', (q) => q.where('email', 'like', `${name}%`), {
				orderBy: 'email',
				columns: USER_COLUMNS,
			});
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'users rules');
	});

	it('a user who may update its own row cannot change provider or external_identifier', async () => {
		const prefix = uniqueName('parity-users-self');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const { leaf } = await createRoleTree('directus', name);
			const policy = await createPolicy('directus', name, {
				app: true,
				permissions: [
					{
						collection: 'directus_users',
						action: 'update',
						fields: ['*'],
						permissions: { id: { _eq: '$CURRENT_USER' } },
					},
					{
						collection: 'directus_users',
						action: 'read',
						fields: ['*'],
						permissions: { id: { _eq: '$CURRENT_USER' } },
					},
				],
			});
			await attachPolicy('directus', policy, { role: leaf });
			const user = await createUser('directus', name, { role: leaf });
			flow.name(user.id, 'user');
			flow.name(leaf, 'role');
			const headers = { authorization: `Bearer ${user.token}` };

			for (const body of [{ provider: 'x' }, { external_identifier: 'x' }, { tfa_secret: 'x' }, { first_name: 'Ok' }]) {
				await flow.req('PATCH', '/users/me?fields=first_name', body, headers);
			}

			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'users self rules');
	});
});

describe('FR-051: password policy and static token', () => {
	it.each([
		['regex without slashes', '^.{12,}$'],
		['regex wrapped in slashes', '/^.{12,}$/'],
		['empty policy', ''],
		['invalid regex', '/(/'],
	])('%s', async (_title, policy) => {
		const restore = await setSettings({ auth_password_policy: policy });
		const prefix = uniqueName('parity-users-policy');

		try {
			const transcripts = await scenario(urls(), async (ctx) => {
				const flow = await startFlow(ctx);
				const name = `${prefix}-${ctx.app}`;
				await flow.req('POST', '/users?fields=email', { email: `${name}-short@example.com`, password: 'short' });
				await flow.req('POST', '/users?fields=email', { email: `${name}-long@example.com`, password: 'long-enough-1' });
				await flow.rows('directus_users', (q) => q.where('email', 'like', `${name}%`), {
					orderBy: 'email',
					columns: ['email', 'password'],
				});
				return flow.transcript();
			});

			assertSameTranscripts(same(transcripts, prefix), `password policy ${policy}`);
		} finally {
			await restore();
		}
	});

	it('a static token set through /users of either app works at both apps', async () => {
		for (const app of ['directus', 'backoffice'] as const) {
			const email = `${uniqueName('parity-users-static')}@example.com`;
			const token = `parity-static-${uniqueName(app)}`;
			const user = await appRequest(app, 'POST', '/users?fields=id', { email, token });

			const result = await parity({ path: '/users/me?fields=id,email', headers: { authorization: `Bearer ${token}` } });
			assertParity(result);
			expect((result.backoffice.json as any).data).toMatchObject({ id: user.data.id });
		}
	});
});

describe('US4.5: sessions after a change (FR-053)', () => {
	it('own password with a json token removes every session; with a session token keeps the current one', async () => {
		const prefix = uniqueName('parity-users-sessions');
		const role = await selfUpdateRole(prefix);

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const user = await createUser('directus', name, { role });
			flow.name(user.id, 'user');
			flow.name(user.email, 'email');
			flow.name(role, 'role');
			const sessions = () =>
				flow.rows('directus_sessions', (q) => q.where({ user: user.id }), { orderBy: 'expires', columns: ['user'] });

			const a = await login(ctx, user.email, user.password);
			await login(ctx, user.email, user.password);
			await sessions();
			await flow.req(
				'PATCH',
				'/users/me?fields=id',
				{ password: 'second-password-1' },
				{
					authorization: `Bearer ${(a.json as any).data.access_token}`,
				},
			);
			await sessions();

			const s = await login(ctx, user.email, 'second-password-1', 'session');
			await login(ctx, user.email, 'second-password-1');
			await flow.req('PATCH', '/users/me?fields=id', { password: 'third-password-1' }, { cookie: cookiePair(s) });
			await sessions();

			await login(ctx, user.email, 'third-password-1');
			await flow.req('PATCH', `/users/${user.id}?fields=status`, { status: 'suspended' });
			await sessions();
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'sessions');
	});
});

describe('US4.6: the last admin', () => {
	it('deleting or suspending the only active admin: 422 at both apps, nothing changes', async () => {
		await onlyBootstrapAdmin();
		const admin = (await hostDb()('directus_users').where({ email: 'admin@example.com' }).first())!;

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			await flow.req('DELETE', `/users/${admin.id}`);
			await flow.req('PATCH', `/users/${admin.id}?fields=status`, { status: 'suspended' });
			await flow.req('PATCH', '/users/me?fields=status', { status: 'draft' });
			await flow.rows('directus_users', (q) => q.where({ id: admin.id }), { columns: ['id', 'status'] });
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'last admin user');
		expect((transcripts.backoffice as any[])[0].response.status).toBe(422);
	});
});

describe('US4.8: track page', () => {
	it('204 without a permission, no activity; missing last_page 400; no token 401', async () => {
		const prefix = uniqueName('parity-users-page');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const user = await createUser('directus', `${prefix}-${ctx.app}`, { role: null });
			flow.name(user.id, 'user');
			flow.name(user.email, 'email');
			const headers = { authorization: `Bearer ${user.token}` };

			await flow.req('PATCH', '/users/me/track/page', { last_page: '/content/articles' }, headers);
			await flow.req('PATCH', '/users/me/track/page', {}, headers);
			await flow.req('PATCH', '/users/me/track/page', { last_page: '/x' }, {});
			await flow.rows('directus_users', (q) => q.where({ id: user.id }), { columns: ['last_page'] });
			await flow.activity();
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'track page');
	});
});

describe.runIf(suite === 'full' && profileUrls('user-limits'))('US4.7: user limits (profile user-limits)', () => {
	it('creating active users over USERS_*_ACCESS_LIMIT: 403 LIMIT_EXCEEDED with the same category', async () => {
		const pair = profileUrls('user-limits')!;
		const profile = { directus: pair.directusUrl!, backoffice: pair.backofficeUrl! };
		const prefix = uniqueName('parity-users-limits');
		const admins = await createPolicy('directus', `${prefix}-admin`, { admin: true });
		const apps = await createPolicy('directus', `${prefix}-app`, { app: true });
		const { leaf: adminRole } = await createRoleTree('directus', `${prefix}-admin`);
		const { leaf: appRole } = await createRoleTree('directus', `${prefix}-app`);
		await attachPolicy('directus', admins, { role: adminRole });
		await attachPolicy('directus', apps, { role: appRole });

		const transcripts = await scenario(profile, async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;

			// Over each limit: the counts include the users already there, so one of these is refused at the latest.
			for (const [kind, role] of [
				['admin', adminRole],
				['app', appRole],
				['api', null],
			] as const) {
				for (let i = 0; i < 4; i++) {
					await flow.req('POST', '/users?fields=email', { email: `${name}-${kind}-${i}@example.com`, role });
				}
			}

			await flow.req('PATCH', '/users?fields=email', {
				query: { filter: { email: { _starts_with: name } } },
				data: { status: 'suspended' },
			});
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'user limits');
		const codes = (transcripts.backoffice as any[]).map((e) => e.response?.body?.errors?.[0]?.extensions);
		expect(codes.some((e) => e?.code === 'LIMIT_EXCEEDED')).toBe(true);
	});
});
