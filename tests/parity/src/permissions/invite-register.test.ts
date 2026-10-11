// Feature 004, US5.1 to US5.8 (FR-060 to FR-064): invites and registration. No email is sent by either side here
// (no EMAIL_* in the parity environment for Backoffice, D-27, D-28), so the tests sign invite and verification tokens
// like Directus does; a token is accepted by both apps whichever signed it. The registration limiter is on by default
// with Redis counters (rlflx:<ip>): every case sends its own X-Forwarded-For.
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { setSettings, urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario, send } from '../auth/scenario.js';
import { sharedSecret } from '../auth/tokens.js';
import { appRequest } from '../directus-api.js';
import { logs } from '../docker.js';
import { attachPolicy, cleanup, createPolicy, createRoleTree, createUser, uniqueName } from './fixtures.js';
import { startFlow } from './flow.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
let ipCase = 0;
/** A fresh client IP for each registration case (own limiter counter). */
const nextIp = () => ({ 'x-forwarded-for': `10.44.${++ipCase}.${Math.floor(Math.random() * 200) + 1}` });

const sign = (payload: object, options: jwt.SignOptions = {}, secret = sharedSecret()) =>
	jwt.sign(payload, secret, { issuer: 'directus', expiresIn: '1h', ...options });

let role: string;
let otherRole: string;
let restoreSettings: () => Promise<void>;

beforeAll(async () => {
	role = (await createRoleTree('directus', 'parity-invite')).leaf;
	otherRole = (await createRoleTree('directus', 'parity-invite-other')).leaf;

	restoreSettings = await setSettings({
		public_registration: false,
		public_registration_verify_email: true,
		public_registration_role: null,
		public_registration_email_filter: null,
	});
}, 60_000);

afterAll(async () => {
	await restoreSettings?.();

	const { data } = await appRequest(
		'directus',
		'GET',
		`/users?filter=${json({ email: { _starts_with: 'parity-invite' } })}&fields=id&limit=-1`,
	);

	if (data.length) await appRequest('directus', 'DELETE', '/users', { keys: data.map((u: any) => u.id) });
	await cleanup();
	await closeHostDb();
}, 60_000);

/** The names of each app's fixture differ by the app suffix; give both the same one. */
function same<T extends Record<string, unknown>>(transcripts: T, prefix: string): T {
	return Object.fromEntries(
		Object.entries(transcripts).map(([app, t]) => [
			app,
			JSON.parse(JSON.stringify(t).split(`${prefix}-${app}`).join(`${prefix}-<app>`)),
		]),
	) as T;
}

const USER_COLUMNS = ['email', 'status', 'role', 'password'];

