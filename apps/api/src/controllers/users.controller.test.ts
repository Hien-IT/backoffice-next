// GET /users/me end to end (pipeline, authenticate, permission engine) on the SQLite auth test database (task T037).
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
	await state.db('directus_policies').insert({ id: POLICY, name: 'Editor' });
	await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000001', role: ROLE, policy: POLICY });
	await state.db('directus_users').insert({ id: USER, email: 'user@example.com', first_name: 'Ann', role: ROLE });
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

test('no user: 401 INVALID_CREDENTIALS', async () => {
	const res = await (await start()).get('/users/me');

	expect(res.status).toBe(401);
	expect(res.body.errors[0].extensions.code).toBe('INVALID_CREDENTIALS');
});

test('without read permission on directus_users: only the id', async () => {
	const res = await (await start()).get('/users/me').set('Authorization', token());

	expect(res.status).toBe(200);
	expect(res.body).toEqual({ data: { id: USER } });
});

test('with a read permission: the fields of the query the permission allows', async () => {
	await state.db('directus_permissions').insert({
		collection: 'directus_users',
		action: 'read',
		fields: 'id,email,first_name',
		permissions: JSON.stringify({ id: { _eq: '$CURRENT_USER' } }),
		policy: POLICY,
	});

	const agent = await start();

	expect((await agent.get('/users/me?fields=email,first_name').set('Authorization', token())).body).toEqual({
		data: { email: 'user@example.com', first_name: 'Ann' },
	});

	// A field outside the permission is refused by the read, which answers with the id (Directus catches FORBIDDEN).
	expect((await agent.get('/users/me?fields=last_name').set('Authorization', token())).body).toEqual({
		data: { id: USER },
	});
});

test('OPTIONS lists the methods of every Directus route matching /users/me', async () => {
	const res = await (await start()).options('/users/me');

	expect(res.headers['allow']).toBe('GET,HEAD,PATCH,DELETE');
});
