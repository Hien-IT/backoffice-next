// Ported from directus/tests/blackbox/tests/common/auth/login.test.ts (the REST part: GraphQL comes with feature 011,
// WebSockets are D-08), on parity(): the same request to both apps, tokens compared by their claims and kind
// (normalizeJwt, normalizeSetCookie). Feature 003 adds the modes, payload errors, providers and the cross-use check.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertParity, capture, parity, type ParityRequest } from '../parity.js';
import { profileUrls } from '../profiles.js';
import { parseSuite } from '../suite.js';
import { cleanupFixtures, createRole, createUser, PASSWORD, type User } from './fixtures.js';
import { decodeJwt } from './tokens.js';

const suite = parseSuite();

const login = (body: Record<string, unknown>, path = '/auth/login'): ParityRequest => ({ method: 'POST', path, body });

// The 4 users of the blackbox suite (common/variables.ts TEST_USERS): admin, app access, API only, no role.
const users: Record<string, User> = {};

beforeAll(async () => {
	const admin = await createRole('parity-login-admin', { admin: true, app: true });
	const app = await createRole('parity-login-app', { app: true });
	const api = await createRole('parity-login-api');

	users['admin'] = await createUser('login-admin', { role: admin });
	users['app'] = await createUser('login-app', { role: app });
	users['api'] = await createUser('login-api', { role: api });
	users['no role'] = await createUser('login-norole');
}, 60_000);

afterAll(cleanupFixtures, 60_000);

describe('POST /auth/login', () => {
	describe('correct credentials: access_token, expires and refresh_token', () => {
		it.each(['admin', 'app', 'api', 'no role'])('%s', async (key) => {
			const user = users[key]!;
			const result = await parity(login({ email: user.email, password: PASSWORD }));

			assertParity(result);
			expect(result.directus.status).toBe(200);
			expect(result.backoffice.json).toMatchObject({
				data: { access_token: expect.any(String), expires: expect.any(Number), refresh_token: expect.any(String) },
			});
		});
	});

	it.each(['json', 'cookie', 'session'])('mode %s: body, Set-Cookie, claims and ttl', async (mode) => {
		const user = users['app']!;
		const result = await parity(login({ email: user.email, password: PASSWORD, mode }));

		assertParity(result);
		expect(result.directus.status).toBe(200);
		if (mode !== 'json') expect(result.backoffice.headers['set-cookie']).toBeDefined();
	});

	it('email of another case', async () => {
		const user = users['api']!;
		const result = await parity(login({ email: user.email.toUpperCase(), password: PASSWORD }));

		assertParity(result);
		expect(result.directus.status).toBe(200);
	});

	describe('incorrect credentials and payloads', () => {
		it.each([
			['wrong password: 401 INVALID_CREDENTIALS', () => ({ email: users['admin']!.email, password: `${PASSWORD}typo` })],
			['unknown email: 401 INVALID_CREDENTIALS', () => ({ email: 'nobody-parity@example.com', password: PASSWORD })],
			['invalid email: 400 INVALID_PAYLOAD', () => ({ email: 'invalid@email', password: PASSWORD })],
			['no password: 400 INVALID_PAYLOAD', () => ({ email: users['admin']!.email })],
			['unknown mode: 400 INVALID_PAYLOAD', () => ({ email: users['admin']!.email, password: PASSWORD, mode: 'x' })],
			['otp not a string: 400 INVALID_PAYLOAD', () => ({ email: users['admin']!.email, password: PASSWORD, otp: 123 })],
			['empty body: 400 INVALID_PAYLOAD', () => ({})],
		])('%s', async (name, body) => {
			const result = await parity(login(body()));

			assertParity(result);
			expect(result.directus.status).toBe(Number(name.match(/: (\d+)/)![1]));
		});
	});

	it('an access token of the new app works at GET /users/me of Directus', async () => {
		const user = users['app']!;
		const res = await capture(process.env['BACKOFFICE_URL']!, login({ email: user.email, password: PASSWORD }));
		const token = (res.json as { data: { access_token: string } }).data.access_token;
		expect(decodeJwt(token)).toMatchObject({ id: user.id, iss: 'directus' });

		const me = await capture(process.env['DIRECTUS_URL']!, {
			path: '/users/me?fields=id,email',
			headers: { authorization: `Bearer ${token}` },
		});

		expect(me.status).toBe(200);
		expect(me.json).toEqual({ data: { id: user.id, email: user.email } });
	});
});

describe.runIf(suite === 'full' && profileUrls('sso'))('POST /auth/login/:provider (profile sso)', () => {
	const options = () => profileUrls('sso')!;
	let local2: User;

	beforeAll(async () => {
		local2 = await createUser('login-local2', { provider: 'local2' });
	});

	it.each(['/auth/login/local2', '/auth/login/LOCAL2', '/auth/login/local2/'])('%s: a local provider', async (path) => {
		const result = await parity(login({ email: local2.email, password: PASSWORD }, path), options());

		assertParity(result);
		expect(result.directus.status).toBe(200);
	});

	it('a user of another provider: 401 at /auth/login/local2 and at /auth/login', async () => {
		const other = await parity(login({ email: users['app']!.email, password: PASSWORD }, '/auth/login/local2'), options());
		assertParity(other);
		expect(other.directus.status).toBe(401);

		const fromDefault = await parity(login({ email: local2.email, password: PASSWORD }), options());
		assertParity(fromDefault);
		expect(fromDefault.directus.status).toBe(401);
	});

	it.each(['/auth/login/oidc', '/auth/login/saml', '/auth/login/nope', '/auth/login/default', '/auth/login/local2/x'])(
		'POST %s: 404',
		async (path) => {
			const result = await parity(login({ email: local2.email, password: PASSWORD }, path), options());

			assertParity(result);
			expect(result.directus.status).toBe(404);
		},
	);
});
