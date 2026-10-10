// The routes of feature 003 end to end (pipeline, authenticate, controllers, drivers, services) on the SQLite auth
// test database. Parity with Directus is checked by tests/parity/src/auth/*.test.ts.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import { getSimpleHash } from '@backoffice/utils';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { type App, createApp } from '../app.js';
import { registerAuthProviders } from '../auth.js';
import { useLogger } from '../logger/index.js';

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
	return {
		useLogger: () => logger,
		createExpressLogger: () => (_req: unknown, _res: unknown, next: () => void) => next(),
	};
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
	await state
		.db('directus_users')
		.insert({ id: LOCAL2_USER, email: 'other@example.com', password, provider: 'local2' });
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
			expect.stringMatching(
				/^directus_refresh_token=[\w-]{64}; Max-Age=604800; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/,
			),
		]);
	});

	test('session: the access token, with the session claim, in the session cookie', async () => {
		const res = await (await start()).post('/auth/login').send({ ...login, mode: 'session' });

		expect(res.body).toEqual({ data: { expires: 86_400_000 } });
		const cookie = res.headers['set-cookie']![0]!;
		expect(cookie).toMatch(
			/^directus_session_token=[^;]+; Max-Age=86400; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/,
		);

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
		expect(invalid.body.errors[0].extensions).toEqual({
			code: 'INVALID_PAYLOAD',
			reason: '"email" must be a valid email',
		});
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

describe('POST /auth/refresh', () => {
	test('json: a new token pair; the session row takes the new token', async () => {
		const agent = await start();
		const first = (await agent.post('/auth/login').send(login)).body.data;

		const res = await agent.post('/auth/refresh').send({ refresh_token: first.refresh_token });
		expect(res.status).toBe(200);
		expect(res.body.data.refresh_token).not.toBe(first.refresh_token);
		expect(jwt.verify(res.body.data.access_token, SECRET)).toMatchObject({ id: USER, role: ROLE });

		const tokens = (await state.db('directus_sessions').where({ user: USER })).map((s) => s.token);
		expect(tokens).toEqual([res.body.data.refresh_token]);

		const reused = await agent.post('/auth/refresh').send({ refresh_token: first.refresh_token });
		expect(reused.status).toBe(401);
		expect(reused.body.errors[0].extensions.code).toBe('INVALID_CREDENTIALS');
	});

	test('cookie: the refresh token from and to the cookie', async () => {
		const agent = await start();
		const cookie = (await agent.post('/auth/login').send({ ...login, mode: 'cookie' })).headers['set-cookie']![0]!;

		const res = await agent.post('/auth/refresh').set('Cookie', cookie.split(';')[0]!);
		expect(res.status).toBe(200);
		expect(Object.keys(res.body.data).sort()).toEqual(['access_token', 'expires']);
		expect(res.headers['set-cookie']![0]).toMatch(/^directus_refresh_token=[\w-]{64}; Max-Age=604800;/);
	});

	test('session: a new session, the old one kept for the grace period and pointing to it', async () => {
		const agent = await start();
		const cookie = (await agent.post('/auth/login').send({ ...login, mode: 'session' })).headers['set-cookie']![0]!;
		const pair = cookie.split(';')[0]!;
		const oldSession = (jwt.decode(pair.split('=')[1]!) as { session: string }).session;

		const res = await agent.post('/auth/refresh').send({ mode: 'session' }).set('Cookie', pair);
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ data: { expires: 86_400_000 } });

		const newSession = (jwt.decode(res.headers['set-cookie']![0]!.split(/[=;]/)[1]!) as { session: string }).session;
		const old = await state.db('directus_sessions').where({ token: oldSession }).first();
		expect(old.next_token).toBe(newSession);
		expect(new Date(old.expires).getTime()).toBeLessThanOrEqual(Date.now() + 10_000);

		// A second refresh with the old cookie within the grace period gets the same new session.
		const again = await agent.post('/auth/refresh').send({ mode: 'session' }).set('Cookie', pair);
		expect((jwt.decode(again.headers['set-cookie']![0]!.split(/[=;]/)[1]!) as { session: string }).session).toBe(
			newSession,
		);
	});

	test('a share session: share claims, no user', async () => {
		const agent = await start();
		const share = 'e0000000-0000-4000-8000-000000000001';
		await state.db('directus_shares').insert({ id: share });
		await state
			.db('directus_sessions')
			.insert({ token: 's'.repeat(64), share, expires: new Date(Date.now() + 60_000) });

		const res = await agent.post('/auth/refresh').send({ refresh_token: 's'.repeat(64) });
		expect(res.status).toBe(200);

		const claims = jwt.verify(res.body.data.access_token, SECRET) as Record<string, unknown>;
		expect(claims).toMatchObject({ share, role: null, app_access: false, admin_access: false });
		expect(claims).not.toHaveProperty('id');
	});

	test('no token 400; suspended user 401 USER_SUSPENDED and the session deleted', async () => {
		const agent = await start();

		const missing = await agent.post('/auth/refresh').send({});
		expect(missing.status).toBe(400);
		expect(missing.body.errors[0].extensions).toEqual({
			code: 'INVALID_PAYLOAD',
			reason: 'The refresh token is required in either the payload or cookie',
		});

		const { refresh_token } = (await agent.post('/auth/login').send(login)).body.data;
		await state.db('directus_users').update({ status: 'suspended' }).where({ id: USER });

		const suspended = await agent.post('/auth/refresh').send({ refresh_token });
		expect(suspended.status).toBe(401);
		expect(suspended.body.errors[0].extensions.code).toBe('USER_SUSPENDED');
		expect(await state.db('directus_sessions').where({ token: refresh_token })).toEqual([]);
	});
});

