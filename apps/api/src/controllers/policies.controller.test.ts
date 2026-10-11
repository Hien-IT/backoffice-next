// GET /policies/me/globals end to end (pipeline, authenticate, policies) on the SQLite auth test database (task T037).
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

test('no user and no role: app_access false only', async () => {
	const res = await (await start()).get('/policies/me/globals');

	expect(res.status).toBe(200);
	expect(res.body).toEqual({ data: { app_access: false } });
});

test('the flags of the policies of the role tree', async () => {
	const res = await (await start()).get('/policies/me/globals').set('Authorization', token());

	expect(res.body).toEqual({ data: { app_access: true, admin_access: false, enforce_tfa: true } });
});

test('OPTIONS answers GET,HEAD', async () => {
	expect((await (await start()).options('/policies/me/globals')).headers['allow']).toBe('GET,HEAD');
});

describe('CRUD as admin', () => {
	const ADMIN = 'd0000000-0000-4000-8000-000000000009';
	const admin = () => token({ id: ADMIN, role: null });

	async function addAdmin() {
		const policy = 'b0000000-0000-4000-8000-000000000009';
		await state.db('directus_policies').insert({ id: policy, name: 'Admin', admin_access: true, app_access: true });
		await state.db('directus_users').insert({ id: ADMIN, email: 'admin@example.com' });
		await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000009', user: ADMIN, policy });
	}

	beforeEach(addAdmin);

	test('SEARCH with keys reads those keys; GET /:pk ending in me answers 204', async () => {
		const agent = await start();

		const search = await agent
			.search('/policies?fields=name')
			.set('Authorization', admin())
			.send({ keys: [POLICY] });

		expect(search.body).toEqual({ data: [{ name: 'Editor' }], meta: undefined });

		for (const path of ['/policies/me', '/policies/xme']) {
			expect((await agent.get(path).set('Authorization', admin())).status).toBe(204);
		}
	});

	test('POST, PATCH /:pk and DELETE /:pk', async () => {
		const agent = await start();

		const created = await agent.post('/policies?fields=id,name').set('Authorization', admin()).send({ name: 'New' });
		expect(created.status).toBe(200);

		const id = created.body.data.id;
		const patched = await agent
			.patch(`/policies/${id}?fields=name`)
			.set('Authorization', admin())
			.send({ name: 'Renamed' });
		expect(patched.body).toEqual({ data: { name: 'Renamed' } });

		expect((await agent.delete(`/policies/${id}`).set('Authorization', admin())).status).toBe(204);
		expect(await state.db('directus_policies').where({ id }).first()).toBeUndefined();
	});

	test('ip_access with a wrong value: 400 INVALID_PAYLOAD', async () => {
		const res = await (
			await start()
		)
			.post('/policies')
			.set('Authorization', admin())
			.send({ name: 'x', ip_access: ['not-an-ip'] });

		expect(res.status).toBe(400);
		expect(res.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');
	});

	test('OPTIONS /policies/me answers like /policies/:pk', async () => {
		expect((await (await start()).options('/policies/me')).headers['allow']).toBe('GET,HEAD,PATCH,DELETE');
	});
});
