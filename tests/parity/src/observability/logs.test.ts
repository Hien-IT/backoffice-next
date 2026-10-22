// T088, US5, contracts/observability.md §1: HTTP log lines with LOG_STYLE=raw on the `metrics` profile pair.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { type App, cleanupFixtures, createUserPerApp, PASSWORD, type User } from '../auth/fixtures.js';
import { cookiePair, type Mode, MODES, post, withToken } from '../auth/flows.js';
import { sharedSecret, signResetToken, totp } from '../auth/tokens.js';
import { appRequest } from '../directus-api.js';
import jwt from 'jsonwebtoken';
import { logs } from '../docker.js';
import { capture } from '../parity.js';
import { profileUrls } from '../profiles.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';

/** Fields that differ by nature between two processes. */
const SKIPPED = new Set(['time', 'pid', 'hostname', 'req.remotePort', 'responseTime', 'req.id']);

/** Recursive key paths of a log line (values are not compared). */
function keyPaths(value: unknown, prefix = ''): string[] {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];

	return Object.entries(value)
		.flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k))
		.filter((p) => !SKIPPED.has(p))
		.sort();
}

/** The HTTP log line of the request carrying `probe`, from the container logs. */
async function httpLine(service: string, probe: string): Promise<any> {
	for (let i = 0; i < 20; i++) {
		const line = logs(service)
			.split('\n')
			.filter((l) => l.startsWith('{'))
			.map((l) => JSON.parse(l))
			.find((l) => l.req?.query?.probe === probe);

		if (line) return line;
		await new Promise((r) => setTimeout(r, 500));
	}

	throw new Error(`No HTTP log line for probe ${probe} in ${service}`);
}

describe.runIf(suite === 'full' && profileUrls('metrics'))('HTTP log lines (LOG_STYLE=raw)', () => {
	const urls = () => profileUrls('metrics')!;

	it.each([
		[
			'Authorization and Cookie headers',
			{ authorization: 'Bearer log-secret-1', cookie: 'directus_session_token=log-secret-2' },
			'',
		],
		['?access_token=', {}, '&access_token=log-secret-3'],
	])('%s: same key set as Directus, values redacted', { timeout: 30_000 }, async (_label, headers, query) => {
		const probe = randomUUID();
		const req = { path: `/server/ping?probe=${probe}${query}`, headers };

		await capture(urls().directusUrl!, req);
		await capture(urls().backofficeUrl!, req);

		const [d, b] = [await httpLine('directus-metrics', probe), await httpLine('backoffice-api-metrics', probe)];

		expect(keyPaths(b)).toEqual(keyPaths(d));
		expect(b.msg).toBe(d.msg);
		expect(b.res.statusCode).toBe(d.res.statusCode);
		expect(b.req.url).toBe(d.req.url);

		if ('authorization' in headers) {
			expect(b.req.headers.authorization).toBe('--redacted--');
			expect(b.req.headers.cookie).toBe('--redacted--');
		} else {
			expect(b.req.query.access_token).toBe('--redacted--');
			expect(b.req.url).toContain('access_token=--redacted--');
		}

		expect(logs('backoffice-api-metrics')).not.toMatch(/log-secret-\d/);
	});

	// Feature 005 (T050, R-06 of 004): an export opened by the app carries access_token in the URL; the HTTP log line
	// redacts it like Directus.
	it('?export=json&access_token=: the same line as Directus, the token redacted', { timeout: 30_000 }, async () => {
		const probe = randomUUID();
		const req = { path: `/server/info?probe=${probe}&export=json&access_token=log-secret-4` };

		await capture(urls().directusUrl!, req);
		await capture(urls().backofficeUrl!, req);

		const [d, b] = [await httpLine('directus-metrics', probe), await httpLine('backoffice-api-metrics', probe)];

		expect(keyPaths(b)).toEqual(keyPaths(d));
		expect([b.msg, b.res.statusCode, b.req.url]).toEqual([d.msg, d.res.statusCode, d.req.url]);
		expect(b.req.url).toContain('access_token=--redacted--');
		expect(logs('backoffice-api-metrics')).not.toContain('log-secret-4');
	});
});

