// Feature 003 (US2, FR-024, contracts/db-writes.md §3): logout in the three modes on scenario(). The cookie is
// cleared like Express 4 does (empty value, Max-Age kept); a session logged out at one app is gone at the other.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertParity, parity } from '../parity.js';
import { captureDbEffects, closeHostDb, normalizeEffects } from './db-effects.js';
import { type App, cleanupFixtures, createUserPerApp, type User, urls } from './fixtures.js';
import { login, MODES, post, withToken } from './flows.js';
import { alias, assertSameTranscripts, matrix, scenario, send, snapshotOf } from './scenario.js';

let users: Record<App, User>;

beforeAll(async () => {
	users = await createUserPerApp('logout');
}, 60_000);

afterAll(async () => {
	await cleanupFixtures();
	await closeHostDb();
}, 60_000);

describe('POST /auth/logout', () => {
	it.each(MODES)('%s mode: 204, cleared cookie, session deleted, activity `logout`', async (mode) => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const user = users[ctx.app];
			const first = await login(ctx, user, mode);
			let out!: Awaited<ReturnType<typeof send>>;

			const raw = await captureDbEffects(user.id, async () => {
				out = await send(ctx.url, withToken('/auth/logout', first, mode), ctx.host);
			});

			const refreshed = await send(ctx.url, withToken('/auth/refresh', first, mode), ctx.host);

			return alias(
				{
					logout: snapshotOf('/auth/logout', out),
					effects: normalizeEffects(raw),
					refresh: snapshotOf('/auth/refresh', refreshed),
				},
				{ [user.id]: '<user>', [user.email]: '<email>' },
			);
		});

		assertSameTranscripts(transcripts, `logout ${mode}`);

		const backoffice = transcripts.backoffice as any;
		expect(backoffice.logout.status).toBe(204);
		expect(backoffice.effects.activity).toEqual([expect.objectContaining({ action: 'logout' })]);
		if (mode !== 'json') expect(backoffice.logout.headers['set-cookie']).toMatch(/=<empty>; Max-Age=/);
	});

	it.each(MODES)('%s mode: logged out at one app, refresh at the other is 401', async (mode) => {
		const user = users.directus;

		const cells = await matrix(
			urls(),
			async (ctx) => {
				const first = await login(ctx, user, mode);
				await send(ctx.url, withToken('/auth/logout', first, mode), ctx.host);
				return first;
			},
			async (ctx, first) =>
				snapshotOf('/auth/refresh', await send(ctx.url, withToken('/auth/refresh', first, mode), ctx.host)),
		);

		for (const cell of cells) expect(cell.result, `${cell.issuer} → ${cell.consumer}`).toEqual(cells[0]!.result);
		expect(cells[0]!.result.status).toBe(401);
	});

	it.each([
		['no token: 400', post('/auth/logout', {})],
		['session mode without cookie: 400', post('/auth/logout', { mode: 'session' })],
		['unknown token: 204', post('/auth/logout', { refresh_token: 'x'.repeat(64) })],
	])('%s', async (name, req) => {
		const result = await parity(req);
		assertParity(result);
		expect(result.directus.status).toBe(Number(name.match(/(\d+)$/)![1]));
	});
});
