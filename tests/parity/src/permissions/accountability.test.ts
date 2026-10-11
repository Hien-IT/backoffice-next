// Feature 004, US1.1 to US1.3, US1.6, US1.7 (US1.4, US1.5 are in server-routes.test.ts): the accountability of a
// request (user, role tree, admin and app recomputed from the policies at each request, share) seen through
// GET /users/me, GET /roles/me and GET /policies/me/globals. The reads write nothing, so the same token goes to both
// apps at once (parity()); fixtures and data changes are made at Directus, which clears the shared caches.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cookiePair } from '../auth/flows.js';
import { signAccessToken } from '../auth/tokens.js';
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
	type RoleTree,
	type TestUser,
} from './fixtures.js';

const ME = ['/users/me', '/roles/me', '/policies/me/globals'];

const get = (path: string, headers: Record<string, string> = {}): ParityRequest => ({ method: 'GET', path, headers });
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

async function same(req: ParityRequest) {
	const result = await parity(req);
	assertParity(result);
	return result;
}

/** Every `me` route with these headers (or query) gives the same answer at both apps; returns the Directus bodies. */
async function sameMe(headers: Record<string, string> = {}, query = ''): Promise<Record<string, any>> {
	const out: Record<string, any> = {};
	for (const path of ME) out[path] = (await same(get(`${path}${query}`, headers))).directus.json;
	return out;
}

async function login(user: TestUser, mode: 'json' | 'cookie' | 'session') {
	return capture(appUrl('directus'), {
		method: 'POST',
		path: '/auth/login',
		body: { email: user.email, password: user.password, mode },
	});
}

const accessToken = async (user: TestUser) => ((await login(user, 'json')).json as any).data.access_token as string;

let tree: RoleTree;
let user: TestUser;

beforeAll(async () => {
	// No policy on the tree: reading directus_roles is refused (with app access the minimal app permissions allow it).
	tree = await createRoleTree('directus', 'parity-us1');
	user = await createUser('directus', 'parity-us1', { role: tree.leaf });
}, 60_000);

afterAll(cleanup, 60_000);

describe('ways of sending a token', () => {
	it('no token: 401 at /users/me, 403 at /roles/me, app_access false at /policies/me/globals', async () => {
		const bodies = await sameMe();

		expect(bodies['/users/me'].errors[0].extensions.code).toBe('INVALID_CREDENTIALS');
		expect(bodies['/roles/me'].errors[0].extensions.code).toBe('FORBIDDEN');
		expect(bodies['/policies/me/globals']).toEqual({ data: { app_access: false } });
	});

	it('JWT of the three login modes, static token', async () => {
		await sameMe(bearer(await accessToken(user)));
		await sameMe({}, `?access_token=${((await login(user, 'cookie')).json as any).data.access_token}`);

		await sameMe({ cookie: cookiePair(await login(user, 'session')) });

		await sameMe(bearer(user.token));
	});
});

