// GET /roles/me end to end (pipeline, authenticate, permission engine) on the SQLite auth test database (task T037).
// Parity with Directus is checked by tests/parity/src/permissions/accountability.test.ts.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { type App, createApp } from '../app.js';
import { clearSystemCache } from '../cache.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

vi.mock('@backoffice/env', async (importOriginal) => {
	const actual = await importOriginal<typeof env>();
	return { ...actual, useEnv: vi.fn(actual.useEnv) };
});

vi.mock('../database/index.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../database/index.js')>();
	return { ...original, default: () => state.db, getDatabase: () => state.db, getDatabaseClient: () => 'sqlite' };
});

vi.mock('../schema/get-database-schema.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../schema/get-database-schema.js')>();
	return { ...original, getSchema: () => original.getDatabaseSchema(state.db, createInspector(state.db)) };
});

vi.mock('../logger/index.js', () => {
	const logger = { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn(), fatal: vi.fn(), trace: vi.fn() };
	return {
		useLogger: () => logger,
		createExpressLogger: () => (_req: unknown, _res: unknown, next: () => void) => next(),
	};
});

const defaults = (await vi.importActual<typeof env>('@backoffice/env')).useEnv();

const SECRET = 'test-secret';
const ROLE = 'a0000000-0000-4000-8000-000000000001';
const POLICY = 'b0000000-0000-4000-8000-000000000001';
const PARENT = 'a0000000-0000-4000-8000-000000000002';
const USER = 'd0000000-0000-4000-8000-000000000001';

let app: App;

async function start() {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET });
	app = await createApp();
	return request(app.express);
}

const token = (claims: Record<string, unknown> = { id: USER, role: ROLE }) =>
	`Bearer ${jwt.sign({ app_access: false, admin_access: false, ...claims }, SECRET, { issuer: 'directus' })}`;

