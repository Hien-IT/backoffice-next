// Backoffice (spec 029, T015 + T018, contracts/api.md): /backoffice/auth/passkey* and /backoffice/users/*/passkeys* end
// to end on the SQLite auth test database, with the WebAuthn checks of @simplewebauthn/server mocked (the real
// ceremonies run in tests/parity/src/auth/passkey.test.ts, DR 404 there too).
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import { verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { type App, createApp } from '../app.js';
import { registerAuthProviders } from '../auth.js';
import { _local } from '../auth/passkey/challenge-store.js';
import { clearSystemCache } from '../cache.js';
import { up as upPermissions } from '../database/backoffice-migrations/20261028A-create-backoffice-permissions.js';
import { up as upPasskeys } from '../database/backoffice-migrations/20261101A-create-backoffice-passkeys.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

vi.mock('../flows.js', async () => (await import('../test-utils/flows.js')).mockFlowManager());

vi.mock('@simplewebauthn/server', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@simplewebauthn/server')>();
	return { ...actual, verifyRegistrationResponse: vi.fn(), verifyAuthenticationResponse: vi.fn() };
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
const POLICY = 'b0000000-0000-4000-8000-000000000001';
const USER = 'd0000000-0000-4000-8000-000000000001';
const ADMIN = 'd0000000-0000-4000-8000-000000000009';
const PASSWORD = 'Password1!';

let app: App;

async function start(over: Record<string, unknown> = {}) {
	vi.mocked(env.useEnv).mockReturnValue({
		...defaults,
		SECRET,
		PUBLIC_URL: 'http://localhost:8162',
		LOGIN_STALL_TIME: 0,
		...over,
	});

	await registerAuthProviders();
	app = await createApp();
	return request(app.express);
}

const token = (claims: Record<string, unknown>) =>
	`Bearer ${jwt.sign({ app_access: true, admin_access: false, ...claims }, SECRET, { issuer: 'directus' })}`;

const userToken = () => token({ id: USER, role: ROLE });
const adminToken = () => token({ id: ADMIN, role: null, admin_access: true });

const signed = (challenge: string, type = 'webauthn.get') =>
	Buffer.from(JSON.stringify({ type, challenge, origin: 'http://localhost:8162' })).toString('base64url');

beforeEach(async () => {
	_local.clear();
	state.db = await createAuthDb();
	await upPermissions(state.db);
	await upPasskeys(state.db);
	await state.db('directus_roles').insert({ id: ROLE, name: 'Editor' });
	// The role enforces TFA: a password session asks for the setup, a passkey session does not (D-207.5).
	await state.db('directus_policies').insert({ id: POLICY, name: 'Editor', app_access: true, enforce_tfa: true });
	await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000001', role: ROLE, policy: POLICY });

	await state.db('directus_users').insert({
		id: USER,
		email: 'user@example.com',
		first_name: 'Ann',
		role: ROLE,
		password: await argon2.hash(PASSWORD),
		token: 'static-token-of-ann',
	});

	const adminPolicy = 'b0000000-0000-4000-8000-000000000009';
	await state.db('directus_policies').insert({ id: adminPolicy, name: 'Admin', admin_access: true, app_access: true });
	await state.db('directus_users').insert({ id: ADMIN, email: 'admin@example.com' });
	await state
		.db('directus_access')
		.insert({ id: 'c0000000-0000-4000-8000-000000000009', user: ADMIN, policy: adminPolicy });

	vi.mocked(verifyRegistrationResponse).mockResolvedValue({
		verified: true,
		registrationInfo: {
			credential: { id: 'cred-1', publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] },
			credentialDeviceType: 'singleDevice',
			credentialBackedUp: false,
		},
	} as any);

	vi.mocked(verifyAuthenticationResponse).mockResolvedValue({
		verified: true,
		authenticationInfo: { newCounter: 1 },
	} as any);
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

async function registerPasskey(agent: ReturnType<typeof request>) {
	const options = await agent
		.post('/backoffice/users/me/passkeys/options')
		.set('Authorization', userToken())
		.send({ password: PASSWORD });

	expect(options.status, JSON.stringify(options.body)).toBe(200);

	return agent
		.post('/backoffice/users/me/passkeys')
		.set('Authorization', userToken())
		.send({
			name: 'MacBook',
			response: {
				id: 'cred-1',
				rawId: 'cred-1',
				type: 'public-key',
				response: { clientDataJSON: signed(options.body.data.challenge, 'webauthn.create'), attestationObject: 'x' },
			},
		});
}

async function loginWithPasskey(agent: ReturnType<typeof request>, mode: string) {
	const options = await agent.post('/backoffice/auth/passkey/login/options');
	expect(options.status).toBe(200);

	return agent.post('/backoffice/auth/passkey/login').send({
		mode,
		response: {
			id: 'cred-1',
			rawId: 'cred-1',
			type: 'public-key',
			response: { clientDataJSON: signed(options.body.data.challenge), authenticatorData: 'a', signature: 's' },
		},
	});
}

describe('routes', () => {
	test('GET /backoffice/auth/passkey gives the RP ID; /backoffice/permissions still answers', async () => {
		const agent = await start();

		expect((await agent.get('/backoffice/auth/passkey')).body).toEqual({ data: { rp_id: 'localhost' } });
		expect((await agent.get('/backoffice/permissions').set('Authorization', adminToken())).status).toBe(200);
	});

	test('PUBLIC_URL without a host name: every passkey route is 404 like Directus', async () => {
		const agent = await start({ PUBLIC_URL: '/' });

		for (const [method, path] of [
			['get', '/backoffice/auth/passkey'],
			['post', '/backoffice/auth/passkey/login/options'],
			['post', '/backoffice/auth/passkey/login'],
			['get', '/backoffice/users/me/passkeys'],
		] as const) {
			const res = await agent[method](path).set('Authorization', userToken());
			expect(res.status, path).toBe(404);
			expect(res.body.errors[0].extensions.code).toBe('ROUTE_NOT_FOUND');
		}
	});

	test('401 without a user, 403 for a non-admin on another user, static token accepted like TFA', async () => {
		const agent = await start();

		expect((await agent.get('/backoffice/users/me/passkeys')).status).toBe(401);
		expect((await agent.get(`/backoffice/users/${ADMIN}/passkeys`).set('Authorization', userToken())).status).toBe(403);

		const viaStatic = await agent
			.get('/backoffice/users/me/passkeys')
			.set('Authorization', 'Bearer static-token-of-ann');
		expect(viaStatic.status).toBe(200);
		expect(viaStatic.body).toEqual({ data: [] });
	});

	test('bodies: missing password 400, wrong password 401, missing response 400', async () => {
		const agent = await start();

		expect(
			(await agent.post('/backoffice/users/me/passkeys/options').set('Authorization', userToken()).send({})).status,
		).toBe(400);
		expect(
			(
				await agent
					.post('/backoffice/users/me/passkeys/options')
					.set('Authorization', userToken())
					.send({ password: 'x' })
			).status,
		).toBe(401);
		expect((await agent.post('/backoffice/auth/passkey/login').send({ mode: 'session' })).status).toBe(400);
	});
});

describe('register, list, login, manage', () => {
	test('register then list: public columns only', async () => {
		const agent = await start();

		const created = await registerPasskey(agent);
		expect(created.status).toBe(200);
		expect(created.body.data).toMatchObject({ name: 'MacBook', last_used: null, backed_up: false });

		const list = await agent.get('/backoffice/users/me/passkeys').set('Authorization', userToken());
		expect(list.body.data).toHaveLength(1);
		expect(list.body.data[0]).not.toHaveProperty('credential_id');
		expect(await state.db('backoffice_passkeys').select('credential_id', 'user')).toEqual([
			{ credential_id: 'cred-1', user: USER },
		]);
	});

	test('login mode session: session cookie, session row marked, globals enforce_tfa false (D-207.5)', async () => {
		const agent = await start();
		await registerPasskey(agent);

		const res = await loginWithPasskey(agent, 'session');

		expect(res.status).toBe(200);
		expect(Object.keys(res.body.data)).toEqual(['expires']);
		const cookie = res.headers['set-cookie']![0]!;
		expect(cookie).toMatch(new RegExp(`^${defaults['SESSION_COOKIE_NAME']}=`));

		const sessions = await state.db('directus_sessions').select('user', 'bo_passkey');
		expect(sessions).toEqual([{ user: USER, bo_passkey: 1 }]);

		const [row] = await state.db('backoffice_passkeys').select('counter', 'last_used');
		expect(Number(row.counter)).toBe(1);
		expect(row.last_used).not.toBeNull();

		const globals = await agent.get('/policies/me/globals').set('Cookie', cookie.split(';')[0]!);
		expect(globals.body.data).toMatchObject({ enforce_tfa: false });
	});

	test('a password session of the same user keeps enforce_tfa true', async () => {
		const agent = await start();

		const res = await agent
			.post('/auth/login')
			.send({ email: 'user@example.com', password: PASSWORD, mode: 'session' });
		const globals = await agent
			.get('/policies/me/globals')
			.set('Cookie', res.headers['set-cookie']![0]!.split(';')[0]!);

		expect(globals.body.data).toMatchObject({ enforce_tfa: true });
		expect(await state.db('directus_sessions').select('bo_passkey')).toEqual([{ bo_passkey: null }]);
	});

	test('login mode json gives both tokens; a challenge is used once', async () => {
		const agent = await start();
		await registerPasskey(agent);

		const options = await agent.post('/backoffice/auth/passkey/login/options');

		const body = {
			mode: 'json',
			response: {
				id: 'cred-1',
				type: 'public-key',
				response: { clientDataJSON: signed(options.body.data.challenge), authenticatorData: 'a', signature: 's' },
			},
		};

		const first = await agent.post('/backoffice/auth/passkey/login').send(body);
		expect(Object.keys(first.body.data).sort()).toEqual(['access_token', 'expires', 'refresh_token']);

		const replay = await agent.post('/backoffice/auth/passkey/login').send(body);
		expect(replay.status).toBe(401);
		expect(replay.body.errors[0].extensions.code).toBe('INVALID_CREDENTIALS');
	});

	test("rename, delete own; admin lists and deletes another user's; a deleted user loses the rows (D-207.2)", async () => {
		const agent = await start();
		const { id } = (await registerPasskey(agent)).body.data;

		const renamed = await agent
			.patch(`/backoffice/users/me/passkeys/${id}`)
			.set('Authorization', userToken())
			.send({ name: 'Work laptop' });
		expect(renamed.body.data.name).toBe('Work laptop');

		const listed = await agent.get(`/backoffice/users/${USER}/passkeys`).set('Authorization', adminToken());
		expect(listed.body.data.map((p: { name: string }) => p.name)).toEqual(['Work laptop']);

		expect(
			(await agent.delete(`/backoffice/users/${USER}/passkeys/${id}`).set('Authorization', adminToken())).status,
		).toBe(204);
		expect(await state.db('backoffice_passkeys')).toEqual([]);

		await registerPasskey(agent);
		expect((await agent.delete(`/users/${USER}`).set('Authorization', adminToken())).status).toBe(204);
		expect(await state.db('backoffice_passkeys')).toEqual([]);
	});
});