describe('POST /users/invite (US5.1 to US5.3, FR-060, FR-061)', () => {
	it('new, already invited with another role, active; Joi errors; invite_url outside the allow list', async () => {
		const prefix = uniqueName('parity-invite');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const email = (n: string) => `${name}-${n}@example.com`;
			const active = await createUser('directus', `${name}-active`, { role: otherRole });
			flow.name(active.id, 'active');
			flow.name(active.email, 'active-email');
			flow.name(role, 'role');
			flow.name(otherRole, 'other-role');

			await flow.req('POST', '/users/invite', { email: email('a'), role });
			await flow.req('POST', '/users/invite', { email: [email('b'), email('c')], role: otherRole });
			await flow.req('POST', '/users/invite', { email: [email('b'), active.email], role });
			await flow.req('POST', '/users/invite', { email: 'not-an-email', role });
			await flow.req('POST', '/users/invite', { email: email('d') });
			await flow.req('POST', '/users/invite', { email: email('d'), role: 'not-a-uuid' });
			await flow.req('POST', '/users/invite', { email: email('d'), role, invite_url: 'https://evil.example.com' });

			// Users made by the invites: label them by their email (without the app suffix).
			for (const row of await hostDb()('directus_users').where('email', 'like', `${name}%`).select('id', 'email')) {
				if (row.id !== active.id) flow.name(row.id, `user${row.email.slice(name.length)}`);
			}

			await flow.rows('directus_users', (q) => q.where('email', 'like', `${name}%`), {
				orderBy: 'email',
				columns: USER_COLUMNS,
			});
			await flow.activity();
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'invite');
	});

	it('a user who may create but not update users: the loop stops at the first refused email (FR-060)', async () => {
		const prefix = uniqueName('parity-invite-partial');
		const { leaf } = await createRoleTree('directus', prefix);

		await attachPolicy(
			'directus',
			await createPolicy('directus', prefix, {
				permissions: [{ collection: 'directus_users', action: 'create', fields: ['*'], permissions: {} }],
			}),
			{ role: leaf },
		);

		const inviter = await createUser('directus', prefix, { role: leaf });

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			flow.name(role, 'role');
			flow.name(otherRole, 'other-role');

			// An invited user with another role needs an update; the email before it is already created.
			await flow.req('POST', '/users/invite', { email: `${name}-x@example.com`, role: otherRole });
			await flow.req(
				'POST',
				'/users/invite',
				{ email: [`${name}-y@example.com`, `${name}-x@example.com`, `${name}-z@example.com`], role },
				{ authorization: `Bearer ${inviter.token}` },
			);

			await flow.rows('directus_users', (q) => q.where('email', 'like', `${name}%`), {
				orderBy: 'email',
				columns: USER_COLUMNS,
			});
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'invite partial');
	});

	it.runIf(suite === 'full')('the log line names the recipient, without token or link', async () => {
		const email = `${uniqueName('parity-invite-log')}@example.com`;
		await appRequest('backoffice', 'POST', '/users/invite', { email, role });

		const line = logs('backoffice-api')
			.split('\n')
			.find((l) => l.includes(email));

		expect(line).toContain('Invitation email');
		expect(line).not.toMatch(/token|https?:\/\/|eyJ/);
	});
});

describe('POST /users/invite/accept (US5.4, FR-062)', () => {
	it('tokens signed like Directus: every row of the error table, then the invite accepted', async () => {
		const prefix = uniqueName('parity-invite-accept');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const email = `${prefix}-${ctx.app}@example.com`;
			const accepted = `${prefix}-${ctx.app}-ok@example.com`;
			flow.name(role, 'role');
			await flow.req('POST', '/users/invite', { email: [email, accepted], role });

			const accept = async (token: string | undefined, password: string | undefined = 'parity-password-2') =>
				flow.req('POST', '/users/invite/accept', {
					...(token !== undefined ? { token } : {}),
					...(password !== undefined ? { password } : {}),
				});

			// Tokens hold the app's emails: each gets a label so the two transcripts compare.
			const named = (token: string, label: string) => (flow.name(token, label), token);

			await accept(undefined);
			await accept(named(sign({ email, scope: 'invite' }), 'valid'), undefined);
			await accept(named(sign({ email, scope: 'invite' }, { expiresIn: -10 }), 'expired'));
			await accept(named(sign({ email, scope: 'invite' }, {}, 'not-the-secret'), 'wrong-secret'));
			await accept('not.a.jwt');
			await accept(
				named(jwt.sign({ email, scope: 'invite' }, sharedSecret(), { issuer: 'other', expiresIn: '1h' }), 'issuer'),
			);
			await accept(named(sign({ email, scope: 'password-reset' }), 'scope'));
			await accept(named(sign({ email: `${prefix}-${ctx.app}-nobody@example.com`, scope: 'invite' }), 'nobody'));
			const ok = named(sign({ email: accepted, scope: 'invite' }), 'ok');
			await accept(ok);
			await accept(ok);

			await flow.rows('directus_users', (q) => q.where('email', 'like', `${prefix}-${ctx.app}%`), {
				orderBy: 'email',
				columns: USER_COLUMNS,
			});
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'invite accept');
	});

	it('password policy on accept: 400 FAILED_VALIDATION at both apps', async () => {
		const restore = await setSettings({ auth_password_policy: '/^.{20,}$/' });
		const prefix = uniqueName('parity-invite-policy');

		try {
			const transcripts = await scenario(urls(), async (ctx) => {
				const flow = await startFlow(ctx);
				const email = `${prefix}-${ctx.app}@example.com`;
				flow.name(role, 'role');
				await flow.req('POST', '/users/invite', { email, role });
				const token = sign({ email, scope: 'invite' });
				flow.name(token, 'token');
				await flow.req('POST', '/users/invite/accept', { token, password: 'short' });
				return flow.transcript();
			});

			assertSameTranscripts(same(transcripts, prefix), 'invite accept policy');
		} finally {
			await restore();
		}
	});
});

