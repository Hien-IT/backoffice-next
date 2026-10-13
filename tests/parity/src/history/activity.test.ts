// Feature 008, US1 (spec FR-001, FR-002, FR-004, FR-010 to FR-013, FR-060): the activity rows each app writes for the
// same requests, and /activity read at both apps (query, SEARCH, one row, aggregate, access, OPTIONS, HEAD).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, BROWSER, historyCollection, same, step } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const ALL = `parity_hist_all_${run}`;
const ACTIVITY = `parity_hist_act_${run}`;
const NONE = `parity_hist_none_${run}`;
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const full = process.env['PARITY_SUITE'] !== 'reduced';

let appUser: TestUser;
let apiUser: TestUser;

beforeAll(async () => {
	await historyCollection(ALL, { accountability: 'all' });
	await historyCollection(ACTIVITY, { accountability: 'activity' });
	await historyCollection(NONE, { accountability: null });

	// A user with app access and nothing else: the app minimal permissions let it read its own activity only.
	appUser = await createUser('directus', 'hist-app');
	await attachPolicy('directus', await createPolicy('directus', 'hist-app', { app: true }), { user: appUser.id });
	// A user without app access nor any permission on directus_activity.
	apiUser = await createUser('directus', 'hist-api');
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 120_000);

/** Create, update and delete one item of `collection` at an app, with the history rows of each request. */
async function crud(collection: string) {
	return scenario(urls(), async (ctx) => {
		const headers = { ...(await admin()), ...BROWSER };
		const path = `/items/${collection}`;

		const created = await step(ctx, { method: 'POST', path, headers, body: { title: 'one' } }, path, {}, (j) => ({
			item: j.data.id,
		}));
		const ids = { item: created.json.data.id as string };

		const updated = await step(
			ctx,
			{ method: 'PATCH', path: `${path}/${ids.item}`, headers, body: { title: 'two' } },
			`${path}/:pk`,
			ids,
		);
		const deleted = await step(ctx, { method: 'DELETE', path: `${path}/${ids.item}`, headers }, `${path}/:pk`, ids);

		return { created: created.step, updated: updated.step, deleted: deleted.step };
	});
}

describe('rows written for the same requests (US1.1, US1.2)', () => {
	it('accountability "all": one activity and one revision per write, column by column', async () => {
		const transcripts = await crud(ALL);
		assertSameTranscripts(transcripts, 'accountability all');

		const history = transcripts.directus.updated.history as any;
		expect(history.activity).toEqual([
			expect.objectContaining({
				action: 'update',
				collection: ALL,
				item: '<item>',
				user_agent: BROWSER['user-agent'],
				origin: BROWSER.origin,
			}),
		]);
		// The snapshot holds every non-relational field after the write, the delta only the change (spec FR-010).
		expect(history.revisions[0]).toMatchObject({
			activity: 0,
			data: { id: '<item>', title: 'two' },
			delta: { title: 'two' },
		});
	});

	it('accountability "activity": activity only; null: nothing', async () => {
		const activity = await crud(ACTIVITY);
		assertSameTranscripts(activity, 'accountability activity');
		expect((activity.directus.updated.history as any).revisions).toEqual([]);
		expect((activity.directus.updated.history as any).activity).toHaveLength(1);

		const none = await crud(NONE);
		assertSameTranscripts(none, 'accountability null');
		expect((none.directus.updated.history as any).activity).toEqual([]);
	});

	it.runIf(full)('a system collection: PATCH /users/:id writes the same rows', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const user = await createUser('directus', `hist-${ctx.app}`);
			const ids = { user: user.id, email: user.email, token: user.token };

			const patched = await step(
				ctx,
				{
					method: 'PATCH',
					path: `/users/${user.id}`,
					headers: { ...(await admin()), ...BROWSER },
					body: { first_name: 'Parity' },
				},
				'/users/:pk',
				ids,
			);

			return patched.step;
		});

		assertSameTranscripts(transcripts, 'PATCH /users/:id');
	});
});

