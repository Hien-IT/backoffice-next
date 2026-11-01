// Spec 029 (T021, contracts/tests.md, research R9): passkey login and management. The routes exist at Backoffice only
// (D-207, Directus 404), so each app is called on its own; real WebAuthn ceremonies come from the software
// authenticator of webauthn-fake.ts. Sessions a passkey creates are plain sessions of the shared database: Directus
// refreshes, uses and ends them (SC-007); /policies/me/globals answers enforce_tfa false for them at Backoffice only
// (D-207.5); deleting a user at Backoffice deletes its passkeys (D-207.2).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appPorts } from '../config.js';
import { adminToken } from '../directus-api.js';
import { capture, type Captured } from '../parity.js';
import { closeRedis, redis } from '../redis.js';
import { closeHostDb, hostDb } from './db-effects.js';
import {
	cleanupFixtures,
	createRole,
	createUser,
	PASSWORD,
	setSettings,
	updateUser,
	urls,
	type User,
} from './fixtures.js';
import { cookieNamed } from './flows.js';
import { createFakeAuthenticator } from './webauthn-fake.js';

// PUBLIC_URL of env/<vendor>.env, shared by both apps of the main pair: the RP ID is "localhost" and this the origin.
const ORIGIN = `http://localhost:${appPorts.directus}`;
const SESSION_COOKIE = 'directus_session_token';

const { directus: D, backoffice: B } = urls();

interface CallOptions {
	token?: string;
	cookie?: string;
	body?: Record<string, unknown> | unknown[];
}

const call = (base: string, method: string, path: string, options: CallOptions = {}): Promise<Captured> =>
	capture(base, {
		method,
		path,
		headers: {
			...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
			...(options.cookie ? { cookie: options.cookie } : {}),
		},
		...(options.body !== undefined ? { body: options.body } : {}),
	});

const data = (res: Captured) => (res.json as { data: any }).data;
const code = (res: Captured) =>
	(res.json as { errors?: { extensions: { code: string } }[] }).errors?.[0]?.extensions.code;

type Fake = ReturnType<typeof createFakeAuthenticator>;
type Local = User & { token: string; fake: Fake };

const statics: string[] = [];

async function localUser(prefix: string, options: Parameters<typeof createUser>[1] = {}): Promise<Local> {
	const token = `parity-passkey-${prefix}-${Math.random().toString(16).slice(2)}`;
	statics.push(token);
	const user = await createUser(`passkey-${prefix}`, { token, ...options });
	return { ...user, token, fake: createFakeAuthenticator({ origin: ORIGIN }) };
}

async function register(user: Local, ceremony: { origin?: string; uv?: boolean } = {}, name = 'Laptop') {
	const options = await call(B, 'POST', '/backoffice/users/me/passkeys/options', {
		token: user.token,
		body: { password: PASSWORD },
	});

	expect(options.status, options.text).toBe(200);
	const response = user.fake.register(data(options), ceremony);
	return call(B, 'POST', '/backoffice/users/me/passkeys', { token: user.token, body: { response, name } });
}

async function loginOptions() {
	const options = await call(B, 'POST', '/backoffice/auth/passkey/login/options');
	expect(options.status, options.text).toBe(200);
	return data(options);
}

async function passkeyLogin(user: Local, mode = 'session', ceremony: Parameters<Fake['authenticate']>[1] = {}) {
	const response = user.fake.authenticate(await loginOptions(), ceremony);
	return call(B, 'POST', '/backoffice/auth/passkey/login', { body: { response, mode } });
}

const userStatus = async (user: User) =>
	(await hostDb()('directus_users').select('status').where({ id: user.id }).first()).status as string;

let admin: string;

beforeAll(async () => {
	admin = await adminToken('backoffice');
}, 60_000);

afterAll(async () => {
	await cleanupFixtures();
	await closeHostDb();
	await closeRedis();
}, 60_000);