describe('POST /users/register (US5.5 to US5.7, FR-063)', () => {
	async function registerFlow(
		settings: Record<string, unknown>,
		label: string,
		body: (name: string) => Record<string, unknown>,
	) {
		const restore = await setSettings(settings);
		const prefix = uniqueName('parity-invite-register');

		try {
			const transcripts = await scenario(urls(), async (ctx) => {
				const flow = await startFlow(ctx);
				const name = `${prefix}-${ctx.app}`;
				flow.name(role, 'role');
				await flow.req('POST', '/users/register', body(name), nextIp());
				await flow.rows('directus_users', (q) => q.where('email', 'like', `${name}%`), { columns: USER_COLUMNS });
				return flow.transcript();
			});

			assertSameTranscripts(same(transcripts, prefix), `register ${label}`);
		} finally {
			await restore();
		}
	}

	const user = (name: string) => ({ email: `${name}@example.com`, password: 'parity-password-3', first_name: 'R' });

	it('closed: 403', () => registerFlow({ public_registration: false }, 'closed', user));

	it('open with verification: unverified user with the registration role', () =>
		registerFlow(
			{ public_registration: true, public_registration_verify_email: true, public_registration_role: role },
			'verify',
			user,
		));

	it('open without verification: active user', () =>
		registerFlow({ public_registration: true, public_registration_verify_email: false }, 'no verify', user));

	it('email outside the filter: 403', () =>
		registerFlow(
			{ public_registration: true, public_registration_email_filter: { email: { _ends_with: '@allowed.example' } } },
			'filter',
			user,
		));

	it('Joi errors and a verification_url outside the allow list: 400', async () => {
		await registerFlow({ public_registration: true }, 'joi', (name) => ({ email: `${name}@example.com` }));

		await registerFlow({ public_registration: true }, 'url', (name) => ({
			...user(name),
			verification_url: 'https://evil.example.com/verify',
		}));
	});

	it('existing emails: 204 without a change (active), the verification again (unverified)', async () => {
		const restore = await setSettings({ public_registration: true, public_registration_verify_email: true });
		const prefix = uniqueName('parity-invite-existing');

		try {
			const transcripts = await scenario(urls(), async (ctx) => {
				const flow = await startFlow(ctx);
				const name = `${prefix}-${ctx.app}`;
				const active = await createUser('directus', `${name}-active`, { role: null });
				flow.name(active.id, 'active');
				flow.name(active.email, 'active-email');

				await flow.req('POST', '/users/register', { email: active.email, password: 'x' }, nextIp());
				await flow.req('POST', '/users/register', user(`${name}-u`), nextIp());
				await flow.req('POST', '/users/register', { ...user(`${name}-u`), first_name: 'Again' }, nextIp());
				await flow.rows('directus_users', (q) => q.where('email', 'like', `${name}%`), {
					orderBy: 'email',
					columns: [...USER_COLUMNS, 'first_name'],
				});
				return flow.transcript();
			});

			assertSameTranscripts(same(transcripts, prefix), 'register existing');
		} finally {
			await restore();
		}
	});

	it('REGISTER_STALL_TIME (SC-009): closed and a wrong URL answer at once; the other branches wait', async () => {
		const restore = await setSettings({ public_registration: false });
		const durations: Record<string, Record<string, number>> = { directus: {}, backoffice: {} };

		const timed = async (url: string, app: string, label: string, body: Record<string, unknown>) => {
			const start = performance.now();
			await send(url, { method: 'POST', path: '/users/register', body, headers: nextIp() }, new URL(url).host);
			durations[app]![label] = performance.now() - start;
		};

		try {
			for (const [app, url] of Object.entries(urls()) as [string, string][]) {
				const prefix = uniqueName('parity-invite-stall');
				await timed(url, app, 'closed', user(`${prefix}-${app}`));
			}

			await restore();
			const reopen = await setSettings({ public_registration: true, public_registration_verify_email: true });

			for (const [app, url] of Object.entries(urls()) as [string, string][]) {
				const prefix = uniqueName('parity-invite-stall');
				await timed(url, app, 'wrong url', {
					...user(`${prefix}-${app}`),
					verification_url: 'https://evil.example.com',
				});
				await timed(url, app, 'new', user(`${prefix}-${app}`));
				await timed(url, app, 'existing', user(`${prefix}-${app}`));
			}

			await reopen();
		} finally {
			await restore();
		}

		for (const app of ['directus', 'backoffice']) {
			expect(durations[app]!['closed']).toBeLessThan(700);
			expect(durations[app]!['wrong url']).toBeLessThan(700);
			expect(durations[app]!['new']).toBeGreaterThanOrEqual(740);
			expect(durations[app]!['existing']).toBeGreaterThanOrEqual(740);
		}
	});

	it('the sixth registration of an IP within a minute: 429 with Retry-After, counters shared by both apps', async () => {
		const ip = nextIp();
		const statuses: [string, number, string | undefined][] = [];
		const apps = Object.entries(urls()) as [string, string][];

		for (let i = 0; i < 6; i++) {
			const [app, url] = apps[i % 2]!;
			const res = await send(
				url,
				{ method: 'POST', path: '/users/register', body: {}, headers: ip },
				new URL(url).host,
			);
			statuses.push([app, res.status, res.headers['retry-after'] ? 'set' : undefined]);
		}

		expect(statuses.map(([, status]) => status)).toEqual([400, 400, 400, 400, 400, 429]);
		expect(statuses[5]![2]).toBe('set');

		// The seventh, at the other app, is refused too.
		const [app, url] = apps[0]!;
		const seventh = await send(
			url,
			{ method: 'POST', path: '/users/register', body: {}, headers: ip },
			new URL(url).host,
		);
		expect([app, seventh.status]).toEqual([app, 429]);
	});
});

