// Feature 003, US7 (OAuth2): ported from directus/tests/blackbox/tests/common/auth/oauth-redirect.test.ts and
// oauth-multi-domain.test.ts (provider `github`, never contacted; the subpath case through AUTH_ALLOWED_PUBLIC_URLS
// http://localhost:8955/api) on parity(), plus full flows with `oauthmock` (MODE=json) against the test IdP.
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { directusRequest } from '../directus-api.js';
import { assertParity, type Captured, parity, type ParityRequest } from '../parity.js';
import { profileUrls } from '../profiles.js';
import { parseSuite } from '../suite.js';
import { closeHostDb, hostDb, normalizeEffects } from './db-effects.js';
import { type App, cleanupFixtures, ensureRole, urls } from './fixtures.js';
import { cookieNamed, post } from './flows.js';
import { alias, assertSameTranscripts, scenario, send, snapshotOf } from './scenario.js';
import { finishSso, idpRefreshError, idpUser, startSso } from './sso.js';

const DEFAULT_ROLE = 'd70c0943-5b55-4c5d-a613-f539a27a57f5';
const subs: string[] = [];

async function idpUsers(name: string, claims: Record<string, unknown> = {}) {
	const out = {} as Record<App, string>;

	for (const app of ['directus', 'backoffice'] as const) {
		const sub = `${name}-${app[0]}-${randomBytes(3).toString('hex')}`;
		subs.push(sub);
		await idpUser(sub, { email: `${sub}@example.com`, ...claims });
		out[app] = sub;
	}

	return out;
}

async function transcript(sub: string, res: Captured) {
	const user = await hostDb()('directus_users').where({ external_identifier: sub }).first();
	const normalized = (normalizeEffects({ sessions: [], activity: [], revisions: [], user }) as { user: unknown }).user;
	return alias(
		{ callback: snapshotOf('/auth/login/oauthmock/callback', res), user: normalized },
		{
			...(user ? { [user.id]: '<user>' } : {}),
			[sub]: '<sub>',
		},
	);
}

const suite = parseSuite();