describe('routes (D-207)', () => {
	const routes: [string, string][] = [
		['GET', '/backoffice/auth/passkey'],
		['POST', '/backoffice/auth/passkey/login/options'],
		['POST', '/backoffice/auth/passkey/login'],
		['GET', '/backoffice/users/me/passkeys'],
		['POST', '/backoffice/users/me/passkeys/options'],
		['POST', '/backoffice/users/me/passkeys'],
		['PATCH', '/backoffice/users/me/passkeys/x'],
		['DELETE', '/backoffice/users/me/passkeys/x'],
		['GET', '/backoffice/users/x/passkeys'],
		['DELETE', '/backoffice/users/x/passkeys/x'],
	];

	it.each(routes)('%s %s: Directus 404 ROUTE_NOT_FOUND', async (method, path) => {
		const res = await call(D, method, path, { token: await adminToken('directus'), body: {} });
		expect(res.status).toBe(404);
		expect(code(res)).toBe('ROUTE_NOT_FOUND');
	});

	it('Backoffice gives the RP ID of PUBLIC_URL', async () => {
		expect(data(await call(B, 'GET', '/backoffice/auth/passkey'))).toEqual({ rp_id: 'localhost' });
	});

	it('401 without a user, 403 for an LDAP user and a non-admin on another user, 400 bad body, 401 wrong password', async () => {
		const local = await localUser('guard');
		const ldap = await localUser('ldap', { provider: 'ldap', password: null, external_identifier: 'ldap-passkey' });

		expect((await call(B, 'GET', '/backoffice/users/me/passkeys')).status).toBe(401);
		expect((await call(B, 'GET', '/backoffice/users/me/passkeys', { token: ldap.token })).status).toBe(403);
		expect((await call(B, 'GET', `/backoffice/users/${ldap.id}/passkeys`, { token: local.token })).status).toBe(403);
		// A static token is accepted like /users/me/tfa/* (FR-020).
		expect(data(await call(B, 'GET', '/backoffice/users/me/passkeys', { token: local.token }))).toEqual([]);

		expect((await call(B, 'POST', '/backoffice/auth/passkey/login', { body: { mode: 'session' } })).status).toBe(400);

		const wrong = await call(B, 'POST', '/backoffice/users/me/passkeys/options', {
			token: local.token,
			body: { password: 'wrong-password' },
		});

		expect(wrong.status).toBe(401);
		expect(code(wrong)).toBe('INVALID_CREDENTIALS');
	});

	it('backoffice_passkeys is a hidden system collection; no /backoffice/ path in the OAS (FR-022, FR-029)', async () => {
		expect((await call(B, 'GET', '/items/backoffice_passkeys', { token: admin })).status).toBe(403);

		const types = await call(B, 'POST', '/graphql/system', {
			token: admin,
			body: { query: '{ __schema { types { name } } }' },
		});

		expect(JSON.stringify(types.json)).not.toContain('backoffice_passkeys');

		const oas = await call(B, 'GET', '/server/specs/oas', { token: admin });
		expect(
			Object.keys((oas.json as { paths: Record<string, unknown> }).paths).filter((p) => p.startsWith('/backoffice')),
		).toEqual([]);
	});
});

describe('register and log in (US1, US2)', () => {
	it('register, list, log in with each mode like /auth/login, counter and last_used updated', async () => {
		const user = await localUser('flow');

		const created = await register(user);
		expect(created.status, created.text).toBe(200);
		expect(data(created)).toMatchObject({ name: 'Laptop', last_used: null, transports: ['internal'] });
		expect(data(created)).not.toHaveProperty('credential_id');

		const listed = data(await call(B, 'GET', '/backoffice/users/me/passkeys', { token: user.token }));
		expect(listed.map((p: { name: string }) => p.name)).toEqual(['Laptop']);

		const password = await call(B, 'POST', '/auth/login', {
			body: { email: user.email, password: PASSWORD, mode: 'json' },
		});

		for (const mode of ['json', 'cookie', 'session']) {
			const res = await passkeyLogin(user, mode);
			expect(res.status, `${mode}: ${res.text}`).toBe(200);

			const local = await call(B, 'POST', '/auth/login', { body: { email: user.email, password: PASSWORD, mode } });
			expect(Object.keys(data(res)).sort()).toEqual(Object.keys(data(local)).sort());
			expect(Boolean(res.headers['set-cookie'])).toBe(Boolean(local.headers['set-cookie']));
		}

		expect(password.status).toBe(200);

		const row = await hostDb()('backoffice_passkeys').where({ user: user.id }).first();
		expect(Number(row.counter)).toBe(3);
		expect(row.last_used).not.toBeNull();

		const sessions = await hostDb()('directus_sessions').select('bo_passkey').where({ user: user.id });
		// The three passkey logins (json, cookie, session) are marked; the four password logins are not.
		expect(sessions.filter((s: { bo_passkey: unknown }) => Boolean(s.bo_passkey)).length).toBe(3);
		expect(sessions.filter((s: { bo_passkey: unknown }) => !s.bo_passkey).length).toBe(4);

		const [activity] = await hostDb()('directus_activity')
			.where({ user: user.id, action: 'login' })
			.count('* as count');
		expect(Number(activity?.['count'])).toBeGreaterThanOrEqual(7);
	});

	it('origin other than PUBLIC_URL: registration 400, login 401 (FR-027)', async () => {
		const user = await localUser('origin');

		const bad = await register(user, { origin: 'http://evil.localhost' });
		expect(bad.status).toBe(400);

		expect((await register(user)).status).toBe(200);
		const res = await passkeyLogin(user, 'json', { origin: 'http://evil.localhost' });
		expect(res.status).toBe(401);
		expect(code(res)).toBe('INVALID_CREDENTIALS');
	});

	it('registration without user verification is refused (FR-002)', async () => {
		const user = await localUser('uv');
		expect((await register(user, { uv: false })).status).toBe(400);
	});
});