// Feature 003: the cookie part of directus/tests/blackbox/tests/common/logger/redact.test.ts (REST), and FR-063: no
// token, refresh token, password, OTP or TFA secret used in the auth flows shows up in the logs of the new app.
describe.runIf(suite === 'full' && profileUrls('metrics'))('auth log lines (LOG_STYLE=raw)', () => {
	const urls = () => profileUrls('metrics')!;
	let users: Record<App, User>;

	beforeAll(async () => {
		users = await createUserPerApp('logs');
	}, 60_000);

	afterAll(async () => {
		await cleanupFixtures();
		await closeHostDb();
	}, 60_000);

	/** Login in `mode` then POST /auth/refresh?probe=<uuid> with what the login gave; returns the refresh log line. */
	async function refreshLine(app: App, mode: Mode) {
		const url = app === 'directus' ? urls().directusUrl! : urls().backofficeUrl!;
		const service = app === 'directus' ? 'directus-metrics' : 'backoffice-api-metrics';
		const user = users[app];
		const login = await capture(url, post('/auth/login', { email: user.email, password: PASSWORD, mode }));
		const probe = randomUUID();
		const req = withToken(`/auth/refresh?probe=${probe}`, login, mode);
		const res = await capture(url, req);
		expect(res.status, `${app} ${mode}`).toBe(200);
		return httpLine(service, probe);
	}

	it.each(MODES)(
		'refresh in %s mode: cookie and set-cookie redacted like Directus',
		{ timeout: 60_000 },
		async (mode) => {
			const [d, b] = [await refreshLine('directus', mode), await refreshLine('backoffice', mode)];

			expect(b.req.headers.cookie).toBe(d.req.headers.cookie);
			expect(b.res.headers?.['set-cookie']).toBe(d.res.headers?.['set-cookie']);
			expect(b.req.headers.cookie).toBe(mode === 'json' ? undefined : '--redacted--');
		},
	);

	it('no secret of the auth flows in the logs of the new app (FR-063)', { timeout: 60_000 }, async () => {
		const url = urls().backofficeUrl!;
		const user = users.backoffice;
		const secrets = [PASSWORD];

		const json = (await capture(url, post('/auth/login', { email: user.email, password: PASSWORD }))).json as any;
		secrets.push(json.data.access_token, json.data.refresh_token);

		const refreshed = (await capture(url, post('/auth/refresh', { refresh_token: json.data.refresh_token })))
			.json as any;
		secrets.push(refreshed.data.access_token, refreshed.data.refresh_token);

		const session = await capture(url, post('/auth/login', { email: user.email, password: PASSWORD, mode: 'session' }));
		secrets.push(cookiePair(session).split('=')[1]!);

		const tfa = await capture(url, {
			...post('/users/me/tfa/generate', { password: PASSWORD }),
			headers: { authorization: `Bearer ${refreshed.data.access_token}` },
		});

		secrets.push((tfa.json as any).data.secret);
		await capture(url, post('/auth/login', { email: user.email, password: PASSWORD, otp: '123456' }));

		await capture(url, post('/auth/password/request', { email: user.email }));
		const hash = (await hostDb()('directus_users').select('password').where({ id: user.id }).first()).password;
		const resetToken = signResetToken(user.email, hash);
		secrets.push(resetToken, 'new-log-password');
		await capture(url, post('/auth/password/reset', { token: resetToken, password: 'new-log-password' }));

		await new Promise((r) => setTimeout(r, 1000));
		const output = logs('backoffice-api-metrics');

		for (const secret of secrets) expect(output.includes(secret), secret.slice(0, 12)).toBe(false);
	});

	// Feature 004 (FR-092): the flows of users, invites, registration and TFA write no secret in the logs of the new
	// app, and the revisions mask the concealed fields.
	it(
		'no secret of the user flows of feature 004 in the logs; concealed fields masked in revisions',
		{ timeout: 60_000 },
		async () => {
			const url = urls().backofficeUrl!;
			const sign = (payload: object) => jwt.sign(payload, sharedSecret(), { issuer: 'directus', expiresIn: '1h' });
			const login = async (email: string, password: string) =>
				((await capture(url, post('/auth/login', { email, password }))).json as any).data.access_token as string;
			const adminToken = await login('admin@example.com', 'password');
			const admin = { authorization: `Bearer ${adminToken}` };
			const run = randomUUID().slice(0, 8);
			const secrets: string[] = [];
			let verify = '';

			// Static token and password set through /users, then the password changed by the user.
			const staticToken = `log-static-${run}`;
			const email = `log-user-${run}@example.com`;
			const created = await capture(url, {
				...post('/users', { email, password: `log-pass-${run}`, token: staticToken }),
				headers: admin,
			});
			const userId = (created.json as any).data.id;
			secrets.push(staticToken, `log-pass-${run}`);

			// The admin changes the password (a user without role may not update its own row).
			await capture(url, {
				method: 'PATCH',
				path: `/users/${userId}`,
				body: { password: `log-pass2-${run}` },
				headers: admin,
			});
			secrets.push(`log-pass2-${run}`);

			// TFA enabled then disabled with OTPs.
			const user = { authorization: `Bearer ${staticToken}` };
			const generated = (
				await capture(url, { ...post('/users/me/tfa/generate', { password: `log-pass2-${run}` }), headers: user })
			).json as any;
			const secret = generated.data.secret as string;
			const otp = await totp(secret);
			secrets.push(secret);
			await capture(url, { ...post('/users/me/tfa/enable', { secret, otp }), headers: user });
			await capture(url, { ...post('/users/me/tfa/disable', { otp: await totp(secret) }), headers: user });

			// Invite and accept with the invite token.
			const roles = await appRequest('directus', 'GET', '/roles?limit=1&fields=id');
			const invited = `log-invite-${run}@example.com`;
			await capture(url, { ...post('/users/invite', { email: invited, role: roles.data[0].id }), headers: admin });
			const inviteToken = sign({ email: invited, scope: 'invite' });
			secrets.push(inviteToken, `log-invite-pass-${run}`);
			await capture(url, post('/users/invite/accept', { token: inviteToken, password: `log-invite-pass-${run}` }));

			// Registration and verification (public registration with verification for the time of the case).
			const { data: settings } = await appRequest(
				'directus',
				'GET',
				'/settings?fields=public_registration,public_registration_verify_email',
			);
			await appRequest('directus', 'PATCH', '/settings', {
				public_registration: true,
				public_registration_verify_email: true,
			});

			try {
				const registered = `log-register-${run}@example.com`;
				await capture(url, {
					...post('/users/register', { email: registered, password: `log-register-pass-${run}` }),
					headers: { 'x-forwarded-for': `10.45.${Number.parseInt(run.slice(0, 2), 16)}.1` },
				});
				const verifyToken = sign({ email: registered, scope: 'pending-registration' });
				secrets.push(`log-register-pass-${run}`);
				verify = `/users/register/verify-email?token=${verifyToken}`;
				await capture(url, { path: verify });
				await capture(urls().directusUrl!, { path: verify });
			} finally {
				await appRequest('directus', 'PATCH', '/settings', settings);
			}

			await new Promise((r) => setTimeout(r, 1000));
			const output = logs('backoffice-api-metrics');

			for (const s of secrets) expect(output.includes(s), s.slice(0, 16)).toBe(false);

			// R-06: like Directus (redactQuery only masks access_token), the HTTP log line keeps the URL of the
			// verification request, token included; no other line has it.
			const linesWith = (service: string) =>
				logs(service)
					.split('\n')
					.filter((l) => l.includes(verify));
			expect(linesWith('directus-metrics').length).toBeGreaterThan(0);
			expect(linesWith('backoffice-api-metrics')).toHaveLength(1);
			const token = verify.split('=')[1]!;
			expect(linesWith('backoffice-api-metrics')[0]).toContain(`"query":{"token":"${token}"}`);
			expect(output.split('\n').filter((l) => l.includes(token) && !l.includes(verify))).toEqual([]);
			expect(output).toContain(`Invitation email to \\"${invited}\\"`);

			// Revisions of the user written by the new app: password, token and tfa_secret masked.
			const revisions = await hostDb()('directus_revisions')
				.where({ collection: 'directus_users', item: userId })
				.select('data', 'delta');
			const text = JSON.stringify(revisions);
			for (const s of [staticToken, `log-pass-${run}`, secret]) expect(text.includes(s), s.slice(0, 16)).toBe(false);
			expect(text).toContain('**********');

			await appRequest('directus', 'DELETE', '/users', { query: { filter: { email: { _contains: run } } } });
		},
	);
});
