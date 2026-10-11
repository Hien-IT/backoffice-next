// Feature 004, US6.1 to US6.5: what a client learns about its own permissions (GET /permissions/me,
// GET /permissions/me/:collection/:pk?, GET /policies/me/globals). Reads only: the same token goes to both apps at once
// (parity()); fixtures are made at Directus.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appRequest, appUrl } from '../directus-api.js';
import { assertParity, capture, parity, type ParityRequest } from '../parity.js';
import {
	attachPolicy,
	cleanup,
	createPolicy,
	createRoleTree,
	createShare,
	createUser,
	createUserCollection,
	type TestUser,
} from './fixtures.js';

const get = (path: string, headers: Record<string, string> = {}): ParityRequest => ({ method: 'GET', path, headers });
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

async function same(req: ParityRequest) {
	const result = await parity(req);
	assertParity(result);
	return result.backoffice.json as any;
}

let admin: string;
let partial: TestUser;

beforeAll(async () => {
	const login = await capture(appUrl('directus'), {
		method: 'POST',
		path: '/auth/login',
		body: { email: 'admin@example.com', password: 'password' },
	});

	admin = (login.json as any).data.access_token;

	// US6.2: read with a filter, create without one, presets of two policies merged in policy order.
	const { leaf } = await createRoleTree('directus', 'parity-me-partial');

	await attachPolicy(
		'directus',
		await createPolicy('directus', 'parity-me-partial-1', {
			app: true,
			permissions: [
				{
					collection: 'directus_roles',
					action: 'read',
					fields: ['id', 'name'],
					permissions: { name: { _contains: 'me' } },
				},
				{ collection: 'directus_roles', action: 'create', fields: ['name'], permissions: {}, presets: { icon: 'one' } },
			],
		}),
		{ role: leaf },
	);

	await attachPolicy(
		'directus',
		await createPolicy('directus', 'parity-me-partial-2', {
			permissions: [
				{
					collection: 'directus_roles',
					action: 'create',
					fields: ['icon'],
					permissions: {},
					presets: { icon: 'two', description: 'd' },
				},
				{
					collection: 'directus_settings',
					action: 'update',
					fields: ['project_name', 'project_color'],
					permissions: {},
					presets: { project_color: '#000000' },
				},
			],
		}),
		{ role: leaf },
	);

	partial = await createUser('directus', 'parity-me-partial', { role: leaf });
}, 60_000);

afterAll(cleanup, 60_000);

describe('GET /permissions/me', () => {
	it('US6.1: admin, every collection with every action', async () => {
		const data = (await same(get('/permissions/me', bearer(admin)))).data;

		expect(data['directus_users']).toMatchObject({ read: { access: 'full', fields: ['*'] } });
		expect(data['directus_settings']).toMatchObject({ update: { access: 'full' } });
	});

	it('US6.2: partial read, full create, merged fields and presets', async () => {
		const data = (await same(get('/permissions/me', bearer(partial.token)))).data;

		expect(data['directus_roles']).toMatchObject({ read: { access: 'partial' }, create: { access: 'full' } });
	});

	it('US6.3: no token 403 at /permissions/me and /permissions/me/:collection/:pk; app_access false at globals', async () => {
		expect((await same(get('/permissions/me'))).errors[0].extensions.code).toBe('FORBIDDEN');
		expect((await same(get('/permissions/me/directus_roles/abc'))).errors[0].extensions.code).toBe('FORBIDDEN');
		expect(await same(get('/policies/me/globals'))).toEqual({ data: { app_access: false } });
	});

	it('a share token', async () => {
		const collection = await createUserCollection(`parity_me_share_${Date.now().toString(36)}`);
		const item = (await appRequest('directus', 'POST', `/items/${collection}`, {})).data.id;
		const share = await createShare(collection, item);
		const auth = await capture(appUrl('directus'), { method: 'POST', path: '/shares/auth', body: { share } });
		const token = (auth.json as any).data.access_token;

		await same(get('/permissions/me', bearer(token)));
		await same(get(`/permissions/me/${collection}/${item}`, bearer(token)));
		await same(get('/policies/me/globals', bearer(token)));
	});
});

describe('GET /permissions/me/:collection/:pk?', () => {
	it('US6.5: the singleton directus_settings with fields and presets of update', async () => {
		const data = (await same(get('/permissions/me/directus_settings', bearer(partial.token)))).data;
		expect(data).toMatchObject({ update: { access: true } });
	});

	it('a collection, an item, an unknown collection, as admin and as the partial user', async () => {
		for (const headers of [bearer(admin), bearer(partial.token)]) {
			await same(get('/permissions/me/directus_roles', headers));
			await same(get(`/permissions/me/directus_users/${partial.id}`, headers));
			await same(get('/permissions/me/not_a_collection', headers));
		}
	});
});

describe('US6.4: enforce_tfa in GET /policies/me/globals', () => {
	it('through a parent role, attached to the user, and filtered out by ip_access', async () => {
		const tree = await createRoleTree('directus', 'parity-me-tfa');
		await attachPolicy('directus', await createPolicy('directus', 'parity-me-tfa-root', { enforceTfa: true }), {
			role: tree.root,
		});

		const viaRole = await createUser('directus', 'parity-me-tfa-role', { role: tree.leaf });
		const viaUser = await createUser('directus', 'parity-me-tfa-user', { role: null });
		await attachPolicy('directus', await createPolicy('directus', 'parity-me-tfa-user', { enforceTfa: true }), {
			user: viaUser.id,
		});

		const filtered = await createUser('directus', 'parity-me-tfa-ip', { role: null });
		await attachPolicy(
			'directus',
			await createPolicy('directus', 'parity-me-tfa-ip', { enforceTfa: true, ipAccess: ['10.99.0.0/16'] }),
			{ user: filtered.id },
		);

		for (const [user, expected] of [
			[viaRole, true],
			[viaUser, true],
			[filtered, false],
		] as const) {
			const body = await same(get('/policies/me/globals', { ...bearer(user.token), 'x-forwarded-for': '10.98.0.1' }));
			expect(body.data.enforce_tfa).toBe(expected);
		}

		const inRange = await same(
			get('/policies/me/globals', { ...bearer(filtered.token), 'x-forwarded-for': '10.99.1.1' }),
		);
		expect(inRange.data.enforce_tfa).toBe(true);
	});
});