describe('US1.1: role tree', () => {
	it('without read permission on directus_roles: one {id} per role, root first', async () => {
		const bodies = await sameMe(bearer(user.token));

		expect(bodies['/roles/me']).toEqual({ data: [{ id: tree.root }, { id: tree.middle }, { id: tree.leaf }] });
		expect(bodies['/policies/me/globals']).toEqual({
			data: { app_access: false, admin_access: false, enforce_tfa: false },
		});
	});

	it('with read permission on directus_roles: the three roles, query applied but not the limit', async () => {
		const reader = await createUser('directus', 'parity-us1-reader', { role: tree.leaf });

		const policy = await createPolicy('directus', 'parity-us1-roles', {
			permissions: [
				{ collection: 'directus_roles', action: 'read', fields: ['id', 'name', 'parent'], permissions: {} },
			],
		});

		await attachPolicy('directus', policy, { user: reader.id });

		const bodies = await sameMe(bearer(reader.token), '?fields=id,parent&limit=1');

		// Read back by primary key, so in the order of the ids, not of the tree.
		const byId = (rows: any[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
		expect(byId(bodies['/roles/me'].data)).toEqual(
			byId([
				{ id: tree.root, parent: null },
				{ id: tree.middle, parent: tree.root },
				{ id: tree.leaf, parent: tree.middle },
			]),
		);

		// A field outside the permission: the read is refused and both apps fall back to the ids.
		await sameMe(bearer(reader.token), '?fields=description');
	});

	it('with app access: the minimal app permissions allow reading the own roles', async () => {
		const appTree = await createRoleTree('directus', 'parity-us1-app');
		const appPolicy = await createPolicy('directus', 'parity-us1-app', { app: true });
		await attachPolicy('directus', appPolicy, { role: appTree.middle });
		const appUser = await createUser('directus', 'parity-us1-app', { role: appTree.leaf });

		const bodies = await sameMe(bearer(appUser.token), '?fields=id,name');
		expect(bodies['/roles/me'].data).toHaveLength(3);
		expect(bodies['/policies/me/globals'].data).toMatchObject({ app_access: true });
	});
});

describe('US1.2, US1.3: admin recomputed from the policies at each request', () => {
	it('an admin policy attached to the user only wins over the admin_access: false claim', async () => {
		const admin = await createUser('directus', 'parity-us1-admin', { role: tree.leaf });
		await attachPolicy('directus', await createPolicy('directus', 'parity-us1-admin', { admin: true }), {
			user: admin.id,
		});

		const token = signAccessToken({ id: admin.id, role: tree.leaf, app_access: false, admin_access: false });
		const bodies = await sameMe(bearer(token), '?fields=id,email');

		expect(bodies['/users/me']).toEqual({ data: { id: admin.id, email: admin.email } });
		expect(bodies['/policies/me/globals'].data).toMatchObject({ admin_access: true });
	});

	it('removing the admin policy takes effect with the same unexpired token', async () => {
		const { root } = await createRoleTree('directus', 'parity-us1-demote');
		const admin = await createUser('directus', 'parity-us1-demote', { role: root });
		const access = await attachPolicy(
			'directus',
			await createPolicy('directus', 'parity-us1-demote', { admin: true }),
			{ role: root },
		);

		const token = await accessToken(admin);
		expect((await sameMe(bearer(token)))['/policies/me/globals'].data).toMatchObject({ admin_access: true });

		await appRequest('directus', 'DELETE', `/access/${access}`);

		const after = await sameMe(bearer(token));
		expect(after['/policies/me/globals'].data).toMatchObject({ admin_access: false });
		expect(after['/users/me']).toEqual({ data: { id: admin.id } });
	});
});

describe('US1.6: share token', () => {
	it('GET /users/me answers the share, the other me routes like Directus', async () => {
		const collection = await createUserCollection(`parity_us1_share_${Date.now().toString(36)}`);
		const item = (await appRequest('directus', 'POST', `/items/${collection}`, {})).data.id;
		const share = await createShare(collection, item);

		const auth = await capture(appUrl('directus'), { method: 'POST', path: '/shares/auth', body: { share } });
		const bodies = await sameMe(bearer((auth.json as any).data.access_token));

		expect(bodies['/users/me']).toEqual({ data: { share } });
	});
});

describe('US1.7: role changed while a token is still valid', () => {
	it('the JWT keeps the role of its claim, the static token follows the new role', async () => {
		const other = await createRoleTree('directus', 'parity-us1-move');
		const mover = await createUser('directus', 'parity-us1-move', { role: tree.leaf });
		const token = await accessToken(mover);

		await appRequest('directus', 'PATCH', `/users/${mover.id}`, { role: other.leaf });

		const jwtBodies = await sameMe(bearer(token));
		expect(jwtBodies['/roles/me']).toEqual({ data: [{ id: tree.root }, { id: tree.middle }, { id: tree.leaf }] });

		// Both apps cache responses per user, path and query (CACHE_ENABLED, feature 005): each call of the same user
		// uses another query so the answer comes from the accountability, not from that cache.
		const staticBodies = await sameMe(bearer(mover.token), '?fields=id');
		expect(staticBodies['/roles/me']).toEqual({ data: [{ id: other.root }, { id: other.middle }, { id: other.leaf }] });

		const refreshed = await accessToken(mover);
		expect((await sameMe(bearer(refreshed), '?fields=id,name'))['/roles/me']).toEqual(staticBodies['/roles/me']);
	});
});
