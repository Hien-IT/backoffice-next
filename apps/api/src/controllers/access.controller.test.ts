// /access end to end (pipeline, authenticate, AccessService) on the SQLite auth test database (task T044).
// Parity with Directus is checked by tests/parity/src/permissions/accountability.test.ts.
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

beforeEach(addAdmin);

test('POST a public access row (role and user null), read back', async () => {
	const res = await (await start())
		.post('/access?fields=role,user,policy')
		.set('Authorization', admin())
		.send({ policy: POLICY });

	expect(res.status).toBe(200);
	expect(res.body).toEqual({ data: { role: null, user: null, policy: POLICY } });
});

test('GET /access/me answers 204; GET by key reads the row', async () => {
	const agent = await start();

	expect((await agent.get('/access/me').set('Authorization', admin())).status).toBe(204);
	expect(
		(await agent.get('/access/c0000000-0000-4000-8000-000000000001?fields=role').set('Authorization', admin())).body,
	).toEqual({ data: { role: ROLE } });
});

test('removing the access of the last admin: 422 UNPROCESSABLE_CONTENT, row kept', async () => {
	const res = await (await start())
		.delete('/access/c0000000-0000-4000-8000-000000000009')
		.set('Authorization', admin());

	expect(res.status).toBe(422);
	expect(res.body.errors[0].extensions.code).toBe('UNPROCESSABLE_CONTENT');
	expect(await state.db('directus_access').where({ id: 'c0000000-0000-4000-8000-000000000009' }).first()).toBeDefined();
});

test('PATCH by keys and DELETE by query', async () => {
	const agent = await start();
	const id = 'c0000000-0000-4000-8000-000000000001';

	const patched = await agent
		.patch('/access?fields=sort')
		.set('Authorization', admin())
		.send({ keys: [id], data: { sort: 3 } });

	expect(patched.body).toEqual({ data: [{ sort: 3 }] });

	const deleted = await agent
		.delete('/access')
		.set('Authorization', admin())
		.send({ query: { filter: { id: { _eq: id } } } });

	expect(deleted.status).toBe(204);
	expect(await state.db('directus_access').where({ id }).first()).toBeUndefined();
});
