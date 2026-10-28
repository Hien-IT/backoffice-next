// Spec 025 (US6, FR-013, FR-031): deploy/compose with BACKOFFICE_REPLICAS BE replicas and Directus. An export
// permission written at one replica applies to the next request at another, and its removal too (FR-013); at the
// Backoffice domain /permissions/me and /backoffice/* are answered by a BE replica (spec 026 FR-009: every path of that
// domain reaches the BE; the lb route of D-189.7 is gone).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminToken, api, boLbUrl, directusUrl, replicaUrl, STANDALONE } from './instances.js';

const COLLECTION = 'bo_deploy_permissions';
const EMAIL = 'bo-deploy-permissions@example.com';
const PASSWORD = 'bo-deploy-Password1';

let admin: string;
let policy: string;
let user: string;

beforeAll(async () => {
	admin = await adminToken(replicaUrl(1));
	const call = async (method: string, path: string, body?: unknown) => {
		const res = await api(replicaUrl(1), method, path, { token: admin, body });
		expect(res.status, `${method} ${path}`).toBeLessThan(300);
		return res.body?.data;
	};

	await call('POST', '/collections', {
		collection: COLLECTION,
		schema: {},
		meta: {},
		fields: [{ field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } }],
	});
	await call('POST', `/items/${COLLECTION}`, {});
	policy = (await call('POST', '/policies', { name: COLLECTION, app_access: false, admin_access: false })).id;
	await call('POST', '/permissions', { policy, collection: COLLECTION, action: 'read', fields: ['*'] });
	user = (await call('POST', '/users', { email: EMAIL, password: PASSWORD, status: 'active' })).id;
	await call('POST', '/access', { user, policy });
}, 120_000);

afterAll(async () => {
	// Through a BE replica: the policy and the collection take their backoffice_permissions rows with them (FR-021).
	for (const path of [`/users/${user}`, `/policies/${policy}`, `/collections/${COLLECTION}`]) {
		await api(replicaUrl(1), 'DELETE', path, { token: admin });
	}
});

describe('backoffice_permissions on several replicas (spec 025)', () => {
	it('an export permission written at one replica applies to the next request at another, and its removal (FR-013)', async () => {
		const login = await api(replicaUrl(1), 'POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
		const token = login.body.data.access_token as string;
		const exportAt = async (index: number) =>
			(await api(replicaUrl(index), 'GET', `/items/${COLLECTION}?export=csv`, { token })).status;

		expect(await exportAt(2)).toBe(403);

		const granted = await api(replicaUrl(1), 'POST', '/backoffice/permissions', {
			token: admin,
			body: { policy, collection: COLLECTION, action: 'export' },
		});
		expect(granted.status).toBe(200);
		expect(await exportAt(2)).toBe(200);

		const removed = await api(replicaUrl(2), 'DELETE', `/backoffice/permissions/${granted.body.data.id}`, {
			token: admin,
		});
		expect(removed.status).toBe(204);
		expect(await exportAt(1)).toBe(403);
	});

	// Directus has no /backoffice/permissions (D-189.6): a 200 at the Backoffice domain proves a BE replica answered.
	it('answers /permissions/me and /backoffice/* at the Backoffice domain (FR-031, spec 026 FR-009)', async () => {
		for (let i = 0; i < 8; i++) {
			for (const path of ['/permissions/me', '/backoffice/permissions?limit=1']) {
				expect((await api(boLbUrl, 'GET', path, { token: admin })).status, path).toBe(200);
			}
		}
	});

	it.skipIf(STANDALONE)('Directus itself still answers its own /permissions/me (D-189)', async () => {
		expect((await api(directusUrl, 'GET', '/permissions/me', { token: admin })).status).toBe(200);
	});
});
