// Feature 003, US7, FR-034, FR-078, D-24 (profile sso): GET /auth, OPTIONS and HEAD of the auth routes, and what is
// left of saml: not listed, no routes, and sessions of its users answer INVALID_PROVIDER_CONFIG at the new app.
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertParity, capture, parity } from '../parity.js';
import { profileUrls } from '../profiles.js';
import { parseSuite } from '../suite.js';
import { closeHostDb, hostDb } from './db-effects.js';
import { cleanupFixtures, createUser, type User, urls } from './fixtures.js';
import { post } from './flows.js';

const suite = parseSuite();

describe.runIf(suite === 'full' && profileUrls('sso'))('auth providers (profile sso)', () => {
	const opts = () => profileUrls('sso');

	afterAll(async () => {
		await cleanupFixtures();
		await closeHostDb();
	}, 60_000);

	it.each(['/auth', '/auth?sessionOnly', '/auth?sessionOnly=true'])(
		'GET %s: the list of Directus without saml',
		async (path) => {
			const result = await parity({ path }, opts());
			assertParity(result);
			expect(result.directus.status).toBe(200);

			const directus = (result.directus.json as any).data as { driver: string }[];
			expect(directus.some((p) => p.driver === 'saml')).toBe(true);
			expect((result.backoffice.json as any).data).toEqual(directus.filter((p) => p.driver !== 'saml'));
			expect((result.backoffice.json as any).disableDefault).toBe((result.directus.json as any).disableDefault);
		},
	);

	it('HEAD /auth like GET without body; HEAD /auth/login/oidc starts the flow (302, state cookie)', async () => {
		const head = await parity({ method: 'HEAD', path: '/auth' }, opts());
		assertParity(head);
		expect(head.backoffice.text).toBe('');

		const start = await parity({ method: 'HEAD', path: '/auth/login/oidc' }, opts());
		assertParity(start);
		expect(start.directus.status).toBe(302);
		expect(start.backoffice.headers['set-cookie']).toMatch(/^openid\.oidc=/);
	});

	it.each([
		'/auth',
		'/auth/refresh',
		'/auth/logout',
		'/auth/password/request',
		'/auth/password/reset',
		'/auth/login',
		'/auth/login/local2',
		'/auth/login/ldap',
		'/auth/login/oidc',
		'/auth/login/oidc/callback',
		'/auth/login/oauthmock',
		'/auth/login/oauthmock/callback',
		'/users/me/tfa/generate',
		'/auth/login/nope',
		'/auth/other',
	])('OPTIONS %s (contracts/auth-api.md §6)', async (path) => {
		assertParity(await parity({ method: 'OPTIONS', path }, opts()));
	});

	it.each([
		['GET', '/auth/login/saml'],
		['POST', '/auth/login/saml/acs'],
		['OPTIONS', '/auth/login/saml'],
	])('%s %s: no saml routes at the new app (D-24)', async (method, path) => {
		const result = await parity({ method, path }, opts());
		assertParity(result);
		// Feature 012 (T053) enables CORS on the sso pair: both apps answer an OPTIONS preflight before routing.
		expect(result.backoffice.status).toBe(method === 'OPTIONS' ? 204 : 404);
	});

	describe('sessions of saml users (FR-078)', () => {
		let user: User;
		const sessions: string[] = [];

		// No saml login here: the session row is written from the host (Postgres only, like the sso profile).
		async function session(): Promise<string> {
			const token = randomBytes(48).toString('base64url').slice(0, 64);
			sessions.push(token);
			await hostDb()('directus_sessions').insert({ token, user: user.id, expires: new Date(Date.now() + 3_600_000) });
			return token;
		}

		beforeAll(async () => {
			user = await createUser('saml-user', { provider: 'saml', external_identifier: `saml-${Date.now()}` });
		}, 60_000);

		afterAll(async () => {
			await hostDb()('directus_sessions').whereIn('token', sessions).delete();
		});

		it.each(['/auth/refresh', '/auth/logout'])(
			'%s: 503 INVALID_PROVIDER_CONFIG at the new app, session kept',
			async (path) => {
				const { directus, backoffice } = urls('sso');

				const atDirectus = await capture(directus, post(path, { refresh_token: await session() }));
				expect(atDirectus.status).toBe(path === '/auth/refresh' ? 200 : 204);

				const token = await session();
				const atBackoffice = await capture(backoffice, post(path, { refresh_token: token }));
				expect(atBackoffice.status).toBe(503);
				expect((atBackoffice.json as any).errors[0].extensions).toEqual({
					code: 'INVALID_PROVIDER_CONFIG',
					provider: 'saml',
				});
				expect(await hostDb()('directus_sessions').where({ token })).toHaveLength(1);
			},
		);
	});
});
