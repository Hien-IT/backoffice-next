// T088, US5, contracts/observability.md §1: HTTP log lines with LOG_STYLE=raw on the `metrics` profile pair.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { type App, cleanupFixtures, createUserPerApp, PASSWORD, type User } from '../auth/fixtures.js';
import { cookiePair, type Mode, MODES, post, withToken } from '../auth/flows.js';
import { signResetToken } from '../auth/tokens.js';
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
});