describe('POST /auth/logout', () => {
	test('json: 204, the session deleted, activity `logout`', async () => {
		const agent = await start();
		const { refresh_token } = (await agent.post('/auth/login').send(login)).body.data;

		const res = await agent.post('/auth/logout').send({ refresh_token });
		expect(res.status).toBe(204);
		expect(res.headers['set-cookie']).toBeUndefined();
		expect(await state.db('directus_sessions').where({ token: refresh_token })).toEqual([]);
		expect((await state.db('directus_activity').orderBy('id', 'desc').first()).action).toBe('logout');
	});

	test('cookie and session: the cookie cleared like Express 4 (empty, Max-Age kept)', async () => {
		const agent = await start();

		const cookie = (await agent.post('/auth/login').send({ ...login, mode: 'cookie' })).headers['set-cookie']![0]!;
		const res = await agent.post('/auth/logout').set('Cookie', cookie.split(';')[0]!);
		expect(res.status).toBe(204);
		expect(res.headers['set-cookie']).toEqual([
			expect.stringMatching(/^directus_refresh_token=; Max-Age=604800; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/),
		]);

		const session = (await agent.post('/auth/login').send({ ...login, mode: 'session' })).headers['set-cookie']![0]!;
		const out = await agent.post('/auth/logout').send({ mode: 'session' }).set('Cookie', session.split(';')[0]!);
		expect(out.status).toBe(204);
		expect(out.headers['set-cookie']![0]).toMatch(/^directus_session_token=; Max-Age=86400; Path=\//);
	});

	test('no token: 400', async () => {
		const res = await (await start()).post('/auth/logout').send({});
		expect(res.status).toBe(400);
	});
});

describe('POST /users/me/tfa/generate', () => {
	const generate = (agent: Awaited<ReturnType<typeof start>>) => agent.post('/users/me/tfa/generate');

	test('with the access token as Bearer, query parameter or session cookie', async () => {
		const agent = await start();
		const { access_token } = (await agent.post('/auth/login').send(login)).body.data;

		const res = await generate(agent).set('Authorization', `Bearer ${access_token}`).send({ password: 'secret' });
		expect(res.status).toBe(200);
		expect(res.body.data.secret).toMatch(/^[A-Z2-7]+$/);
		expect(res.body.data.otpauth_url).toBe(
			`otpauth://totp/Backoffice:User%40Example.com?secret=${res.body.data.secret}&period=30&digits=6&algorithm=SHA1&issuer=Backoffice`,
		);

		const query = await agent.post(`/users/me/tfa/generate?access_token=${access_token}`).send({ password: 'secret' });
		expect(query.status).toBe(200);

		const session = (await agent.post('/auth/login').send({ ...login, mode: 'session' })).headers['set-cookie']![0]!;
		const cookie = await generate(agent).set('Cookie', session.split(';')[0]!).send({ password: 'secret' });
		expect(cookie.status).toBe(200);
	});

	test('errors: no token 401, no or wrong password, TFA already on', async () => {
		const agent = await start();
		const { access_token } = (await agent.post('/auth/login').send(login)).body.data;
		const bearer = `Bearer ${access_token}`;

		const anonymous = await generate(agent).send({ password: 'secret' });
		expect(anonymous.status).toBe(401);
		expect(anonymous.body.errors[0].extensions.code).toBe('INVALID_CREDENTIALS');

		const noPassword = await generate(agent).set('Authorization', bearer).send({});
		expect(noPassword.status).toBe(400);
		expect(noPassword.body.errors[0].extensions.reason).toBe('"password" is required');

		expect((await generate(agent).set('Authorization', bearer).send({ password: 'nope' })).status).toBe(401);

		await state.db('directus_users').update({ tfa_secret: 'X' }).where({ id: USER });
		const enabled = await generate(agent).set('Authorization', bearer).send({ password: 'secret' });
		expect(enabled.status).toBe(400);
		expect(enabled.body.errors[0].extensions.reason).toBe('TFA Secret is already set for this user');
	});

	test('a static token; an expired token 401 TOKEN_EXPIRED', async () => {
		const agent = await start();
		await state.db('directus_users').update({ token: 'static-token' }).where({ id: USER });

		expect(
			(await generate(agent).set('Authorization', 'Bearer static-token').send({ password: 'secret' })).status,
		).toBe(200);

		const expired = jwt.sign({ id: USER, role: ROLE, app_access: false, admin_access: false }, SECRET, {
			issuer: 'directus',
			expiresIn: -1,
		});

		const res = await generate(agent).set('Authorization', `Bearer ${expired}`).send({ password: 'secret' });
		expect(res.status).toBe(401);
		expect(res.body.errors[0].extensions.code).toBe('TOKEN_EXPIRED');
	});
});

describe('POST /auth/password/request and /auth/password/reset', () => {
	const resetToken = async (scope = 'password-reset') => {
		const { password } = await state.db('directus_users').where({ id: USER }).first();
		return jwt.sign({ email: 'User@Example.com', scope, hash: getSimpleHash('' + password) }, SECRET, {
			expiresIn: '1d',
			issuer: 'directus',
		});
	};

	test('request: 204 with a log line naming the user and no token; unknown email 204 too', async () => {
		const agent = await start();

		const res = await agent.post('/auth/password/request').send({ email: 'user@example.com' });
		expect(res.status).toBe(204);
		expect(useLogger().warn).toHaveBeenCalledWith(
			'[email] Password reset email to "User@Example.com" was not sent: Backoffice does not send email.',
		);

		expect((await agent.post('/auth/password/request').send({ email: 'nobody@example.com' })).status).toBe(204);
	});

	test('request errors: no email 400, reset_url outside the allow list 400', async () => {
		const agent = await start();

		const missing = await agent.post('/auth/password/request').send({});
		expect(missing.body.errors[0].extensions).toEqual({ code: 'INVALID_PAYLOAD', reason: '"email" field is required' });

		const url = await agent
			.post('/auth/password/request')
			.send({ email: 'user@example.com', reset_url: 'https://evil.example' });
		expect(url.status).toBe(400);
		expect(url.body.errors[0].extensions.reason).toBe('URL "https://evil.example" can\'t be used to reset passwords');
	});

	test('reset: the password changes, every session goes, the token works once', async () => {
		const agent = await start();
		await agent.post('/auth/login').send(login);
		const token = await resetToken();

		expect((await agent.post('/auth/password/reset').send({ token, password: 'new-secret' })).status).toBe(204);
		expect(await state.db('directus_sessions').where({ user: USER })).toEqual([]);
		expect((await agent.post('/auth/login').send({ ...login, password: 'new-secret' })).status).toBe(200);

		const again = await agent.post('/auth/password/reset').send({ token, password: 'other' });
		expect(again.status).toBe(403);
		expect(again.body.errors[0].extensions.code).toBe('FORBIDDEN');
	});

	test('reset errors: missing fields 400, another scope 403, password policy 400', async () => {
		const agent = await start();

		expect((await agent.post('/auth/password/reset').send({ password: 'x' })).status).toBe(400);
		expect((await agent.post('/auth/password/reset').send({ token: 'x' })).status).toBe(400);
		expect(
			(await agent.post('/auth/password/reset').send({ token: await resetToken('invite'), password: 'x' })).status,
		).toBe(403);

		await state.db('directus_settings').insert({ auth_password_policy: '/^.{8,}$/' });
		const weak = await agent.post('/auth/password/reset').send({ token: await resetToken(), password: 'short' });
		expect(weak.status).toBe(400);
		expect(weak.body.errors[0].extensions.code).toBe('FAILED_VALIDATION');
	});
});
