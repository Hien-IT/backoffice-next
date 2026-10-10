// POST /auth/login and /auth/login/:provider end to end (pipeline, controller, driver, service) on the SQLite auth
// test database. Parity with Directus is checked by tests/parity/src/auth/login*.test.ts.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { type App, createApp } from '../app.js';
import { registerAuthProviders } from '../auth.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

vi.mock('@backoffice/env', async (importOriginal) => {
	const actual = await importOriginal<typeof env>();
	return { ...actual, useEnv: vi.fn(actual.useEnv) };
});

vi.mock('../database/index.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../database/index.js')>();
	return { ...original, default: () => state.db, getDatabaseClient: () => 'sqlite' };
});

vi.mock('../schema/get-database-schema.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../schema/get-database-schema.js')>();
	return { ...original, getSchema: () => original.getDatabaseSchema(state.db, createInspector(state.db)) };
});

vi.mock('../logger/index.js', () => {
	const logger = { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn(), fatal: vi.fn(), trace: vi.fn() };
	return { useLogger: () => logger, createExpressLogger: () => (_req: unknown, _res: unknown, next: () => void) => next() };
});

const defaults = (await vi.importActual<typeof env>('@backoffice/env')).useEnv();

const SECRET = 'test-secret';
const ROLE = 'a0000000-0000-4000-8000-000000000001';
const USER = 'd0000000-0000-4000-8000-000000000001';
const LOCAL2_USER = 'd0000000-0000-4000-8000-000000000002';

let app: App;

async function start(overrides: Record<string, unknown> = {}) {
	vi.mocked(env.useEnv).mockReturnValue({
		...defaults,
		SECRET,
		LOGIN_STALL_TIME: 0,
		AUTH_PROVIDERS: 'local2',
		AUTH_LOCAL2_DRIVER: 'local',
		...overrides,
	});

	await registerAuthProviders();
	app = await createApp();
	return request(app.express);
}

beforeEach(async () => {
	state.db = await createAuthDb();
	const password = await argon2.hash('secret');

	await state.db('directus_roles').insert({ id: ROLE, name: 'Editor' });

	await state.db('directus_users').insert({ id: USER, email: 'User@Example.com', password, role: ROLE });
	await state.db('directus_users').insert({ id: LOCAL2_USER, email: 'other@example.com', password, provider: 'local2' });
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
});

const login = { email: 'user@example.com', password: 'secret' };

describe('POST /auth/login', () => {
	test('json: tokens in the body, a session row, activity `login` and last_access', async () => {
		const res = await (await start()).post('/auth/login').set('User-Agent', 'ua').send(login);

		expect(res.status).toBe(200);
		expect(res.headers['cache-control']).toBe('no-cache');
		expect(Object.keys(res.body.data).sort()).toEqual(['access_token', 'expires', 'refresh_token']);
		expect(res.body.data.expires).toBe(900_000);
		expect(res.body.data.refresh_token).toHaveLength(64);

		expect(jwt.verify(res.body.data.access_token, SECRET)).toMatchObject({
			id: USER,
			role: ROLE,
			app_access: false,
			admin_access: false,
			iss: 'directus',
		});

		expect(await state.db('directus_sessions').where({ token: res.body.data.refresh_token }).first()).toMatchObject({
			user: USER,
			user_agent: 'ua',
		});

		expect(await state.db('directus_activity').first()).toMatchObject({ action: 'login', user: USER, item: USER });
		expect((await state.db('directus_users').where({ id: USER }).first()).last_access).not.toBeNull();
	});

	test('cookie: refresh token in an HttpOnly cookie, access token in the body', async () => {
		const res = await (await start()).post('/auth/login').send({ ...login, mode: 'cookie' });

		expect(Object.keys(res.body.data).sort()).toEqual(['access_token', 'expires']);
		expect(res.headers['set-cookie']).toEqual([
			expect.stringMatching(/^directus_refresh_token=[\w-]{64}; Max-Age=604800; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/),
		]);
	});

	test('session: the access token, with the session claim, in the session cookie', async () => {
		const res = await (await start()).post('/auth/login').send({ ...login, mode: 'session' });

		expect(res.body).toEqual({ data: { expires: 86_400_000 } });
		const cookie = res.headers['set-cookie']![0]!;
		expect(cookie).toMatch(/^directus_session_token=[^;]+; Max-Age=86400; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/);

		const claims = jwt.verify(cookie.split(/[=;]/)[1]!, SECRET) as Record<string, unknown>;
		expect(await state.db('directus_sessions').where({ token: claims['session'] }).first()).toBeTruthy();
	});

	test('errors: wrong password 401, invalid payload 400', async () => {
		const agent = await start();

		const wrong = await agent.post('/auth/login').send({ ...login, password: 'nope' });
		expect(wrong.status).toBe(401);
		expect(wrong.body.errors[0].extensions.code).toBe('INVALID_CREDENTIALS');

		const invalid = await agent.post('/auth/login').send({ email: 'not-an-email', password: 'x' });
		expect(invalid.status).toBe(400);
		expect(invalid.body.errors[0].extensions).toEqual({ code: 'INVALID_PAYLOAD', reason: '"email" must be a valid email' });
	});

	test('AUTH_DISABLE_DEFAULT: 404', async () => {
		const res = await (await start({ AUTH_DISABLE_DEFAULT: true })).post('/auth/login').send(login);
		expect(res.status).toBe(404);
		expect(res.body.errors[0].extensions.code).toBe('ROUTE_NOT_FOUND');
	});
});

describe('POST /auth/login/:provider', () => {
	test('a local provider, matched case-insensitively; only its own users', async () => {
		const agent = await start();

		const noLogin = await agent.post('/auth/LOCAL2').send({ email: 'other@example.com', password: 'secret' });
		expect(noLogin.status).toBe(404);

		const res = await agent.post('/auth/login/LOCAL2/').send({ email: 'other@example.com', password: 'secret' });
		expect(res.status).toBe(200);
		expect(jwt.verify(res.body.data.access_token, SECRET)).toMatchObject({ id: LOCAL2_USER });

		const other = await agent.post('/auth/login/local2').send(login);
		expect(other.status).toBe(401);
	});

	test('unknown provider or `default`: 404', async () => {
		const agent = await start();
		expect((await agent.post('/auth/login/nope').send(login)).status).toBe(404);
		expect((await agent.post('/auth/login/default').send(login)).status).toBe(404);
	});
});