describe('/activity read at both apps (US1.4)', () => {
	let rows: { id: number }[] = [];

	beforeAll(async () => {
		// Rows of the "all" collection, written by both apps above.
		rows = (await appRequest('directus', 'GET', `/activity?filter=${json({ collection: { _eq: ALL } })}&sort=id`)).data;
	});

	it('GET with filter, nested fields, sort, limit, page and meta', async () => {
		const headers = await admin();
		const filter = json({ collection: { _eq: ALL } });
		const fields = 'id,action,collection,item,user.email,user_agent,origin,ip,revisions.id,revisions.delta,timestamp';

		await same({ path: `/activity?filter=${filter}&fields=${fields}&sort=-id&limit=2&page=2&meta=*`, headers });
		await same({
			path: `/activity?filter=${json({ _and: [{ collection: { _eq: ALL } }, { revisions: { delta: { _nnull: true } } }] })}&sort=id`,
			headers,
		});
	});

	it('SEARCH by keys and by query; an unknown key in the body is 400', async () => {
		const headers = await admin();

		await same({ method: 'SEARCH', path: '/activity', headers, body: { keys: rows.slice(0, 2).map((r) => r.id) } });
		await same({
			method: 'SEARCH',
			path: '/activity',
			headers,
			body: { query: { filter: { collection: { _eq: ALL } }, sort: ['id'], fields: ['id', 'action'] } },
		});
		await same({ method: 'SEARCH', path: '/activity', headers, body: { foo: 1 } });
	});

	it('GET /:pk of a row and of a row that does not exist', async () => {
		const headers = await admin();

		await same({ path: `/activity/${rows[0]!.id}?fields=*,revisions.*`, headers });
		await same({ path: '/activity/2147483000', headers });
	});

	it('aggregate and groupBy', async () => {
		const headers = await admin();
		const filter = json({ collection: { _eq: ALL } });

		await same({ path: `/activity?filter=${filter}&aggregate[count]=*&groupBy[]=action&sort=action`, headers });
		await same({ path: `/activity?filter=${filter}&aggregate[countDistinct]=item`, headers });
	});

	it('access: app access reads its own rows only, no permission and public are forbidden (US1.5)', async () => {
		const filter = json({ collection: { _eq: ALL } });

		await same({ path: `/activity?filter=${filter}`, headers: { authorization: `Bearer ${appUser.token}` } });
		await same({ path: '/activity?limit=1', headers: { authorization: `Bearer ${appUser.token}` } });
		await same({ path: `/activity?filter=${filter}`, headers: { authorization: `Bearer ${apiUser.token}` } });
		await same({ path: `/activity?filter=${filter}` });
		await same({ path: `/activity/${rows[0]!.id}`, headers: { authorization: `Bearer ${appUser.token}` } });
	});

	it('OPTIONS and HEAD', async () => {
		for (const path of ['/activity', '/activity/', `/activity/${rows[0]!.id}`, '/activity/1/x']) {
			await same({ method: 'OPTIONS', path });
		}

		await same({
			method: 'HEAD',
			path: `/activity?filter=${json({ collection: { _eq: ALL } })}`,
			headers: await admin(),
		});
	});

	it.runIf(full)('the response cache is shared: an entry Directus wrote is a hit at both apps (US1.6)', async () => {
		const headers = { ...(await admin()), 'cache-control': '' };
		const path = `/activity?filter=${json({ collection: { _eq: ALL } })}&fields=id&run=${run}`;

		// The first read of a new URL fills the shared cache (Directus here); both apps then answer from it.
		await fetch(new URL(path, process.env['DIRECTUS_URL']), { headers });
		const result = await same({ path, headers }, { sequential: true });
		expect([result.directus.headers['x-cache-status'], result.backoffice.headers['x-cache-status']]).toEqual([
			'HIT',
			'HIT',
		]);
	});
});
