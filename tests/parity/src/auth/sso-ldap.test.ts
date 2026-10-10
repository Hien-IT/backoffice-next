// Feature 003, US7 (LDAP): ported from directus/tests/blackbox/tests/common/auth/ldap.test.ts against the OpenLDAP
// of the sso profile (seeded here with ldapts), plus roles by group (GROUP_DN), refresh, payload errors without the
// stall and the session mode. Each app logs in its own LDAP user when a login creates or updates a user (R11).
import { randomBytes } from 'node:crypto';
import { Client } from 'ldapts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { directusRequest } from '../directus-api.js';
import { assertParity, capture, type Captured, parity, type ParityRequest } from '../parity.js';
import { profileUrls } from '../profiles.js';
import { parseSuite } from '../suite.js';
import { closeHostDb, hostDb, normalizeEffects } from './db-effects.js';
import { type App, cleanupFixtures, createRole, ensureRole, urls } from './fixtures.js';
import { cookieNamed, post } from './flows.js';
import { alias, assertSameTranscripts, scenario, send, snapshotOf } from './scenario.js';

const LDAP_URL = 'ldap://127.0.0.1:6109';
const ADMIN_DN = 'cn=Manager,dc=my-domain,dc=com';
const BASE_DN = 'dc=my-domain,dc=com';
const USER_BASE_DN = `ou=users,${BASE_DN}`;
const GROUP_BASE_DN = `ou=groups,${BASE_DN}`;
const DEFAULT_ROLE = 'd70c0943-5b55-4c5d-a613-f539a27a57f5';
const PASSWORD = 'ldap-parity-password';

const uids: string[] = [];
let ldap: Client;

async function add(dn: string, entry: Record<string, string | string[]>) {
	try {
		await ldap.add(dn, entry);
	} catch (err: any) {
		if (err?.code !== 68) throw err; // entryAlreadyExists
	}
}

async function ldapUser(name: string): Promise<string> {
	const uid = `${name}-${randomBytes(3).toString('hex')}`;
	uids.push(uid);

	await add(`cn=${uid},${USER_BASE_DN}`, {
		objectClass: ['top', 'inetOrgPerson', 'organizationalPerson', 'person'],
		cn: uid,
		sn: 'TestUser',
		givenName: 'LDAP',
		mail: `${uid}@example.com`,
		uid,
		userPassword: PASSWORD,
	});

	return uid;
}

async function ldapUsers(name: string): Promise<Record<App, string>> {
	return { directus: await ldapUser(`${name}-d`), backoffice: await ldapUser(`${name}-b`) };
}

const userOf = (uid: string) =>
	hostDb()('directus_users')
		.where({ external_identifier: `cn=${uid},${USER_BASE_DN}` })
		.first();

async function transcript(uid: string, path: string, res: Captured) {
	const user = await userOf(uid);
	const normalized = (normalizeEffects({ sessions: [], activity: [], revisions: [], user }) as { user: unknown }).user;
	return alias(
		{ login: snapshotOf(path, res), user: normalized },
		{ ...(user ? { [user.id]: '<user>' } : {}), [uid]: '<uid>' },
	);
}

const login = (uid: string, extra: Record<string, unknown> = {}): ParityRequest =>
	post('/auth/login/ldap', { identifier: uid, password: PASSWORD, ...extra });

const suite = parseSuite();

