// Ported from directus/tests/blackbox/tests/common/auth/refresh.test.ts (the REST part) on scenario(): each app
// refreshes the session of its own user (research R11). Feature 003 adds token errors, user status, cross-use in
// both directions, concurrent session refreshes and the rows written (contracts/db-writes.md §2).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { capture, parity, assertParity } from '../parity.js';
import { decodeJwt } from '../normalizers.js';
import { captureDbEffects, closeHostDb, normalizeEffects } from './db-effects.js';
import { type App, cleanupFixtures, createRole, createUserPerApp, type User, updateUser, urls } from './fixtures.js';
import { cookieJwt, cookiePair, login, type Mode, MODES, post, withToken } from './flows.js';
import { alias, assertSameTranscripts, matrix, scenario, send, snapshotOf } from './scenario.js';

const [vendor] = getDbsToTest();

// The 4 users of the blackbox suite: admin, app access, API only, no role; one of each per app.
const users: Record<string, Record<App, User>> = {};

beforeAll(async () => {
	users['admin'] = await createUserPerApp('refresh-admin', {
		role: await createRole('parity-refresh-admin', { admin: true, app: true }),
	});
	users['app'] = await createUserPerApp('refresh-app', { role: await createRole('parity-refresh-app', { app: true }) });
	users['api'] = await createUserPerApp('refresh-api', { role: await createRole('parity-refresh-api') });
	users['no role'] = await createUserPerApp('refresh-norole');
}, 120_000);

afterAll(async () => {
	await cleanupFixtures();
	await closeHostDb();
}, 60_000);

const aliases = (user: User) => ({ [user.id]: '<user>', [user.email]: '<email>' });

/** Login then refresh in `mode`: both answers, plus the claims of a session cookie. */
function loginThenRefresh(key: string, mode: Mode) {
	return scenario(urls(), async (ctx) => {
		const user = users[key]![ctx.app];
		const first = await login(ctx, user, mode);
		const refreshed = await send(ctx.url, withToken('/auth/refresh', first, mode), ctx.host);

		return alias(
			{
				login: snapshotOf('/auth/login', first),
				refresh: snapshotOf('/auth/refresh', refreshed),
				...(mode === 'session' ? { claims: cookieJwt(refreshed) } : {}),
			},
			aliases(user),
		);
	});
}

