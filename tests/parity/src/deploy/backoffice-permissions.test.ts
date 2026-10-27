// Spec 025 (US6, FR-013, FR-031, D-189.7): deploy/compose with BACKOFFICE_REPLICAS BE replicas and Directus. An export
// permission written at one replica applies to the next request at another, and its removal too (FR-013); the lb sends
// /permissions/me and /backoffice/* to the BE replicas only (shared domain), like /extensions/sources/ of spec 020.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminToken, api, compose, directusUrl, lbLog, lbUrl, replicaUrl, SEPARATE, STANDALONE } from './instances.js';

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

	// Directus would answer /permissions/me without import and export, and has no /backoffice/permissions (D-189.7).
	it.skipIf(SEPARATE || STANDALONE)(
		'/permissions/me and /backoffice/* go to the BE replicas only (FR-031)',
		async () => {
			const since = new Date().toISOString();
			const paths = ['/permissions/me', '/backoffice/permissions?limit=1'];

			for (let i = 0; i < 8; i++) {
				for (const path of paths) expect((await api(lbUrl, 'GET', path, { token: admin })).status, path).toBe(200);
			}

			const directusIp = compose('exec', '-T', 'directus', 'hostname', '-i').trim().split(/\s+/)[0];
			const lines = lbLog(since).filter((line) => paths.some((path) => line.includes(`"GET ${path}`)));
			expect(lines.length).toBeGreaterThanOrEqual(16);
			expect(lines.filter((line) => line.includes(`${directusIp}:8055`))).toEqual([]);
			// Directus itself still answers its own /permissions/me (unchanged, D-189).
			expect((await api(directusUrl, 'GET', '/permissions/me', { token: admin })).status).toBe(200);
		},
	);
});
