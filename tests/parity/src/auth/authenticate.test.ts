// Feature 003, US3.1 to US3.8: the authenticate step on POST /users/me/tfa/generate (the only route of this feature
// that needs a user) with every way and kind of token Directus accepts. generate writes nothing, so the same token
// goes to both apps at once (parity()). Routes of feature 001 still ignore tokens (D-10).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertParity, capture, parity, type ParityRequest } from '../parity.js';
import { cleanupFixtures, createRole, createUser, PASSWORD, type User, updateUser } from './fixtures.js';
import { cookiePair } from './flows.js';
import { signAccessToken } from './tokens.js';

const DIRECTUS = () => process.env['DIRECTUS_URL']!;

const STATIC_TOKEN = `parity-static-${Date.now()}`;
let user: User;
let role: string;

beforeAll(async () => {
	role = await createRole('parity-authenticate', { app: true });
	user = await createUser('authenticate', { role, token: STATIC_TOKEN });
}, 60_000);

afterAll(cleanupFixtures, 60_000);

const generate = (
	headers: Record<string, string> = {},
	body: Record<string, unknown> = { password: PASSWORD },
	query = '',
) => ({ method: 'POST', path: `/users/me/tfa/generate${query}`, headers, body }) satisfies ParityRequest;

async function loginAt(mode: 'json' | 'session', who: User = user) {
	return capture(DIRECTUS(), {
		method: 'POST',
		path: '/auth/login',
		body: { email: who.email, password: PASSWORD, mode },
	});
}

const accessToken = async (who?: User) => ((await loginAt('json', who)).json as any).data.access_token as string;

async function expectParity(req: ParityRequest, status: number, code?: string) {
	const result = await parity(req);
	assertParity(result);
	expect(result.directus.status).toBe(status);
	if (code) expect((result.directus.json as any).errors[0].extensions.code).toBe(code);
	return result;
}

describe('POST /users/me/tfa/generate', () => {
	it('US3.1: Bearer access token; no password 400', async () => {
		const token = await accessToken();
		const ok = await expectParity(generate({ authorization: `Bearer ${token}` }), 200);
		expect((ok.backoffice.json as any).data.otpauth_url).toContain(encodeURIComponent(user.email));

		await expectParity(generate({ authorization: `Bearer ${token}` }, {}), 400, 'INVALID_PAYLOAD');
	});

	it('US3.2: access_token query parameter and session cookie', async () => {
		await expectParity(generate({}, { password: PASSWORD }, `?access_token=${await accessToken()}`), 200);
		await expectParity(generate({ cookie: cookiePair(await loginAt('session')) }), 200);
	});

	it('US3.3: header and query at once 400; a cookie is ignored next to a header', async () => {
		const token = await accessToken();
		await expectParity(
			generate({ authorization: `Bearer ${token}` }, undefined, `?access_token=${token}`),
			400,
			'INVALID_PAYLOAD',
		);
		await expectParity(generate({ authorization: `Bearer ${token}`, cookie: 'directus_session_token=nope' }), 200);
	});

	it('US3.4: static token; unknown static token 401', async () => {
		await expectParity(generate({ authorization: `Bearer ${STATIC_TOKEN}` }), 200);
		await expectParity(generate({ authorization: 'Bearer not-a-known-static-token' }), 401, 'INVALID_CREDENTIALS');
	});

	it('US3.5: expired 401 TOKEN_EXPIRED; wrong signature or missing claims 403 INVALID_TOKEN', async () => {
		const claims = { id: user.id, role, app_access: true, admin_access: false };

		await expectParity(
			generate({ authorization: `Bearer ${signAccessToken(claims, { expiresIn: -10 })}` }),
			401,
			'TOKEN_EXPIRED',
		);
		await expectParity(
			generate({ authorization: `Bearer ${signAccessToken(claims, { secret: 'other-secret' })}` }),
			403,
			'INVALID_TOKEN',
		);

		const { role: _role, ...noRole } = claims;
		await expectParity(
			generate({ authorization: `Bearer ${signAccessToken(noRole as typeof claims)}` }),
			403,
			'INVALID_TOKEN',
		);
	});

	it('US3.6: deleted session 401, the session cookie cleared', async () => {
		const login = await loginAt('session');
		const cookie = cookiePair(login);
		await capture(DIRECTUS(), { method: 'POST', path: '/auth/logout', headers: { cookie }, body: { mode: 'session' } });

		const result = await expectParity(generate({ cookie }), 401, 'INVALID_CREDENTIALS');
		expect(result.backoffice.headers['set-cookie']).toMatch(/^directus_session_token=;/);

		// From the header instead, nothing to clear.
		const bearer = await expectParity(generate({ authorization: `Bearer ${cookie.split('=')[1]}` }), 401);
		expect(bearer.backoffice.headers['set-cookie']).toBeUndefined();
	});

	it('US3.7: a user suspended after the token was issued', async () => {
		const other = await createUser('authenticate-suspended', { role });
		const token = await accessToken(other);
		await updateUser(other.id, { status: 'suspended' });

		await expectParity(generate({ authorization: `Bearer ${token}` }), 200);
	});

	it('no token: 401 INVALID_CREDENTIALS', async () => {
		await expectParity(generate(), 401, 'INVALID_CREDENTIALS');
	});
});

describe('US3.8: routes of feature 001 stay public with a token (D-10)', () => {
	it.each(['/server/info', '/server/health', '/server/specs/oas', '/nope'])('%s', async (path) => {
		const expired = signAccessToken({ id: user.id, role, app_access: true, admin_access: false }, { expiresIn: -10 });

		for (const authorization of [`Bearer ${expired}`, 'Bearer not-a-known-static-token']) {
			const result = await parity({ path, headers: { authorization } });
			assertParity(result);
		}
	});
});
