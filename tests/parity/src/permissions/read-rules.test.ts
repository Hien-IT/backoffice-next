// Feature 004, US2.1 to US2.3, US2.6 (FR-020 to FR-024): read rules through the five endpoints. Reads write nothing,
// so one request goes to both apps at once (parity()); fixtures are made at Directus.
import { afterAll, describe, expect, it } from 'vitest';
import { appRequest, appUrl } from '../directus-api.js';
import { assertParity, capture, parity, type ParityRequest } from '../parity.js';
import {
	attachPolicy,
	cleanup,
	createPolicy,
	createRoleTree,
	createUser,
	type Permission,
	type TestUser,
} from './fixtures.js';

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const own = { id: { _eq: '$CURRENT_USER' } };

afterAll(cleanup, 60_000);

/** A user whose role holds one policy per entry of `policies`. */
async function userWith(name: string, ...policies: { permissions: Permission[]; app?: boolean }[]): Promise<TestUser> {
	const { leaf } = await createRoleTree('directus', name);

	for (const [i, p] of policies.entries()) {
		await attachPolicy('directus', await createPolicy('directus', `${name}-${i}`, p), { role: leaf });
	}

	return createUser('directus', name, { role: leaf });
}

async function same(path: string, user: TestUser | null) {
	const req: ParityRequest = { path, headers: user ? { authorization: `Bearer ${user.token}` } : {} };
	const result = await parity(req);
	assertParity(result);
	return { status: result.backoffice.status, body: result.backoffice.json as any };
}

describe('US2.1: own row with two fields', () => {
	it('GET /users returns the own row with id and email; password is refused with the Directus message', async () => {
		const user = await userWith('parity-read-own', {
			permissions: [{ collection: 'directus_users', action: 'read', fields: ['id', 'email'], permissions: own }],
		});

		const list = await same('/users', user);
		expect(list.body.data).toEqual([{ id: user.id, email: user.email }]);

		const password = await same('/users?fields=password', user);
		expect(password.status).toBe(403);
		expect(password.body.errors[0].message).toBe(
			'You don\'t have permission to access field "password" in collection "directus_users" or it does not exist. Queried in root.',
		);

		await same(`/users/${user.id}?fields=*`, user);
		await same('/users?fields=id,role.name', user);
		await same('/users?meta=*', user);
	});
});

describe('US2.2: two policies on the same collection and action (CASE WHEN)', () => {
	it('every row is returned; the field of the filtered policy is null on rows outside its filter', async () => {
		const marker = `parity-read-case-${Date.now().toString(36)}`;

		for (const suffix of ['pub-a', 'pub-b', 'other']) {
			await createRoleTree('directus', `${marker}-${suffix}`);
		}

		const user = await userWith(
			'parity-read-case',
			{
				permissions: [
					{
						collection: 'directus_roles',
						action: 'read',
						fields: ['id', 'name'],
						permissions: { name: { _starts_with: marker } },
					},
				],
			},
			{
				permissions: [
					{
						collection: 'directus_roles',
						action: 'read',
						fields: ['id', 'name', 'icon', 'description'],
						permissions: { name: { _starts_with: `${marker}-pub` } },
					},
				],
			},
		);

		const { body } = await same(
			`/roles?fields=name,icon&sort=name&filter=${json({ name: { _starts_with: marker } })}`,
			user,
		);
		const rows = body.data as { name: string; icon: string | null }[];

		expect(rows.length).toBe(9);
		expect(rows.filter((r) => r.name.includes('-pub-')).every((r) => r.icon !== null)).toBe(true);
		expect(rows.filter((r) => r.name.includes('-other-')).every((r) => r.icon === null)).toBe(true);

		// Filtering and sorting on a field allowed by one policy only, aggregates and meta.
		await same(`/roles?fields=name&filter=${json({ icon: { _nnull: true } })}&sort=-icon,name&meta=*`, user);
		await same(`/roles?aggregate[count]=icon&groupBy[]=icon`, user);
	});
});

describe('US2.3: $NOW(-1 day)', () => {
	it('rows far from the boundary: the same set at both apps', async () => {
		const user = await userWith('parity-read-now', {
			permissions: [
				{
					collection: 'directus_users',
					action: 'read',
					fields: ['id', 'email'],
					permissions: { last_access: { _gte: '$NOW(-1 day)' } },
				},
			],
		});

		// A login sets last_access of the user now; the other users of the run have none.
		await capture(appUrl('directus'), {
			method: 'POST',
			path: '/auth/login',
			body: { email: user.email, password: user.password },
		});

		const { body } = await same('/users?fields=id&sort=id&limit=-1', user);
		expect(body.data.map((r: any) => r.id)).toContain(user.id);
	});
});

describe('US2.6, FR-023: reading by key', () => {
	const COLLECTION_MESSAGE =
		'You don\'t have permission to access collection "directus_roles" or it does not exist. Queried in root.';

	it('without read permission: the collection message, whether the key exists or not', async () => {
		const user = await userWith('parity-read-none', { permissions: [] });
		const { data: role } = await appRequest('directus', 'GET', '/roles?limit=1&fields=id');

		for (const path of [`/roles/${role[0].id}`, '/roles/00000000-0000-4000-8000-000000000000', '/roles?fields=id']) {
			const answer = await same(path, user);
			expect(answer.status).toBe(403);
			expect(answer.body.errors[0].message).toBe(COLLECTION_MESSAGE);
		}
	});

	it("with a read permission whose filter leaves the row out: You don't have permission to access this.", async () => {
		const user = await userWith('parity-read-filtered', {
			permissions: [
				{ collection: 'directus_roles', action: 'read', fields: ['*'], permissions: { name: { _eq: 'none' } } },
			],
		});
		const { data: role } = await appRequest('directus', 'GET', '/roles?limit=1&fields=id');

		for (const path of [`/roles/${role[0].id}`, '/roles/00000000-0000-4000-8000-000000000000']) {
			const answer = await same(path, user);
			expect(answer.status).toBe(403);
			expect(answer.body.errors[0].message).toBe("You don't have permission to access this.");
		}
	});
});

describe('FR-020 to FR-024: fields, rows, nulls, order', () => {
	it('* expands to the readable fields only; relations without permission are dropped from *', async () => {
		const user = await userWith('parity-read-star', {
			permissions: [{ collection: 'directus_users', action: 'read', fields: ['*'], permissions: own }],
		});

		for (const fields of ['*', '*.*', 'role.*', '*,role.name', 'policies.*']) {
			await same(`/users?fields=${fields}`, user);
		}
	});

	it('default order without sort, limit, offset and page; meta of a user without admin', async () => {
		const user = await userWith('parity-read-order', {
			app: true,
			permissions: [{ collection: 'directus_roles', action: 'read', fields: ['*'], permissions: {} }],
		});

		for (const query of [
			'',
			'?limit=2',
			'?limit=2&offset=1',
			'?limit=2&page=2',
			'?meta=*',
			'?meta=filter_count&search=parity',
		]) {
			await same(`/roles${query}`, user);
		}
	});

	it('public: no permission at all, then the same answers for every endpoint', async () => {
		for (const path of ['/users', '/roles', '/policies', '/access', '/permissions', '/users/me', '/roles/me']) {
			await same(path, null);
		}
	});
});
