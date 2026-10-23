// /permissions end to end (pipeline, authenticate, PermissionsService) on the SQLite auth test database (task T045).
// Parity with DR is checked by tests/parity/src/permissions/accountability.test.ts.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import request from 'supertest';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { type App, createApp } from '../app.js';
import { clearSystemCache } from '../cache.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

vi.mock('../flows.js', async () => (await import('../test-utils/flows.js')).mockFlowManager());

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
	await state.db('directus_roles').insert({ id: ROLE, name: 'Editor' });
	await state.db('directus_policies').insert({ id: POLICY, name: 'Editor', app_access: true, enforce_tfa: true });
	await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000001', role: ROLE, policy: POLICY });
	await state.db('directus_users').insert({ id: USER, email: 'user@example.com', first_name: 'Ann', role: ROLE });
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

const ADMIN = 'd0000000-0000-4000-8000-000000000009';
const admin = () => token({ id: ADMIN, role: null });

async function addAdmin() {
	const policy = 'b0000000-0000-4000-8000-000000000009';
	await state.db('directus_policies').insert({ id: policy, name: 'Admin', admin_access: true, app_access: true });
	await state.db('directus_users').insert({ id: ADMIN, email: 'admin@example.com' });
	await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000009', user: ADMIN, policy });
}

beforeEach(async () => {
	await addAdmin();
	await state
		.db('directus_permissions')
		.insert(['a', 'b', 'c'].map((collection) => ({ collection, action: 'read', fields: '*', policy: POLICY })));
});

// An admin has app access (fetchGlobalAccessForQuery), so every read appends the app minimal permissions
// after the stored rows (without id), like DR.
const stored = (rows: any[]) => rows.filter((row) => row.id != null);

test('GET ignores the limit of the query, meta counts the stored rows (directus/directus#18654)', async () => {
	const res = await (await start())
		.get('/permissions?fields=id,collection&limit=1&meta=*')
		.set('Authorization', admin());

	expect(stored(res.body.data).map((p) => p.collection)).toEqual(['a', 'b', 'c']);
	expect(res.body.data.length).toBeGreaterThan(3);
	expect(res.body.meta).toEqual({ total_count: 3, filter_count: 3 });
});

test('POST many, PATCH array, DELETE array', async () => {
	const agent = await start();

	const created = await agent
		.post('/permissions?fields=id,collection')
		.set('Authorization', admin())
		.send([
			{ collection: 'x', action: 'read', policy: POLICY },
			{ collection: 'y', action: 'read', policy: POLICY },
		]);

	expect(stored(created.body.data).map((p) => p.collection)).toEqual(['x', 'y']);
	const ids = stored(created.body.data).map((p) => p.id);

	const patched = await agent
		.patch('/permissions?fields=id,action')
		.set('Authorization', admin())
		.send(ids.map((id: number) => ({ id, action: 'update' })));

	expect(stored(patched.body.data).map((p) => p.action)).toEqual(['update', 'update']);

	expect((await agent.delete('/permissions').set('Authorization', admin()).send(ids)).status).toBe(204);
	expect(await state.db('directus_permissions').whereIn('id', ids)).toEqual([]);
});

test('GET /permissions/<pk ending in me> answers 204', async () => {
	expect((await (await start()).get('/permissions/xme').set('Authorization', admin())).status).toBe(204);
});

test('GET /permissions/me: 403 without user, role or share; the collection access of the admin', async () => {
	const agent = await start();

	expect((await agent.get('/permissions/me')).status).toBe(403);

	const me = await agent.get('/permissions/me').set('Authorization', admin());
	expect(me.status).toBe(200);
	expect(me.body.data['directus_users']).toMatchObject({ read: { access: 'full' } });
});

test('GET /permissions/me/:collection and /:collection/:pk answer the item permissions', async () => {
	const agent = await start();

	const collection = await agent.get('/permissions/me/directus_users').set('Authorization', admin());
	expect(collection.body.data).toMatchObject({ update: { access: true }, delete: { access: true } });

	const item = await agent.get(`/permissions/me/directus_users/${ADMIN}`).set('Authorization', admin());
	expect(item.status).toBe(200);
	expect(item.body.data).toMatchObject({ update: { access: true } });

	expect((await agent.get('/permissions/me/directus_users')).status).toBe(403);
});