describe('TFA and sessions (US1, D-207.3, D-207.5, SC-007)', () => {
	it('TFA user and enforcing role: no OTP, enforce_tfa false at Backoffice, true at Directus, kept on refresh', async () => {
		// Admin so the GraphQL schema has policies_me_globals (it needs read access to directus_policies, like DR).
		const role = await createRole('passkey-enforce', { app: true, admin: true, enforceTfa: true });
		const user = await localUser('tfa', { role, tfa_secret: 'JBSWY3DPEHPK3PXP' });
		expect((await register(user)).status).toBe(200);

		const login = await passkeyLogin(user, 'session');
		expect(login.status, login.text).toBe(200);
		const cookie = cookieNamed(login, SESSION_COOKIE);

		const globals = async (base: string, c: string) =>
			(data(await call(base, 'GET', '/policies/me/globals', { cookie: c })) as { enforce_tfa: boolean }).enforce_tfa;

		expect(await globals(B, cookie)).toBe(false);
		expect(await globals(D, cookie)).toBe(true);

		const gql = await call(B, 'POST', '/graphql/system', {
			cookie,
			body: { query: '{ policies_me_globals { enforce_tfa } }' },
		});

		expect(data(gql), gql.text).toEqual({ policies_me_globals: { enforce_tfa: false } });

		const refreshed = await call(B, 'POST', '/auth/refresh', { cookie, body: { mode: 'session' } });
		expect(refreshed.status).toBe(200);
		expect(await globals(B, cookieNamed(refreshed, SESSION_COOKIE))).toBe(false);

		// A password session of the same user (it has an OTP secret, so the OTP goes with it) keeps the DR answer.
		const { authenticator } = await import('otplib');
		const password = await call(B, 'POST', '/auth/login', {
			body: { email: user.email, password: PASSWORD, mode: 'session', otp: authenticator.generate('JBSWY3DPEHPK3PXP') },
		});

		expect(password.status, password.text).toBe(200);
		expect(await globals(B, cookieNamed(password, SESSION_COOKIE))).toBe(true);
	});

	it('Directus refreshes, uses and ends a passkey session (SC-007)', async () => {
		const user = await localUser('cross');
		expect((await register(user)).status).toBe(200);

		const login = await passkeyLogin(user, 'session');
		const cookie = cookieNamed(login, SESSION_COOKIE);

		const refreshed = await call(D, 'POST', '/auth/refresh', { cookie, body: { mode: 'session' } });
		expect(refreshed.status, refreshed.text).toBe(200);
		const next = cookieNamed(refreshed, SESSION_COOKIE);

		expect(data(await call(D, 'GET', '/users/me?fields=id', { cookie: next }))).toEqual({ id: user.id });
		expect((await call(D, 'POST', '/auth/logout', { cookie: next, body: { mode: 'session' } })).status).toBe(204);
	});
});

