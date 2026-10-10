// Feature 003 (FR-101, SC-002): tokens issued by one app and used at the other, the 4 pairs of matrix(). Refresh
// tokens and share sessions across apps are in refresh.test.ts, logout.test.ts and shares.test.ts; password reset
// tokens in password.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupFixtures, createRole, createUser, PASSWORD, type User, urls } from './fixtures.js';
import { cookiePair, login, MODES, post, withToken } from './flows.js';
import { matrix, type ScenarioContext, send, snapshotOf } from './scenario.js';

let user: User;

beforeAll(async () => {
	user = await createUser('token-matrix', { role: await createRole('parity-token-matrix', { app: true }) });
}, 60_000);

afterAll(cleanupFixtures, 60_000);

/** How a login answer carries its access token, as request headers. */
const credentials = (res: Awaited<ReturnType<typeof send>>, mode: string): Record<string, string> =>
	mode === 'session' ? { cookie: cookiePair(res) } : { authorization: `Bearer ${(res.json as any).data.access_token}` };

const generate = (ctx: ScenarioContext, headers: Record<string, string>) =>
	send(ctx.url, { ...post('/users/me/tfa/generate', { password: PASSWORD }), headers }, ctx.host);

function expectSameCells<T>(cells: { issuer: string; consumer: string; result: T }[]) {
	for (const cell of cells) expect(cell.result, `${cell.issuer} → ${cell.consumer}`).toEqual(cells[0]!.result);
}

describe('token matrix (FR-101)', () => {
	it.each(MODES)('access token of a %s login', async (mode) => {
		const cells = await matrix(
			urls(),
			async (ctx) => credentials(await login(ctx, user, mode), mode),
			async (ctx, headers) => snapshotOf('/users/me/tfa/generate', await generate(ctx, headers)),
		);

		expectSameCells(cells);
		expect(cells[0]!.result.status).toBe(200);
	});

	it('a session logged out at the issuer is refused at the next request (SC-002)', async () => {
		const cells = await matrix(
			urls(),
			async (ctx) => {
				const first = await login(ctx, user, 'session');
				await send(ctx.url, withToken('/auth/logout', first, 'session'), ctx.host);
				return credentials(first, 'session');
			},
			async (ctx, headers) => snapshotOf('/users/me/tfa/generate', await generate(ctx, headers)),
		);

		expectSameCells(cells);
		expect(cells[0]!.result.status).toBe(401);
	});
});
