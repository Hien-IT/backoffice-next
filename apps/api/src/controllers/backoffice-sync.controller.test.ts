// Backoffice (spec 032, D-214, contracts/api.md): the /backoffice/sync routes through the real app on the SQLite auth
// test database; the service is mocked (its own tests cover it). Parity with DR (404) is tests/parity/src/sync.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import request from 'supertest';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { type App, createApp } from '../app.js';
import { clearSystemCache } from '../cache.js';
import { BackofficeSyncService } from '../services/backoffice-sync.service.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));
const calls = vi.hoisted(() => ({ info: vi.fn(), state: vi.fn(), diff: vi.fn(), apply: vi.fn() }));

vi.mock('../flows.js', async () => (await import('../test-utils/flows.js')).mockFlowManager());

vi.mock('../services/backoffice-sync.service.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../services/backoffice-sync.service.js')>();
	return {
		...original,
		BackofficeSyncService: vi.fn(function () {
			return calls;
		}),
	};
});

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
const USER = 'd0000000-0000-4000-8000-000000000001';
const ADMIN = 'd0000000-0000-4000-8000-000000000009';

let app: App;

async function start() {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET });
	app = await createApp();
	return request(app.express);
}

const token = (claims: Record<string, unknown>) =>
	`Bearer ${jwt.sign({ app_access: true, admin_access: false, ...claims }, SECRET, { issuer: 'directus' })}`;
const user = () => token({ id: USER, role: ROLE });
const admin = () => token({ id: ADMIN, role: null, admin_access: true });

beforeEach(async () => {
	state.db = await createAuthDb();
	await state.db('directus_roles').insert({ id: ROLE, name: 'Editor' });
	await state.db('directus_users').insert([
		{ id: USER, email: 'user@example.com', role: ROLE },
		{ id: ADMIN, email: 'admin@example.com' },
	]);
	const policy = 'b0000000-0000-4000-8000-000000000009';
	await state.db('directus_policies').insert({ id: policy, name: 'Admin', admin_access: true, app_access: true });
	await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000009', user: ADMIN, policy });
});

afterEach(async () => {
	vi.clearAllMocks();
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

test('401 without a token and 403 for a user who is not admin on every route', async () => {
	const agent = await start();

	for (const [method, path] of [
		['get', '/backoffice/sync'],
		['get', '/backoffice/sync/state'],
		['post', '/backoffice/sync/diff'],
		['post', '/backoffice/sync/apply'],
	] as const) {
		expect((await agent[method](path)).status).toBe(401);
		expect((await agent[method](path).set('Authorization', user())).status).toBe(403);
	}

	expect(calls.info).not.toHaveBeenCalled();
});

test('GET info and state answer { data } with no-cache; an unknown group is a 400', async () => {
	calls.info.mockResolvedValue({ backoffice: '1.0.0' });
	calls.state.mockResolvedValue({ info: {}, state: { folders: [] } });
	const agent = await start();

	const info = await agent.get('/backoffice/sync').set('Authorization', admin());
	expect(info.status).toBe(200);
	expect(info.body).toEqual({ data: { backoffice: '1.0.0' } });
	expect(info.headers['cache-control']).toBe('no-cache');

	const read = await agent.get('/backoffice/sync/state?groups=folders').set('Authorization', admin());
	expect(read.status).toBe(200);
	expect(calls.state).toHaveBeenCalledWith(['folders']);

	const bad = await agent.get('/backoffice/sync/state?groups=users').set('Authorization', admin());
	expect(bad.status).toBe(400);
	expect(bad.body.errors[0].extensions.code).toBe('INVALID_QUERY');
	expect(vi.mocked(BackofficeSyncService)).toHaveBeenCalled();
});

test('POST diff validates the body and answers 200 { data }', async () => {
	calls.diff.mockResolvedValue({ hash: 'h', rows: [] });
	const agent = await start();

	const missing = await agent.post('/backoffice/sync/diff').set('Authorization', admin()).send({ url: 'https://s' });
	expect(missing.status).toBe(400);
	expect(missing.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');

	const unknown = await agent
		.post('/backoffice/sync/diff')
		.set('Authorization', admin())
		.send({ url: 'https://s', token: 't', groups: ['users'] });
	expect(unknown.status).toBe(400);

	const ok = await agent
		.post('/backoffice/sync/diff')
		.set('Authorization', admin())
		.send({ url: 'https://s', token: 't', groups: ['flows'] });
	expect(ok.status).toBe(200);
	expect(ok.body).toEqual({ data: { hash: 'h', rows: [] } });
	expect(calls.diff).toHaveBeenCalledWith({ url: 'https://s', token: 't', groups: ['flows'] });
});

test('POST apply validates hash and selected and answers 200 { data }', async () => {
	calls.apply.mockResolvedValue({ created: {}, warnings: [] });
	const agent = await start();

	const missing = await agent
		.post('/backoffice/sync/apply')
		.set('Authorization', admin())
		.send({ url: 'https://s', token: 't', groups: ['flows'] });
	expect(missing.status).toBe(400);

	const empty = await agent
		.post('/backoffice/sync/apply')
		.set('Authorization', admin())
		.send({ url: 'https://s', token: 't', groups: ['flows'], hash: 'h', selected: [] });
	expect(empty.status).toBe(400);

	const ok = await agent
		.post('/backoffice/sync/apply')
		.set('Authorization', admin())
		.send({ url: 'https://s', token: 't', groups: ['flows'], hash: 'h', selected: ['flows/flow:f1'] });
	expect(ok.status).toBe(200);
	expect(ok.body).toEqual({ data: { created: {}, warnings: [] } });
	expect(calls.apply).toHaveBeenCalledWith({
		url: 'https://s',
		token: 't',
		groups: ['flows'],
		hash: 'h',
		selected: ['flows/flow:f1'],
	});
});
