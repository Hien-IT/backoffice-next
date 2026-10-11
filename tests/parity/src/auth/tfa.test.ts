// Feature 003, US5.1 to US5.6: TFA. The new app generates secrets and checks OTPs at login; a secret made by the new
// app is enabled through Directus. Enabling and disabling at the new app: permissions/tfa-toggle.test.ts (feature 004).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { directusRequest } from '../directus-api.js';
import { assertParity, capture, parity, type ParityRequest } from '../parity.js';
import { closeHostDb, hostDb } from './db-effects.js';
import { cleanupFixtures, createRole, createUser, PASSWORD, type User } from './fixtures.js';
import { post } from './flows.js';
import { decodeJwt, totp } from './tokens.js';

const STATIC = `parity-tfa-${Date.now()}`;
let tfaUser: User;

afterAll(async () => {
	await cleanupFixtures();
	await closeHostDb();
}, 60_000);

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

async function tokenAt(url: string, user: User): Promise<string> {
	const res = await capture(url, post('/auth/login', { email: user.email, password: PASSWORD }));
	return (res.json as any).data.access_token;
}

async function expectParity(req: ParityRequest, status: number, code?: string) {
	const result = await parity(req);
	assertParity(result);
	expect(result.directus.status).toBe(status);
	if (code) expect((result.directus.json as any).errors[0].extensions.code).toBe(code);
	return result;
}

describe('TFA', () => {
	beforeAll(async () => {
		// Enabling TFA at Directus updates the user with its own permissions (app access only reads directus_users).
		tfaUser = await createUser('tfa', { role: await createRole('parity-tfa', { admin: true, app: true }) });
	}, 60_000);

	it('US5.1, US5.2: a secret of the new app, enabled at Directus, then a login with OTP at the new app', async () => {
		const generated = await capture(process.env['BACKOFFICE_URL']!, {
			...post('/users/me/tfa/generate', { password: PASSWORD }),
			headers: bearer(await tokenAt(process.env['BACKOFFICE_URL']!, tfaUser)),
		});

		expect(generated.status).toBe(200);
		const { secret, otpauth_url } = (generated.json as any).data;
		expect(otpauth_url).toMatch(
			new RegExp(`^otpauth://totp/.+\\?secret=${secret}&period=30&digits=6&algorithm=SHA1&issuer=`),
		);
		expect((await hostDb()('directus_users').where({ id: tfaUser.id }).first()).tfa_secret).toBeNull();

		const enabled = await capture(process.env['DIRECTUS_URL']!, {
			...post('/users/me/tfa/enable', { secret, otp: totp(secret) }),
			headers: bearer(await tokenAt(process.env['DIRECTUS_URL']!, tfaUser)),
		});

		expect(enabled.status).toBe(204);

		const login = await capture(
			process.env['BACKOFFICE_URL']!,
			post('/auth/login', { email: tfaUser.email, password: PASSWORD, otp: totp(secret) }),
		);
		expect(login.status).toBe(200);
	});

	it('US5.3: no OTP or a wrong OTP 401 INVALID_OTP; the right OTP logs in', async () => {
		const secret = 'JBSWY3DPEHPK3PXP';
		const user = await createUser('tfa-login', { tfa_secret: secret });

		await expectParity(post('/auth/login', { email: user.email, password: PASSWORD }), 401, 'INVALID_OTP');
		await expectParity(
			post('/auth/login', { email: user.email, password: PASSWORD, otp: '000000' }),
			401,
			'INVALID_OTP',
		);
		await expectParity(post('/auth/login', { email: user.email, password: PASSWORD, otp: totp(secret) }), 200);
	});

	it('US5.4: generate errors like Directus', async () => {
		const user = await createUser('tfa-errors');
		const token = await tokenAt(process.env['DIRECTUS_URL']!, user);
		const generate = (headers: Record<string, string>, body: Record<string, unknown> = { password: PASSWORD }) =>
			({ ...post('/users/me/tfa/generate', body), headers }) satisfies ParityRequest;

		await expectParity(generate({}), 401, 'INVALID_CREDENTIALS');
		await expectParity(generate(bearer(token), {}), 400, 'INVALID_PAYLOAD');
		await expectParity(generate(bearer(token), { password: 'wrong' }), 401, 'INVALID_CREDENTIALS');

		const withTfa = await createUser('tfa-on', { tfa_secret: 'JBSWY3DPEHPK3PXP', token: `${STATIC}-on` });
		expect(withTfa.id).toBeTruthy();
		await expectParity(generate(bearer(`${STATIC}-on`)), 400, 'INVALID_PAYLOAD');

		// A default user without email, through its static token.
		const noEmail = await directusRequest('POST', '/users', {
			password: PASSWORD,
			status: 'active',
			token: `${STATIC}-noemail`,
		});
		try {
			await expectParity(generate(bearer(`${STATIC}-noemail`)), 400, 'INVALID_PAYLOAD');
		} finally {
			await directusRequest('DELETE', `/users/${noEmail.data.id}`);
		}

		// An SSO user needs no password.
		await createUser('tfa-sso', {
			provider: 'oidc',
			external_identifier: `tfa-sub-${Date.now()}`,
			token: `${STATIC}-sso`,
		});
		await expectParity(generate(bearer(`${STATIC}-sso`), {}), 200);
	});

	it('US5.5: enforce_tfa of a policy in the access token', async () => {
		const user = await createUser('tfa-enforce', {
			role: await createRole('parity-tfa-enforce', { enforceTfa: true }),
		});
		const result = await expectParity(post('/auth/login', { email: user.email, password: PASSWORD }), 200);
		expect(decodeJwt((result.backoffice.json as any).data.access_token)).toMatchObject({ enforce_tfa: true });
	});

	it.each(['/users/me/tfa/enable', '/users/me/tfa/disable', `/users/00000000-0000-4000-8000-000000000000/tfa/disable`])(
		'US5.6: POST %s without a token: 401 at both apps (built by feature 004, D-09.10 removed)',
		async (path) => {
			await expectParity(post(path, {}), 401, 'INVALID_CREDENTIALS');
		},
	);
});
