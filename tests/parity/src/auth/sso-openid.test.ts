// Feature 003, US7 (OpenID, SC-008, contracts/auth-api.md §4, contracts/db-writes.md §6, §7): provider `oidc` and
// `oidcstrict` of the sso profile against the test identity provider. Each app logs in its own IdP user (research
// R11); users are compared after replacing their ids, subjects and emails.
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { directusRequest } from '../directus-api.js';
import { assertParity, type Captured, parity } from '../parity.js';
import { profileUrls } from '../profiles.js';
import { parseSuite } from '../suite.js';
import { closeHostDb, hostDb, normalizeEffects } from './db-effects.js';
import { type App, cleanupFixtures, ensureRole, urls } from './fixtures.js';
import { cookieNamed, post } from './flows.js';
import { alias, assertSameTranscripts, scenario, type ScenarioContext, send, snapshotOf } from './scenario.js';
import { finishSso, idpRefreshError, idpUser, startSso } from './sso.js';

const DEFAULT_ROLE = 'd70c0943-5b55-4c5d-a613-f539a27a57f5';
const MAPPED_ROLE = '0d5b9ad1-4c3f-4c1e-9b8a-2f6a1c7e5d10';
const subs: string[] = [];

/** A new IdP user per app. */
async function idpUsers(name: string, claims: (sub: string) => Record<string, unknown> = () => ({})) {
	const out = {} as Record<App, string>;

	for (const app of ['directus', 'backoffice'] as const) {
		const sub = `${name}-${app[0]}-${randomBytes(3).toString('hex')}`;
		subs.push(sub);
		await idpUser(sub, {
			email: `${sub}@example.com`,
			email_verified: true,
			given_name: 'Pat',
			family_name: 'Doe',
			...claims(sub),
		});
		out[app] = sub;
	}

	return out;
}

async function userOf(sub: string) {
	return hostDb()('directus_users').where({ external_identifier: sub }).first();
}

/** The callback answer and the user row, with the per-app values replaced. */
async function transcript(sub: string, path: string, res: Captured) {
	const user = await userOf(sub);
	const normalized = (normalizeEffects({ sessions: [], activity: [], revisions: [], user }) as { user: unknown }).user;
	return alias(
		{ callback: snapshotOf(path, res), user: normalized },
		{ ...(user ? { [user.id]: '<user>' } : {}), [sub]: '<sub>' },
	);
}

const suite = parseSuite();