describe('GET /users/register/verify-email (US5.8, FR-064)', () => {
	it('every row of the token table, then the verified user is redirected to its page', async () => {
		const restore = await setSettings({ public_registration: true, public_registration_verify_email: true });
		const prefix = uniqueName('parity-invite-verify');

		try {
			const transcripts = await scenario(urls(), async (ctx) => {
				const flow = await startFlow(ctx);
				const email = `${prefix}-${ctx.app}@example.com`;
				await flow.req('POST', '/users/register', { email, password: 'parity-password-4' }, nextIp());

				const user = await hostDb()('directus_users').where({ email }).first();
				flow.name(user.id, 'user');

				const verify = (query: string) => flow.req('GET', `/users/register/verify-email${query}`, undefined, {});
				const named = (token: string, label: string) => (flow.name(token, label), token);
				const valid = named(sign({ email, scope: 'pending-registration' }), 'valid');

				await verify('?token=');
				await verify('?token=a&token=b');
				await verify('');
				await verify(
					`?token=${named(sign({ email, scope: 'pending-registration' }, {}, 'not-the-secret'), 'wrong-secret')}`,
				);
				await verify('?token=not.a.jwt');
				await verify(`?token=${named(sign({ email, scope: 'pending-registration' }, { expiresIn: -10 }), 'expired')}`);
				await verify(`?token=${named(sign({ email, scope: 'invite' }), 'scope')}`);
				await verify(`?token=${valid}`);
				await verify(`?token=${valid}`);
				await flow.rows('directus_users', (q) => q.where({ email }), { columns: USER_COLUMNS });
				return flow.transcript();
			});

			assertSameTranscripts(same(transcripts, prefix), 'verify email');
		} finally {
			await restore();
		}
	});
});