describe.runIf(suite === 'full' && profileUrls('sso'))('/auth/login/ldap (profile sso)', () => {
	const sso = () => urls('sso');
	const opts = () => profileUrls('sso');

	beforeAll(async () => {
		await ensureRole(DEFAULT_ROLE, 'parity-sso-default');

		ldap = new Client({ url: LDAP_URL, connectTimeout: 10_000, timeout: 10_000 });
		await ldap.bind(ADMIN_DN, 'secret');
		await add(BASE_DN, { objectClass: ['top', 'domain', 'dcObject'], dc: 'my-domain' });
		await add(ADMIN_DN, { objectClass: ['top', 'person', 'organizationalPerson'], cn: 'Manager', sn: 'Manager' });
		await add(USER_BASE_DN, { objectClass: ['top', 'organizationalUnit'], ou: 'users' });
		await add(GROUP_BASE_DN, { objectClass: ['top', 'organizationalUnit'], ou: 'groups' });
	}, 60_000);

	afterAll(async () => {
		const ids = (
			await hostDb()('directus_users')
				.select('id')
				.whereIn(
					'external_identifier',
					uids.map((uid) => `cn=${uid},${USER_BASE_DN}`),
				)
		).map((u) => u.id);

		if (ids.length) await directusRequest('DELETE', '/users', ids);
		for (const uid of uids) await ldap.del(`cn=${uid},${USER_BASE_DN}`).catch(() => undefined);
		await ldap.unbind().catch(() => undefined);
		await cleanupFixtures();
		await closeHostDb();
	}, 60_000);

	it('correct credentials: access_token, expires and refresh_token; the user created from LDAP', async () => {
		const pair = await ldapUsers('ldap-new');

		const transcripts = await scenario(sso(), async (ctx) =>
			transcript(pair[ctx.app], '/auth/login/ldap', await send(ctx.url, login(pair[ctx.app]), ctx.host)),
		);

		assertSameTranscripts(transcripts, 'ldap login');
		const backoffice = transcripts.backoffice as any;
		expect(backoffice.login.status).toBe(200);
		expect(backoffice.user).toMatchObject({
			provider: 'ldap',
			first_name: 'LDAP',
			last_name: 'TestUser',
			role: DEFAULT_ROLE,
		});
	});

	it('wrong password and unknown user: 401 INVALID_CREDENTIALS', async () => {
		const uid = await ldapUser('ldap-wrong');
		// The first login creates the user: done once here, or both apps would race to create it.
		expect((await capture(sso().directus, login(uid))).status).toBe(200);

		for (const req of [login(uid, { password: 'wrongpassword' }), login('nonexistentuser')]) {
			const result = await parity(req, opts());
			assertParity(result);
			expect(result.directus.status).toBe(401);
		}
	});

	it('an invalid payload: 400 without waiting LOGIN_STALL_TIME', async () => {
		const start = performance.now();
		const result = await parity(post('/auth/login/ldap', { identifier: 'x' }), opts());
		assertParity(result);
		expect(result.directus.status).toBe(400);
		expect(performance.now() - start).toBeLessThan(500);
	});

	it('a token of the new app reads the user at GET /users/me of Directus', async () => {
		const uid = await ldapUser('ldap-me');
		const res = await capture(sso().backoffice, login(uid));
		const token = (res.json as any).data.access_token;

		const me = await capture(sso().directus, { path: '/users/me', headers: { authorization: `Bearer ${token}` } });
		// The default role reads nothing but the id of the user.
		expect(me.status).toBe(200);
		expect((me.json as any).data).toEqual({ id: (await userOf(uid)).id });
	});

	it('role by group: the role named like an LDAP group of the user', async () => {
		const groupName = `parity-ldap-${randomBytes(3).toString('hex')}`;
		const role = await createRole(groupName);
		const pair = await ldapUsers('ldap-group');

		await add(`cn=${groupName},${GROUP_BASE_DN}`, {
			objectClass: ['top', 'groupOfNames'],
			cn: groupName,
			member: [`cn=${pair.directus},${USER_BASE_DN}`, `cn=${pair.backoffice},${USER_BASE_DN}`],
		});

		try {
			const transcripts = await scenario(sso(), async (ctx) =>
				transcript(pair[ctx.app], '/auth/login/ldap', await send(ctx.url, login(pair[ctx.app]), ctx.host)),
			);

			assertSameTranscripts(transcripts, 'ldap group');
			expect((transcripts.backoffice as any).user.role).toBe(role);
		} finally {
			await ldap.del(`cn=${groupName},${GROUP_BASE_DN}`);
		}
	});

	it('session mode: access_token in the body and the session cookie; refresh checks LDAP again', async () => {
		const pair = await ldapUsers('ldap-session');

		const transcripts = await scenario(sso(), async (ctx) => {
			const first = await send(ctx.url, login(pair[ctx.app], { mode: 'session' }), ctx.host);
			const cookie = cookieNamed(first, 'directus_session_token');
			const refreshed = await send(ctx.url, post('/auth/refresh', { mode: 'session' }, cookie), ctx.host);
			const user = await userOf(pair[ctx.app]);

			return alias(
				{ login: snapshotOf('/auth/login/ldap', first), refresh: snapshotOf('/auth/refresh', refreshed) },
				{
					[user.id]: '<user>',
				},
			);
		});

		assertSameTranscripts(transcripts, 'ldap session');
		const backoffice = transcripts.backoffice as any;
		expect(Object.keys(backoffice.login.body.data).sort()).toEqual(['access_token', 'expires']);
		expect(backoffice.refresh.status).toBe(200);
	});
});
