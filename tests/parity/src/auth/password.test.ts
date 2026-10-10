// Feature 003, US6.1 to US6.6 (contracts/db-writes.md §5): password reset. Neither app sends email (D-23 for the
// new app; the parity Directus has no working transport), so reset tokens are signed here in the Directus format.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { logs } from '../docker.js';
import { assertParity, capture, parity, type ParityRequest } from '../parity.js';
import { captureDbEffects, closeHostDb, hostDb, normalizeEffects } from './db-effects.js';
import {
	type App,
	APPS,
	cleanupFixtures,
	createUser,
	createUserPerApp,
	PASSWORD,
	setSettings,
	type User,
	urls,
} from './fixtures.js';
import { post } from './flows.js';
import { alias, assertSameTranscripts, scenario, send, snapshotOf } from './scenario.js';
import { signResetToken } from './tokens.js';

const STALL_TIME = 500;
let active: User;

beforeAll(async () => {
	active = await createUser('password');
}, 60_000);

afterAll(async () => {
	await cleanupFixtures();
	await closeHostDb();
}, 60_000);

async function expectParity(req: ParityRequest, status: number, code?: string) {
	const result = await parity(req);
	assertParity(result);
	expect(result.directus.status).toBe(status);
	if (code) expect((result.directus.json as any).errors[0].extensions.code).toBe(code);
	return result;
}

const passwordHash = async (user: User) =>
	(await hostDb()('directus_users').select('password').where({ id: user.id }).first()).password as string;

const resetToken = async (user: User, options?: Parameters<typeof signResetToken>[2]) =>
	signResetToken(user.email, await passwordHash(user), options);

describe('POST /auth/password/request', () => {
	it('an active user: 204 after LOGIN_STALL_TIME, a log line without token at the new app (FR-062)', async () => {
		const start = performance.now();
		await expectParity(post('/auth/password/request', { email: active.email }), 204);
		expect(performance.now() - start).toBeGreaterThanOrEqual(STALL_TIME);

		const line = logs('backoffice-api')
			.split('\n')
			.find((l) => l.includes(`Password reset email to "${active.email}"`));

		expect(line).toBeDefined();
		expect(line).not.toMatch(/eyJ|token=|reset-password/);
	});

	it.each([
		['an unknown email', () => ({ email: 'nobody-reset@example.com' })],
		[
			'a suspended user',
			async () => ({ email: (await createUser('password-suspended', { status: 'suspended' })).email }),
		],
		[
			'an SSO user',
			async () => ({
				email: (await createUser('password-sso', { provider: 'oidc', external_identifier: `pw-${Date.now()}` })).email,
			}),
		],
	])('%s: 204 like an active user', async (_name, body) => {
		await expectParity(post('/auth/password/request', await body()), 204);
	});

	it.each([
		['no email: 400', {}],
		[
			'reset_url outside PASSWORD_RESET_URL_ALLOW_LIST: 400',
			{ email: 'x@example.com', reset_url: 'https://evil.example/reset' },
		],
	])('%s', async (_name, body) => {
		await expectParity(post('/auth/password/request', body), 400, 'INVALID_PAYLOAD');
	});
});

describe('POST /auth/password/reset', () => {
	it('a token signed like Directus: password changed, sessions deleted, rows like Directus, login at both apps', async () => {
		const pair = await createUserPerApp('password-reset');

		const transcripts = await scenario(urls(), async (ctx) => {
			const user = pair[ctx.app];
			await send(ctx.url, post('/auth/login', { email: user.email, password: PASSWORD }), ctx.host);
			const token = await resetToken(user);
			let res!: Awaited<ReturnType<typeof send>>;

			const raw = await captureDbEffects(user.id, async () => {
				res = await send(ctx.url, post('/auth/password/reset', { token, password: 'new-parity-password' }), ctx.host);
			});

			const sessions = await hostDb()('directus_sessions').where({ user: user.id });

			return alias(
				{ reset: snapshotOf('/auth/password/reset', res), effects: normalizeEffects(raw), sessions: sessions.length },
				{ [user.id]: '<user>', [user.email]: '<email>' },
			);
		});

		assertSameTranscripts(transcripts, 'password reset');
		expect(transcripts.backoffice).toMatchObject({ reset: { status: 204 }, sessions: 0 });

		for (const app of APPS as App[]) {
			for (const at of APPS as App[]) {
				const login = await capture(
					urls()[at],
					post('/auth/login', { email: pair[app].email, password: 'new-parity-password' }),
				);
				expect(login.status, `${app} user at ${at}`).toBe(200);
			}
		}
	});

	it('errors: missing fields 400, bad or expired token, other scope, used token', async () => {
		await expectParity(post('/auth/password/reset', { password: 'x' }), 400, 'INVALID_PAYLOAD');
		await expectParity(post('/auth/password/reset', { token: 'x' }), 400, 'INVALID_PAYLOAD');
		await expectParity(post('/auth/password/reset', { token: 'not-a-jwt', password: 'x' }), 403, 'INVALID_TOKEN');

		const user = await createUser('password-errors');
		await expectParity(
			post('/auth/password/reset', { token: await resetToken(user, { expiresIn: -10 }), password: 'x' }),
			401,
			'TOKEN_EXPIRED',
		);
		await expectParity(
			post('/auth/password/reset', { token: await resetToken(user, { scope: 'invite' }), password: 'x' }),
			403,
			'FORBIDDEN',
		);
		await expectParity(
			post('/auth/password/reset', { token: await resetToken(user, { secret: 'other' }), password: 'x' }),
			403,
			'INVALID_TOKEN',
		);

		// Signed for an older password hash: refused (a used token).
		const stale = signResetToken(user.email, 'not-the-current-hash');
		await expectParity(post('/auth/password/reset', { token: stale, password: 'x' }), 403, 'FORBIDDEN');
	});

	it('auth_password_policy: 400 FAILED_VALIDATION, nothing written', async () => {
		const restore = await setSettings({ auth_password_policy: '/^.{12,}$/' });

		try {
			const user = await createUser('password-policy');
			const before = await passwordHash(user);
			await expectParity(
				post('/auth/password/reset', { token: await resetToken(user), password: 'short' }),
				400,
				'FAILED_VALIDATION',
			);
			expect(await passwordHash(user)).toBe(before);
		} finally {
			await restore();
		}
	});
});