describe.runIf(suite === 'full' && profileUrls('sso'))('OpenID provider (profile sso)', () => {
	const sso = () => urls('sso');
	const opts = () => profileUrls('sso');

	beforeAll(async () => {
		await ensureRole(DEFAULT_ROLE, 'parity-sso-default');
		await ensureRole(MAPPED_ROLE, 'parity-sso-mapped', { app: true, enforceTfa: true });
	}, 60_000);

	afterAll(async () => {
		const ids = (await hostDb()('directus_users').select('id').whereIn('external_identifier', subs)).map((u) => u.id);
		if (ids.length) await directusRequest('DELETE', '/users', ids);
		await cleanupFixtures();
		await closeHostDb();
	}, 60_000);

	const flow = (ctx: ScenarioContext, provider: string, sub: string, query = '') =>
		startSso(ctx.url, ctx.host, provider, sub, query);

	it('start: 302 to the IdP with the PKCE parameters, state cookie openid.oidc', async () => {
		const result = await parity({ path: '/auth/login/oidc?redirect=/admin/content' }, opts());
		assertParity(result);
		expect(result.directus.status).toBe(302);
		expect(result.backoffice.headers['set-cookie']).toMatch(/^openid\.oidc=/);
	});

	it('callback: state cookie cleared, session cookie, 302 to / without redirect, user created (§6)', async () => {
		const pair = await idpUsers('oidc-new');

		const transcripts = await scenario(sso(), async (ctx) => {
			const started = await flow(ctx, 'oidc', pair[ctx.app]);
			return transcript(pair[ctx.app], '/auth/login/oidc/callback', await finishSso(ctx.url, ctx.host, started));
		});

		assertSameTranscripts(transcripts, 'oidc callback');
		const backoffice = transcripts.backoffice as any;
		// resolveLoginRedirect makes an empty redirect "/": the openid callback always redirects.
		expect(backoffice.callback).toMatchObject({ status: 302, headers: { location: '/' } });
		expect(backoffice.callback.headers['set-cookie']).toMatch(/directus_session_token=<jwt>/);
		expect(backoffice.callback.headers['set-cookie']).toMatch(/openid\.oidc=<empty>; Path=\/; Expires=<past>/);
		expect(backoffice.user).toMatchObject({ provider: 'oidc', role: DEFAULT_ROLE, first_name: 'Pat' });
	});

	it('with redirect: session cookie and 302 to the redirect', async () => {
		const pair = await idpUsers('oidc-redirect');

		const transcripts = await scenario(sso(), async (ctx) => {
			const started = await flow(ctx, 'oidc', pair[ctx.app], '?redirect=/admin/content');
			return transcript(pair[ctx.app], '/auth/login/oidc/callback', await finishSso(ctx.url, ctx.host, started));
		});

		assertSameTranscripts(transcripts, 'oidc redirect');
		expect((transcripts.backoffice as any).callback).toMatchObject({
			status: 302,
			headers: { location: '/admin/content' },
		});
	});

	it('ROLE_MAPPING to a role with enforce_tfa: mapped role, redirect to /admin/tfa-setup', async () => {
		const pair = await idpUsers('oidc-mapped', () => ({ groups: ['parity-admins'] }));

		const transcripts = await scenario(sso(), async (ctx) => {
			const started = await flow(ctx, 'oidc', pair[ctx.app], '?redirect=/admin');
			return transcript(pair[ctx.app], '/auth/login/oidc/callback', await finishSso(ctx.url, ctx.host, started));
		});

		assertSameTranscripts(transcripts, 'oidc role mapping');
		const backoffice = transcripts.backoffice as any;
		expect(backoffice.user.role).toBe(MAPPED_ROLE);
		expect(backoffice.callback.headers.location).toMatch(/\/admin\/tfa-setup\?redirect=%2Fadmin&provider=oidc$/);
	});

	it('SYNC_USER_INFO: a second login updates the user from the IdP (§7)', async () => {
		const pair = await idpUsers('oidc-sync');

		const transcripts = await scenario(sso(), async (ctx) => {
			const sub = pair[ctx.app];
			await finishSso(ctx.url, ctx.host, await flow(ctx, 'oidc', sub));
			await idpUser(sub, {
				email: `${sub}-new@example.com`,
				email_verified: true,
				given_name: 'New',
				family_name: 'Name',
			});
			return transcript(
				sub,
				'/auth/login/oidc/callback',
				await finishSso(ctx.url, ctx.host, await flow(ctx, 'oidc', sub)),
			);
		});

		assertSameTranscripts(transcripts, 'oidc sync');
		expect((transcripts.backoffice as any).user).toMatchObject({ first_name: 'New', last_name: 'Name' });
	});

	it('oidcstrict: an unknown user without public registration goes back with reason INVALID_CREDENTIALS', async () => {
		const pair = await idpUsers('oidc-strict');

		const transcripts = await scenario(sso(), async (ctx) => {
			const started = await flow(ctx, 'oidcstrict', pair[ctx.app]);
			return transcript(pair[ctx.app], '/auth/login/oidcstrict/callback', await finishSso(ctx.url, ctx.host, started));
		});

		assertSameTranscripts(transcripts, 'oidcstrict');
		expect((transcripts.backoffice as any).callback.headers.location).toBe('/?reason=INVALID_CREDENTIALS');
	});

	it('POST callback: 303 to the GET callback; a bad state cookie: back to /admin/login', async () => {
		const posted = await parity(
			{
				method: 'POST',
				path: '/auth/login/oidc/callback',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: 'code=abc&state=xyz',
			},
			opts(),
		);

		assertParity(posted);
		expect(posted.directus.status).toBe(303);

		const bad = await parity(
			{ path: '/auth/login/oidc/callback?code=abc', headers: { cookie: 'openid.oidc=bad' } },
			opts(),
		);
		assertParity(bad);
		expect(bad.directus.headers['location']).toMatch(/\/admin\/login\?reason=INVALID_CREDENTIALS$/);
	});

	it('invalid_grant at the callback: back to the start with prompt=true', async () => {
		const pair = await idpUsers('oidc-grant');

		const transcripts = await scenario(sso(), async (ctx) => {
			const started = await flow(ctx, 'oidc', pair[ctx.app], '?redirect=/admin');
			const bogus = { ...started, callbackPath: started.callbackPath.replace(/code=[^&]+/, 'code=bogus') };
			return snapshotOf('/auth/login/oidc/callback', await finishSso(ctx.url, ctx.host, bogus));
		});

		assertSameTranscripts(transcripts, 'oidc invalid_grant');
		expect((transcripts.backoffice as any).headers.location).toBe('./?redirect=/admin&prompt=true');
	});

	it('refresh asks the IdP; invalid_grant there: 403 INVALID_TOKEN', async () => {
		const pair = await idpUsers('oidc-refresh');

		const transcripts = await scenario(sso(), async (ctx) => {
			const sub = pair[ctx.app];
			const login = await finishSso(ctx.url, ctx.host, await flow(ctx, 'oidc', sub));
			const refresh = (cookie: string) => send(ctx.url, post('/auth/refresh', { mode: 'session' }, cookie), ctx.host);

			const ok = await refresh(cookieNamed(login, 'directus_session_token'));
			await idpRefreshError();
			const refused = await refresh(cookieNamed(ok, 'directus_session_token'));

			const user = await userOf(sub);
			return alias([snapshotOf('/auth/refresh', ok), snapshotOf('/auth/refresh', refused)], { [user.id]: '<user>' });
		});

		assertSameTranscripts(transcripts, 'oidc refresh');
		expect((transcripts.backoffice as any).map((s: any) => s.status)).toEqual([200, 403]);
	});

	it('started at one app, finished at the other (SC-008)', async () => {
		const pair = await idpUsers('oidc-cross');
		const { directus, backoffice } = sso();
		const host = new URL(directus).host;

		const toBackoffice = await finishSso(backoffice, host, await startSso(directus, host, 'oidc', pair.directus));
		const toDirectus = await finishSso(directus, host, await startSso(backoffice, host, 'oidc', pair.backoffice));

		expect(toBackoffice.status).toBe(302);
		expect(cookieNamed(toBackoffice, 'directus_session_token')).toBeTruthy();
		expect(toDirectus.status).toBe(302);

		const a = await transcript(pair.directus, '/auth/login/oidc/callback', toBackoffice);
		const b = await transcript(pair.backoffice, '/auth/login/oidc/callback', toDirectus);
		expect(a).toEqual(b);
	});
});