describe('safety (US4)', () => {
	it('a challenge is used once, also by two requests at once; a registration challenge does not log in', async () => {
		const user = await localUser('challenge');
		expect((await register(user)).status).toBe(200);

		const response = user.fake.authenticate(await loginOptions());
		const body = { response, mode: 'json' };

		const both = await Promise.all([
			call(B, 'POST', '/backoffice/auth/passkey/login', { body }),
			call(B, 'POST', '/backoffice/auth/passkey/login', { body }),
		]);

		expect(both.map((r) => r.status).sort()).toEqual([200, 401]);
		expect((await call(B, 'POST', '/backoffice/auth/passkey/login', { body })).status).toBe(401);

		const registration = await call(B, 'POST', '/backoffice/users/me/passkeys/options', {
			token: user.token,
			body: { password: PASSWORD },
		});

		const misuse = user.fake.authenticate({ challenge: data(registration).challenge, rpId: 'localhost' });
		expect((await call(B, 'POST', '/backoffice/auth/passkey/login', { body: { response: misuse } })).status).toBe(401);
	});

	it('an expired challenge (gone from Redis) is refused', async () => {
		const user = await localUser('expired');
		expect((await register(user)).status).toBe(200);

		const response = user.fake.authenticate(await loginOptions());
		const keys = await redis().keys('*backoffice:passkey:*');
		if (keys.length) await redis().del(...keys);

		expect((await call(B, 'POST', '/backoffice/auth/passkey/login', { body: { response } })).status).toBe(401);
	});

	it('failed signatures count into auth_login_attempts and suspend like wrong passwords; unknown credentials do not', async () => {
		const restore = await setSettings({ auth_login_attempts: 3 });

		try {
			const user = await localUser('attempts');
			expect((await register(user)).status).toBe(200);
			expect((await passkeyLogin(user, 'json')).status).toBe(200);

			// Counter 1 again: not above the stored one (replay), refused and counted (FR-024).
			for (let i = 0; i < 4 && (await userStatus(user)) === 'active'; i++) {
				const res = await passkeyLogin(user, 'json', { counter: 1 });
				expect(res.status).toBe(401);
				expect(code(res)).toBe('INVALID_CREDENTIALS');
			}

			expect(await userStatus(user)).toBe('suspended');

			const uvless = await localUser('uvless');
			expect((await register(uvless)).status).toBe(200);
			expect((await passkeyLogin(uvless, 'json', { uv: false })).status).toBe(401);

			// A credential nobody registered: the generic error after the stall, no user touched.
			const stranger = createFakeAuthenticator({ origin: ORIGIN });
			stranger.register({ challenge: 'x', rp: { id: 'localhost' }, user: { id: 'eA' } });
			const start = Date.now();
			const unknown = await call(B, 'POST', '/backoffice/auth/passkey/login', {
				body: { response: stranger.authenticate(await loginOptions()) },
			});

			const unknownMs = Date.now() - start;
			expect(unknown.status).toBe(401);

			const wrongStart = Date.now();
			await call(B, 'POST', '/auth/login', { body: { email: uvless.email, password: 'wrong-password' } });
			const wrongMs = Date.now() - wrongStart;

			// SC-004: both wait for LOGIN_STALL_TIME; within 10 % plus network jitter.
			expect(Math.abs(unknownMs - wrongMs)).toBeLessThanOrEqual(Math.max(wrongMs * 0.1, 0) + 150);
		} finally {
			await restore();
		}
	});

	it('an invited user with a passkey is refused before the limiter and stays invited (H1)', async () => {
		const user = await localUser('invited');
		expect((await register(user)).status).toBe(200);
		await updateUser(user.id, { status: 'invited' });

		expect((await passkeyLogin(user, 'json')).status).toBe(401);
		expect(await userStatus(user)).toBe('invited');
		expect(await redis().get(`rlflx:${user.id}`)).toBeNull();
	});
});

describe('management and lifecycle (US2, US3, D-207.2)', () => {
	it("rename and delete own; admin lists and deletes another user's", async () => {
		const user = await localUser('manage');
		const { id } = data(await register(user));

		const renamed = await call(B, 'PATCH', `/backoffice/users/me/passkeys/${id}`, {
			token: user.token,
			body: { name: 'Work' },
		});

		expect(data(renamed).name).toBe('Work');

		const second = data(await register(user, {}, 'Phone'));
		expect((await call(B, 'DELETE', `/backoffice/users/me/passkeys/${second.id}`, { token: user.token })).status).toBe(
			204,
		);

		const listed = data(await call(B, 'GET', `/backoffice/users/${user.id}/passkeys`, { token: admin }));
		expect(listed.map((p: { name: string }) => p.name)).toEqual(['Work']);

		expect((await call(B, 'DELETE', `/backoffice/users/${user.id}/passkeys/${id}`, { token: admin })).status).toBe(204);
		expect(await hostDb()('backoffice_passkeys').where({ user: user.id })).toEqual([]);
	});

	it('deleting a user at Backoffice deletes its passkeys; at Directus the orphan row cannot log in', async () => {
		const atBackoffice = await localUser('delete-bo');
		expect((await register(atBackoffice)).status).toBe(200);
		expect((await call(B, 'DELETE', `/users/${atBackoffice.id}`, { token: admin })).status).toBe(204);
		expect(await hostDb()('backoffice_passkeys').where({ user: atBackoffice.id })).toEqual([]);

		const atDirectus = await localUser('delete-dr');
		expect((await register(atDirectus)).status).toBe(200);
		expect((await call(D, 'DELETE', `/users/${atDirectus.id}`, { token: await adminToken('directus') })).status).toBe(
			204,
		);
		expect(await hostDb()('backoffice_passkeys').where({ user: atDirectus.id })).toHaveLength(1);
		expect((await passkeyLogin(atDirectus, 'json')).status).toBe(401);

		await hostDb()('backoffice_passkeys').where({ user: atDirectus.id }).delete();
	});
});