describe('POST /auth/refresh', () => {
	describe.each(MODES)('%s mode', (mode) => {
		it.each(['admin', 'app', 'api', 'no role'])('%s', async (key) => {
			const transcripts = await loginThenRefresh(key, mode);
			assertSameTranscripts(transcripts, `refresh ${mode} ${key}`);
			expect((transcripts.backoffice as any).refresh.status).toBe(200);
		});
	});

	describe('token errors', () => {
		it.each([
			['no token in the body: 400', post('/auth/refresh', {})],
			['json mode without refresh_token: 400', post('/auth/refresh', { mode: 'json' })],
			['session mode without cookie: 400', post('/auth/refresh', { mode: 'session' })],
			['unknown token: 401', post('/auth/refresh', { refresh_token: 'x'.repeat(64) })],
			['unknown cookie: 401', post('/auth/refresh', {}, `directus_refresh_token=${'x'.repeat(64)}`)],
		])('%s', async (name, req) => {
			const result = await parity(req);
			assertParity(result);
			expect(result.directus.status).toBe(Number(name.match(/(\d+)$/)![1]));
		});

		it('a token used once, or logged out: 401', async () => {
			const transcripts = await scenario(urls(), async (ctx) => {
				const user = users['app']![ctx.app];
				const first = await login(ctx, user, 'json');
				await send(ctx.url, withToken('/auth/refresh', first, 'json'), ctx.host);
				const reused = await send(ctx.url, withToken('/auth/refresh', first, 'json'), ctx.host);

				const second = await login(ctx, user, 'json');
				await send(ctx.url, withToken('/auth/logout', second, 'json'), ctx.host);
				const loggedOut = await send(ctx.url, withToken('/auth/refresh', second, 'json'), ctx.host);

				return [snapshotOf('/auth/refresh', reused), snapshotOf('/auth/refresh', loggedOut)];
			});

			assertSameTranscripts(transcripts, 'reused and logged out');
			expect((transcripts.backoffice as any)[0].status).toBe(401);
		});
	});

	describe('user status', () => {
		it.each(['suspended', 'draft', 'invited', 'archived'] as const)(
			'%s: 401 and the session deleted',
			async (status) => {
				const pair = await createUserPerApp(`refresh-${status}`);

				const transcripts = await scenario(urls(), async (ctx) => {
					const user = pair[ctx.app];
					const first = await login(ctx, user, 'json');
					await updateUser(user.id, { status });

					let refreshed!: Awaited<ReturnType<typeof send>>;

					const raw = await captureDbEffects(user.id, async () => {
						refreshed = await send(ctx.url, withToken('/auth/refresh', first, 'json'), ctx.host);
					});

					const again = await capture(ctx.url, withToken('/auth/refresh', first, 'json'));

					return alias(
						{ refresh: snapshotOf('/auth/refresh', refreshed), effects: normalizeEffects(raw), again: again.status },
						aliases(user),
					);
				});

				assertSameTranscripts(transcripts, `status ${status}`);
			},
		);
	});

	describe('rows written (contracts/db-writes.md §2)', () => {
		it.each(MODES)('%s mode', async (mode) => {
			const pair = await createUserPerApp(`refresh-db-${mode}`);

			const transcripts = await scenario(urls(), async (ctx) => {
				const user = pair[ctx.app];
				const first = await login(ctx, user, mode);
				const raw = await captureDbEffects(user.id, () =>
					send(ctx.url, withToken('/auth/refresh', first, mode), ctx.host),
				);
				return alias(normalizeEffects(raw), aliases(user));
			});

			assertSameTranscripts(transcripts, `refresh rows ${mode}`);
		});
	});

	describe('cross-use: a session of one app refreshed at the other', () => {
		it.each(MODES)('%s mode', async (mode) => {
			const user = users['app']!.directus;

			const cells = await matrix(
				urls(),
				(ctx) => login(ctx, user, mode),
				async (ctx, first) => {
					const refreshed = await send(ctx.url, withToken('/auth/refresh', first, mode), ctx.host);
					return {
						refresh: snapshotOf('/auth/refresh', refreshed),
						...(mode === 'session' ? { claims: cookieJwt(refreshed) } : {}),
					};
				},
			);

			for (const cell of cells) {
				expect(cell.result, `${cell.issuer} → ${cell.consumer}`).toEqual(cells[0]!.result);
			}

			expect((cells[0]!.result as any).refresh.status).toBe(200);
		});
	});

	// MySQL has no UPDATE ... RETURNING: the losing request of Directus itself then creates its own session.
	describe.skipIf(vendor === 'mysql' || vendor === 'mysql5' || vendor === 'maria')(
		'concurrent session refreshes (US2.3)',
		() => {
			it('one request to each app at once: both get the same new session, 10 times', async () => {
				const { directus, backoffice } = urls();
				const host = new URL(directus).host;

				for (let i = 0; i < 10; i++) {
					const first = await login({ app: 'directus', url: directus, host }, users['api']!.directus, 'session');
					const req = withToken('/auth/refresh', first, 'session');

					const [a, b] = await Promise.all([send(directus, req, host), send(backoffice, req, host)]);
					expect([a.status, b.status], `attempt ${i}`).toEqual([200, 200]);

					const session = (res: typeof a) => decodeJwt(cookiePair(res).split('=')[1]!)?.['session'];
					expect(session(b), `attempt ${i}`).toBe(session(a));
				}
			});
		},
	);
});