describe.runIf(suite === 'full' && profileUrls('sso'))('OAuth2 providers (profile sso)', () => {
	const sso = () => urls('sso');
	const opts = () => profileUrls('sso');

	const expectParity = async (req: ParityRequest, status: number) => {
		const result = await parity(req, opts());
		assertParity(result);
		expect(result.directus.status).toBe(status);
		return result;
	};

	beforeAll(async () => {
		await ensureRole(DEFAULT_ROLE, 'parity-sso-default');
	}, 60_000);

	afterAll(async () => {
		const ids = (await hostDb()('directus_users').select('id').whereIn('external_identifier', subs)).map((u) => u.id);
		if (ids.length) await directusRequest('DELETE', '/users', ids);
		await cleanupFixtures();
		await closeHostDb();
	}, 60_000);

	describe('/auth/login/github redirect validation (oauth-redirect.test.ts)', () => {
		it.each([
			['blocks unlisted redirect URLs', '?redirect=https://malicious.com/steal', 400],
			['blocks protocol-relative redirect URLs', '?redirect=//malicious.com/steal', 400],
			['allows relative path redirects', '?redirect=/admin/content', 302],
			['allows redirect to PUBLIC_URL origin', '?redirect=http://127.0.0.1:8955/admin/content', 302],
			['no redirect parameter defaults to empty (allowed)', '', 302],
		])('%s', async (_name, query, status) => {
			await expectParity({ path: `/auth/login/github${query}` }, status);
		});

		it('callback URL matches PUBLIC_URL', async () => {
			const result = await expectParity({ path: '/auth/login/github?redirect=/admin' }, 302);
			const location = result.backoffice.headers['location']!;
			const redirectUri = decodeURIComponent(location.split('redirect_uri=')[1]!.split('&')[0]!);
			expect(redirectUri).toBe('http://127.0.0.1:8955/auth/login/github/callback');
		});
	});

	describe('multi-domain and subpath (oauth-multi-domain.test.ts)', () => {
		it('callback URL uses the matching AUTH_ALLOWED_PUBLIC_URLS entry, with its subpath', async () => {
			const result = await expectParity(
				{ path: '/auth/login/github?redirect=/admin', headers: { host: 'localhost:8955' } },
				302,
			);

			const location = result.backoffice.headers['location']!;
			const redirectUri = decodeURIComponent(location.split('redirect_uri=')[1]!.split('&')[0]!);
			expect(redirectUri).toBe('http://localhost:8955/api/auth/login/github/callback');
		});

		it('cross-domain redirect allowed via REDIRECT_ALLOW_LIST, blocked otherwise', async () => {
			const allowed = await expectParity(
				{ path: '/auth/login/github?redirect=https://external-frontend.com/callback' },
				302,
			);
			expect(allowed.backoffice.headers['location']).toContain('github.com');
			await expectParity({ path: '/auth/login/github?redirect=https://external-frontend.com/other' }, 400);
		});
	});

	describe('oauthmock (MODE=json)', () => {
		it('a new user: state cookie cleared, refresh cookie, 302; then an update at the next login', async () => {
			const pair = await idpUsers('oauth2-new');

			const transcripts = await scenario(sso(), async (ctx) => {
				const sub = pair[ctx.app];
				const first = await transcript(
					sub,
					await finishSso(ctx.url, ctx.host, await startSso(ctx.url, ctx.host, 'oauthmock', sub)),
				);
				const again = await transcript(
					sub,
					await finishSso(ctx.url, ctx.host, await startSso(ctx.url, ctx.host, 'oauthmock', sub)),
				);
				return { first, again };
			});

			assertSameTranscripts(transcripts, 'oauthmock login');
			const { first } = transcripts.backoffice as any;
			expect(first.callback.status).toBe(302);
			expect(first.callback.headers['set-cookie']).toMatch(/oauth2\.oauthmock=<empty>; Path=\/; Expires=<past>/);
			expect(first.callback.headers['set-cookie']).toMatch(/directus_refresh_token=<token64>/);
			expect(first.user).toMatchObject({ provider: 'oauthmock', role: DEFAULT_ROLE });
		});

		it('a bad state cookie: 401', async () => {
			await expectParity(
				{ path: '/auth/login/oauthmock/callback?code=x', headers: { cookie: 'oauth2.oauthmock=bad' } },
				401,
			);
		});

		it('refresh asks the IdP; invalid_grant there: 403 INVALID_TOKEN', async () => {
			const pair = await idpUsers('oauth2-refresh');

			const transcripts = await scenario(sso(), async (ctx) => {
				const sub = pair[ctx.app];
				const login = await finishSso(ctx.url, ctx.host, await startSso(ctx.url, ctx.host, 'oauthmock', sub));
				const refresh = (cookie: string) => send(ctx.url, post('/auth/refresh', {}, cookie), ctx.host);

				const ok = await refresh(cookieNamed(login, 'directus_refresh_token'));
				await idpRefreshError();
				const refused = await refresh(cookieNamed(ok, 'directus_refresh_token'));

				const user = await hostDb()('directus_users').where({ external_identifier: sub }).first();
				return alias([snapshotOf('/auth/refresh', ok), snapshotOf('/auth/refresh', refused)], { [user.id]: '<user>' });
			});

			assertSameTranscripts(transcripts, 'oauthmock refresh');
			expect((transcripts.backoffice as any).map((s: any) => s.status)).toEqual([200, 403]);
		});

		it('started at one app, finished at the other, both directions', async () => {
			const pair = await idpUsers('oauth2-cross');
			const { directus, backoffice } = sso();
			const host = new URL(directus).host;

			const toBackoffice = await finishSso(
				backoffice,
				host,
				await startSso(directus, host, 'oauthmock', pair.directus),
			);
			const toDirectus = await finishSso(
				directus,
				host,
				await startSso(backoffice, host, 'oauthmock', pair.backoffice),
			);

			expect(await transcript(pair.directus, toBackoffice)).toEqual(await transcript(pair.backoffice, toDirectus));
			expect(toBackoffice.status).toBe(302);
		});
	});
});
