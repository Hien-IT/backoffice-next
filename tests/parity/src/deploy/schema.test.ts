// Feature 019, US4 (FR-063): a schema, permission or item change at one instance shows at every other instance on the
// first request after the response of the change, with no wait for a cache TTL.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminToken, api, directusUrl, instanceUrls, SEPARATE } from './instances.js';

const run = randomUUID().slice(0, 8);
const collection = `bo_deploy_${run}`;
let urls: string[];
let admin: string;
const cleanup: (() => Promise<unknown>)[] = [];

beforeAll(async () => {
	urls = instanceUrls();
	admin = await adminToken(directusUrl);
});

afterAll(async () => {
	for (const step of cleanup.reverse()) await step();
});

describe.skipIf(SEPARATE)('changes at one instance, seen at the others', () => {
	it('a new collection and a new field', async () => {
		const created = await api(urls[0]!, 'POST', '/collections', {
			token: admin,
			body: {
				collection,
				schema: {},
				meta: {},
				fields: [{ field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } }],
			},
		});
		expect(created.status).toBe(200);
		cleanup.push(() => api(directusUrl, 'DELETE', `/collections/${collection}`, { token: admin }));
		for (const url of [urls[1]!, urls[2]!, directusUrl]) {
			expect((await api(url, 'GET', `/collections/${collection}`, { token: admin })).status, url).toBe(200);
			expect((await api(url, 'GET', `/fields/${collection}`, { token: admin })).status, url).toBe(200);
		}

		const field = await api(directusUrl, 'POST', `/fields/${collection}`, {
			token: admin,
			body: { field: 'title', type: 'string' },
		});
		expect(field.status).toBe(200);
		for (const url of urls.slice(0, 3))
			expect((await api(url, 'GET', `/fields/${collection}/title`, { token: admin })).status, url).toBe(200);
	});

	it('a permission set at Directus applies at a BE replica', async () => {
		const policy = await api(directusUrl, 'POST', '/policies', {
			token: admin,
			body: { name: `deploy ${run}`, app_access: false, admin_access: false },
		});
		const role = await api(directusUrl, 'POST', '/roles', { token: admin, body: { name: `deploy ${run}` } });
		await api(directusUrl, 'POST', '/access', {
			token: admin,
			body: { role: role.body.data.id, policy: policy.body.data.id },
		});
		const email = `deploy-${run}@example.com`;
		const user = await api(directusUrl, 'POST', '/users', {
			token: admin,
			body: { email, password: run, role: role.body.data.id },
		});
		cleanup.push(
			() => api(directusUrl, 'DELETE', `/users/${user.body.data.id}`, { token: admin }),
			() => api(directusUrl, 'DELETE', `/roles/${role.body.data.id}`, { token: admin }),
			() => api(directusUrl, 'DELETE', `/policies/${policy.body.data.id}`, { token: admin }),
		);
		const token = (await api(urls[0]!, 'POST', '/auth/login', { body: { email, password: run } })).body.data
			.access_token;

		expect((await api(urls[0]!, 'GET', `/items/${collection}`, { token })).status).toBe(403);
		const perm = await api(directusUrl, 'POST', '/permissions', {
			token: admin,
			body: { policy: policy.body.data.id, collection, action: 'read', fields: ['*'] },
		});
		expect(perm.status).toBe(200);
		for (const url of urls.slice(0, 3))
			expect((await api(url, 'GET', `/items/${collection}`, { token })).status, url).toBe(200);
	});

	it('an item changed at one replica is not served stale from the shared response cache', async () => {
		const item = await api(urls[0]!, 'POST', `/items/${collection}`, { token: admin, body: { title: 'before' } });
		const id = item.body.data.id;
		for (let i = 0; i < 2; i++) await api(urls[0]!, 'GET', `/items/${collection}/${id}`, { token: admin });
		await api(urls[1]!, 'PATCH', `/items/${collection}/${id}`, { token: admin, body: { title: 'after' } });
		for (const url of [urls[0]!, urls[2]!, directusUrl]) {
			const read = await api(url, 'GET', `/items/${collection}/${id}`, { token: admin });
			expect(read.body.data.title, url).toBe('after');
		}
	});
});