beforeEach(async () => {
	state.db = await createAuthDb();
	await state.db('directus_roles').insert([
		{ id: PARENT, name: 'Staff' },
		{ id: ROLE, name: 'Editor', parent: PARENT },
	]);
	await state.db('directus_policies').insert({ id: POLICY, name: 'Editor' });
	await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000001', role: ROLE, policy: POLICY });
	await state.db('directus_users').insert({ id: USER, email: 'user@example.com', first_name: 'Ann', role: ROLE });
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

test('no user and no role: 403 FORBIDDEN', async () => {
	const res = await (await start()).get('/roles/me');

	expect(res.status).toBe(403);
	expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
});

test('without read permission on directus_roles: the ids of the role tree, root first', async () => {
	const res = await (await start()).get('/roles/me').set('Authorization', token());

	expect(res.status).toBe(200);
	expect(res.body).toEqual({ data: [{ id: PARENT }, { id: ROLE }] });
});

test('with a read permission: the roles of the tree, the query limit ignored', async () => {
	await state.db('directus_permissions').insert({
		collection: 'directus_roles',
		action: 'read',
		fields: '*',
		permissions: '{}',
		policy: POLICY,
	});

	const res = await (await start()).get('/roles/me?fields=name&sort=name&limit=1').set('Authorization', token());

	expect(res.body).toEqual({ data: [{ name: 'Editor' }, { name: 'Staff' }] });
});

test('OPTIONS lists the methods of every Directus route matching /roles/me', async () => {
	expect((await (await start()).options('/roles/me')).headers['allow']).toBe('GET,HEAD,PATCH,DELETE');
});

describe('CRUD as admin (routes in the order of the Directus router)', () => {
	const ADMIN = 'd0000000-0000-4000-8000-000000000009';
	const admin = () => token({ id: ADMIN, role: null });

	beforeEach(async () => {
		const policy = 'b0000000-0000-4000-8000-000000000009';
		await state.db('directus_policies').insert({ id: policy, name: 'Admin', admin_access: true, app_access: true });
		await state.db('directus_users').insert({ id: ADMIN, email: 'admin@example.com' });
		await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000009', user: ADMIN, policy });
	});

	test('POST one and many: 200 with the rows read back', async () => {
		const agent = await start();

		const one = await agent.post('/roles?fields=name').set('Authorization', admin()).send({ name: 'One' });
		expect(one.status).toBe(200);
		expect(one.body).toEqual({ data: { name: 'One' } });

		const many = await agent
			.post('/roles?fields=name')
			.set('Authorization', admin())
			.send([{ name: 'Two' }, { name: 'Three' }]);

		// Read back by primary key (random UUIDs), not in the order of the payload.
		expect(many.body.data.map((r: any) => r.name).sort()).toEqual(['Three', 'Two']);
	});

	test('GET and SEARCH: rows and meta; SEARCH reads the query of the body, not keys', async () => {
		const agent = await start();

		const list = await agent.get('/roles?fields=name&sort=name&meta=*').set('Authorization', admin());
		expect(list.body).toEqual({
			data: [{ name: 'Editor' }, { name: 'Staff' }],
			meta: { total_count: 2, filter_count: 2 },
		});

		const search = await agent
			.search('/roles')
			.set('Authorization', admin())
			.send({ keys: [ROLE], query: { fields: ['name'], filter: { name: { _eq: 'Staff' } } } });

		expect(search.body).toEqual({ data: [{ name: 'Staff' }] });
	});

	test('GET /:pk has no `me` branch: a pk ending in me is read like any other', async () => {
		const agent = await start();

		expect((await agent.get(`/roles/${ROLE}?fields=name`).set('Authorization', admin())).body).toEqual({
			data: { name: 'Editor' },
		});

		expect((await agent.get('/roles/xme').set('Authorization', admin())).status).toBe(403);
	});

	test('PATCH by array, keys and query; PATCH /:pk', async () => {
		const agent = await start();
		const patch = (body: object) => agent.patch('/roles?fields=name').set('Authorization', admin()).send(body);

		expect((await patch([{ id: ROLE, name: 'A' }])).body).toEqual({ data: [{ name: 'A' }] });
		expect((await patch({ keys: [ROLE], data: { name: 'B' } })).body).toEqual({ data: [{ name: 'B' }] });
		expect((await patch({ query: { filter: { id: { _eq: ROLE } } }, data: { name: 'C' } })).body).toEqual({
			data: [{ name: 'C' }],
		});

		const one = await agent.patch(`/roles/${ROLE}?fields=name`).set('Authorization', admin()).send({ name: 'D' });
		expect(one.body).toEqual({ data: { name: 'D' } });
	});

	test('PATCH and DELETE without keys or query: 400 INVALID_PAYLOAD from validateBatch', async () => {
		const agent = await start();

		for (const res of [
			await agent
				.patch('/roles')
				.set('Authorization', admin())
				.send({ data: { name: 'x' } }),
			await agent.delete('/roles').set('Authorization', admin()).send({}),
		]) {
			expect(res.status).toBe(400);
			expect(res.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');
		}
	});

	test('DELETE by array, keys, query and /:pk: 204', async () => {
		const agent = await start();
		const ids = ['e1', 'e2', 'e3', 'e4'].map((s) => `a0000000-0000-4000-8000-0000000000${s}`);
		await state.db('directus_roles').insert(ids.map((id) => ({ id, name: id })));

		const statuses = [
			(await agent.delete('/roles').set('Authorization', admin()).send([ids[0]])).status,
			(
				await agent
					.delete('/roles')
					.set('Authorization', admin())
					.send({ keys: [ids[1]] })
			).status,
			(
				await agent
					.delete('/roles')
					.set('Authorization', admin())
					.send({ query: { filter: { id: { _eq: ids[2] } } } })
			).status,
			(await agent.delete(`/roles/${ids[3]}`).set('Authorization', admin())).status,
		];

		expect(statuses).toEqual([204, 204, 204, 204]);
		expect(await state.db('directus_roles').whereIn('id', ids)).toEqual([]);
	});

	test('OPTIONS /roles and /roles/:pk', async () => {
		const agent = await start();
		expect((await agent.options('/roles')).headers['allow']).toBe('POST,GET,HEAD,SEARCH,PATCH,DELETE');
		expect((await agent.options(`/roles/${ROLE}`)).headers['allow']).toBe('GET,HEAD,PATCH,DELETE');
	});
});
