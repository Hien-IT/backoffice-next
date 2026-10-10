// Feature 003 (US2, contracts/db-writes.md §4): share sessions. /shares comes to the new app later, so shares and
// their sessions are made at Directus (POST /shares/auth); each app then refreshes a session of its own share.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { directusRequest } from '../directus-api.js';
import { closeHostDb, hostDb } from './db-effects.js';
import { type App, urls } from './fixtures.js';
import { cookieJwt, type Mode, MODES, post, withToken } from './flows.js';
import { alias, assertSameTranscripts, scenario, send, snapshotOf } from './scenario.js';

const COLLECTION = `parity_shares_${Date.now().toString(36)}`;
let item: string | number;
const shares: string[] = [];

beforeAll(async () => {
	await directusRequest('POST', '/collections', { collection: COLLECTION, schema: {}, meta: { hidden: true } });
	item = (await directusRequest('POST', `/items/${COLLECTION}`, {})).data.id;
}, 60_000);

afterAll(async () => {
	if (shares.length) await directusRequest('DELETE', '/shares', shares);
	await directusRequest('DELETE', `/collections/${COLLECTION}`);
	await closeHostDb();
}, 60_000);

async function sharePerApp(data: Record<string, unknown> = {}): Promise<Record<App, string>> {
	const create = async () => {
		const share = await directusRequest('POST', '/shares', { name: 'parity', collection: COLLECTION, item, ...data });
		shares.push(share.data.id);
		return share.data.id as string;
	};

	return { directus: await create(), backoffice: await create() };
}

/** A session of the share, made by Directus. */
function shareLogin(share: string, mode: Mode) {
	const { directus } = urls();
	return send(directus, post('/shares/auth', { share, mode }), new URL(directus).host);
}

describe('share sessions', () => {
	it.each(MODES)('%s mode: refreshed at each app with the share claims', async (mode) => {
		const pair = await sharePerApp();

		const transcripts = await scenario(urls(), async (ctx) => {
			const first = await shareLogin(pair[ctx.app], mode);
			const refreshed = await send(ctx.url, withToken('/auth/refresh', first, mode), ctx.host);

			return alias(
				{
					refresh: snapshotOf('/auth/refresh', refreshed),
					...(mode === 'session' ? { claims: cookieJwt(refreshed) } : {}),
				},
				{ [pair[ctx.app]]: '<share>' },
			);
		});

		assertSameTranscripts(transcripts, `share refresh ${mode}`);

		const refresh = (transcripts.backoffice as any).refresh;
		expect(refresh.status).toBe(200);
		if (mode !== 'session')
			expect(refresh.body.data.access_token.claims).toMatchObject({ share: '<share>', role: null });
	});

	it.each([
		['ended', { date_end: new Date(Date.now() - 60_000).toISOString() }],
		['not started', { date_start: new Date(Date.now() + 3_600_000).toISOString() }],
	])('a share %s: 401', async (_name, change) => {
		const pair = await sharePerApp();

		const transcripts = await scenario(urls(), async (ctx) => {
			const first = await shareLogin(pair[ctx.app], 'json');
			await directusRequest('PATCH', `/shares/${pair[ctx.app]}`, change);
			return snapshotOf('/auth/refresh', await send(ctx.url, withToken('/auth/refresh', first, 'json'), ctx.host));
		});

		assertSameTranscripts(transcripts, `share ${_name}`);
		expect((transcripts.backoffice as any).status).toBe(401);
	});

	it('logout of a share session: 204, the session stays', async () => {
		const pair = await sharePerApp();

		const transcripts = await scenario(urls(), async (ctx) => {
			const first = await shareLogin(pair[ctx.app], 'json');
			const out = await send(ctx.url, withToken('/auth/logout', first, 'json'), ctx.host);
			const sessions = await hostDb()('directus_sessions').where({ share: pair[ctx.app] }).count({ n: '*' }).first();
			return { logout: snapshotOf('/auth/logout', out), sessions: Number(sessions?.['n']) };
		});

		assertSameTranscripts(transcripts, 'share logout');
		expect(transcripts.backoffice).toMatchObject({ logout: { status: 204 }, sessions: 1 });
	});
});
