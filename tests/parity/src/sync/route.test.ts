// Spec 032 (D-214, FR-001, FR-037, contracts/tests.md §2a): the environment sync routes exist at Backoffice only. Runs
// on the main pair with every vendor of the reduced suite (the other sync files need profile sync).
import { afterAll, beforeAll, expect, test } from 'vitest';
import { appRequest, appUrl } from '../directus-api.js';

const ROUTES = [
	['GET', '/backoffice/sync'],
	['GET', '/backoffice/sync/state'],
	['POST', '/backoffice/sync/diff'],
	['POST', '/backoffice/sync/apply'],
] as const;

const USER_TOKEN = `sync-route-user-${Date.now()}`;
let userId: string | undefined;

beforeAll(async () => {
	const created = await appRequest('backoffice', 'POST', '/users', {
		email: `sync-route-${Date.now()}@example.com`,
		password: 'sync-route-password',
		token: USER_TOKEN,
	});

	userId = created.data.id;
});

afterAll(async () => {
	if (userId) await appRequest('backoffice', 'DELETE', `/users/${userId}`);
});

const call = (app: 'directus' | 'backoffice', method: string, path: string, token?: string) =>
	fetch(new URL(path, appUrl(app)), {
		method,
		headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
		...(method === 'POST' ? { body: '{}' } : {}),
	});

test('D-214: Directus answers 404 ROUTE_NOT_FOUND on every sync route, even to its admin', async () => {
	const { adminToken } = await import('../directus-api.js');
	const token = await adminToken('directus');

	for (const [method, path] of ROUTES) {
		const res = await call('directus', method, path, token);
		expect(res.status, `${method} ${path}`).toBe(404);
		expect(((await res.json()) as any).errors[0].extensions.code).toBe('ROUTE_NOT_FOUND');
	}
});

test('Backoffice: GET /backoffice/sync answers the instance info to the admin, 403 to a user, 401 without a token', async () => {
	const info = await appRequest('backoffice', 'GET', '/backoffice/sync');
	expect(info.data).toMatchObject({
		directus: '11.17.4',
		migrations: { directus: expect.any(Array), backoffice: expect.any(Array) },
	});
	expect(typeof info.data.backoffice).toBe('string');
	expect(typeof info.data.vendor).toBe('string');

	// Wave 1 serves the read routes; POST /backoffice/sync/apply joins in wave 2 (tasks.md T032).
	for (const [method, path] of ROUTES.filter(([, path]) => path !== '/backoffice/sync/apply')) {
		expect((await call('backoffice', method, path, USER_TOKEN)).status, `${method} ${path} user`).toBe(403);
		expect((await call('backoffice', method, path)).status, `${method} ${path} anonymous`).toBe(401);
	}
});

test('FR-037: the sync routes are REST only, not in the OpenAPI document', async () => {
	const oas = await appRequest('backoffice', 'GET', '/server/specs/oas');
	expect(JSON.stringify(oas)).not.toContain('/backoffice/sync');
});
