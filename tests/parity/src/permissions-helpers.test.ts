// Unit tests of the feature 004 fixtures (tasks T007), no Docker: fetch is mocked and every request is recorded.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

interface Call {
	method: string;
	url: string;
	auth: string | null;
	body: any;
}

let calls: Call[];
let responder: (call: Call) => { status?: number; body?: unknown };

beforeEach(() => {
	vi.resetModules();
	process.env['DIRECTUS_URL'] = 'http://directus.test';
	process.env['BACKOFFICE_URL'] = 'http://backoffice.test';
	calls = [];
	let id = 0;

	responder = (call) => {
		if (call.url.endsWith('/auth/login'))
			return { body: { data: { access_token: `token-${new URL(call.url).host}` } } };
		if (call.method === 'GET') return { body: { data: [] } };
		if (call.method === 'DELETE') return { status: 204 };
		return { body: { data: { id: `id-${++id}`, ...call.body } } };
	};

	vi.stubGlobal('fetch', async (input: URL | string, init: RequestInit = {}) => {
		const headers = (init.headers ?? {}) as Record<string, string>;
		const call: Call = {
			method: init.method ?? 'GET',
			url: String(input),
			auth: headers['authorization'] ?? null,
			body: init.body ? JSON.parse(String(init.body)) : undefined,
		};

		calls.push(call);
		const { status = 200, body } = responder(call);
		return new Response(body === undefined ? null : JSON.stringify(body), { status });
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const writes = () => calls.filter((c) => !c.url.endsWith('/auth/login') && c.method !== 'GET');

describe('appRequest', () => {
	test('logs in once per app and sends that app its own admin token', async () => {
		const { appRequest } = await import('./directus-api.js');
		await appRequest('backoffice', 'GET', '/roles');
		await appRequest('backoffice', 'GET', '/policies');
		await appRequest('directus', 'GET', '/roles');

		expect(calls.filter((c) => c.url.endsWith('/auth/login')).map((c) => c.url)).toEqual([
			'http://backoffice.test/auth/login',
			'http://directus.test/auth/login',
		]);

		expect(calls.find((c) => c.url === 'http://backoffice.test/policies')?.auth).toBe('Bearer token-backoffice.test');
		expect(calls.find((c) => c.url === 'http://directus.test/roles')?.auth).toBe('Bearer token-directus.test');
	});

	test('throws with status and body on an error response', async () => {
		responder = (call) =>
			call.url.endsWith('/auth/login')
				? { body: { data: { access_token: 't' } } }
				: { status: 403, body: { errors: [] } };

		const { appRequest } = await import('./directus-api.js');
		await expect(appRequest('backoffice', 'GET', '/users')).rejects.toThrow('backoffice GET /users: 403');
	});
});

describe('ported blackbox fixtures', () => {
	test('CreatePermission makes a policy, attaches it to the role, then writes permissions nested in the policy', async () => {
		const { CreatePermission } = await import('./permissions/fixtures.js');

		await CreatePermission('backoffice', {
			role: 'role-1',
			policyName: 'check',
			permissions: [{ collection: 'directus_users', action: 'read', fields: ['id'] }],
		});

		expect(writes().map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
			'POST /policies',
			'POST /access',
			'PATCH /policies/id-1',
		]);

		expect(writes()[0]!.body).toEqual({ name: 'role-1-check', app_access: false, admin_access: false });
		expect(writes()[1]!.body).toEqual({ role: 'role-1', policy: 'id-1' });

		expect(writes()[2]!.body).toEqual({
			permissions: {
				create: [{ collection: 'directus_users', action: 'read', fields: ['id'], policy: 'id-1' }],
				update: [],
				delete: [],
			},
		});
	});

	test('CreateRole and CreatePolicy reuse an existing item with the same name', async () => {
		responder = (call) =>
			call.url.endsWith('/auth/login')
				? { body: { data: { access_token: 't' } } }
				: { body: { data: [{ id: 'existing', name: 'x' }] } };

		const { CreatePolicy, CreateRole } = await import('./permissions/fixtures.js');
		expect(await CreateRole('directus', { name: 'x' })).toEqual({ id: 'existing', name: 'x' });

		expect(await CreatePolicy('directus', { name: 'x', appAccessEnabled: true, adminAccessEnabled: false })).toEqual({
			id: 'existing',
			name: 'x',
		});

		expect(writes()).toEqual([]);
	});
});

describe('feature 004 fixtures', () => {
	test('createRoleTree nests leaf under middle under root', async () => {
		const { createRoleTree } = await import('./permissions/fixtures.js');
		const tree = await createRoleTree('backoffice', 'tree');

		expect(tree).toEqual({ root: 'id-1', middle: 'id-2', leaf: 'id-3' });
		expect(writes().map((c) => c.body.parent)).toEqual([undefined, 'id-1', 'id-2']);
	});

	test('attachPolicy without role and user attaches the policy to the public role', async () => {
		const { attachPolicy } = await import('./permissions/fixtures.js');
		await attachPolicy('directus', 'policy-1', {});
		expect(writes()[0]!.body).toEqual({ policy: 'policy-1', role: null, user: null });
	});

	test('cleanup deletes users, then remaining access, policies, roles (children first), fields, collections', async () => {
		const fixtures = await import('./permissions/fixtures.js');
		await fixtures.createRoleTree('backoffice', 'tree');
		const policy = await fixtures.createPolicy('backoffice', 'p', { app: true });
		await fixtures.attachPolicy('backoffice', policy, { role: 'id-1' });
		await fixtures.createUser('backoffice', 'u', { role: 'id-3' });
		await fixtures.createUserCollection('parity_things');
		await fixtures.createField('directus_users', { field: 'parity_note', type: 'string' });

		// The access row id-5 went away with its policy (ON DELETE CASCADE), so cleanup must not delete it again.
		responder = (call) => {
			if (call.url.endsWith('/auth/login')) return { body: { data: { access_token: 't' } } };

			if (call.method === 'GET') {
				const keys: string[] = JSON.parse(new URL(call.url).searchParams.get('filter') ?? '{}').id?._in ?? [];
				return { body: { data: keys.filter((key) => key !== 'id-5').map((id) => ({ id })) } };
			}

			return { status: 204 };
		};

		calls = [];
		await fixtures.cleanup();

		expect(writes().map((c) => `${c.method} ${new URL(c.url).pathname} ${JSON.stringify(c.body ?? null)}`)).toEqual([
			'DELETE /users ["id-6"]',
			'DELETE /policies ["id-4"]',
			'DELETE /roles ["id-3","id-2","id-1"]',
			'DELETE /fields/directus_users/parity_note null',
			'DELETE /collections/parity_things null',
		]);
	});
});
