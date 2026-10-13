// Feature 008 (spec FR-062): history written at one app and used at the other, both ways. Revert (US3): the Directus
// app takes the payload from the data of the chosen revision and of the one before it (comparison-modal.vue,
// use-comparison.ts) and saves it with PATCH /items; the item, its new activity and revision must be the same
// whichever app wrote the revisions and whichever app saves.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario, type ScenarioContext } from '../auth/scenario.js';
import { type AppName, appRequest } from '../directus-api.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, BROWSER, call, historyCollection, snap, step } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const POSTS = `parity_cross_posts_${run}`;
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const other = (app: AppName): AppName => (app === 'directus' ? 'backoffice' : 'directus');

let reader: TestUser;

beforeAll(async () => {
	await historyCollection(POSTS, {}, [{ field: 'body', type: 'text' }]);
	reader = await createUser('directus', 'cross-reader');
	const policy = await createPolicy('directus', 'cross-reader', {
		app: true,
		permissions: [{ collection: POSTS, action: 'read', fields: ['*'], permissions: {} }],
	});
	await attachPolicy('directus', policy, { user: reader.id });
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 120_000);

/**
 * The payload the comparison modal builds for `revision`: the fields whose data differ from the revision before. The
 * app merges the primary key of the base into both sides first (a create revision stores the create payload, no id).
 */
function revertPayload(revision: { data: Record<string, unknown> }, previous: { data: Record<string, unknown> }) {
	return Object.fromEntries(
		Object.entries(revision.data).filter(
			([field, value]) => field !== 'id' && JSON.stringify(previous.data[field] ?? null) !== JSON.stringify(value),
		),
	);
}

describe('revert through the Directus app flow (US3)', () => {
	it('revisions written at one app, reverted at the other: item, activity and revision match both ways', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const writer = ctx.app;
			const item = (await appRequest(writer, 'POST', `/items/${POSTS}`, { title: 'v1', body: 'b1' })).data.id as string;
			await appRequest(writer, 'PATCH', `/items/${POSTS}/${item}`, { title: 'v2' });
			await appRequest(writer, 'PATCH', `/items/${POSTS}/${item}`, { title: 'v3', body: 'b3' });

			const reverter: ScenarioContext = { ...ctx, app: other(writer), url: urls()[other(writer)] };
			const headers = { ...(await admin()), ...BROWSER };
			const filter = json({
				_and: [{ collection: { _eq: POSTS } }, { item: { _eq: item } }, { version: { _null: true } }],
			});

			// The sidebar page with data and delta (use-revisions.ts, `full`), read at the app that reverts.
			const page = await call(reverter, {
				path: `/revisions?filter=${filter}&sort=-id&limit=10&page=1&fields=id,data,delta,activity.action`,
				headers,
			});
			const revisions = (page.json as any).data as { id: number; data: Record<string, unknown> }[];
			const [, chosen, previous] = revisions; // newest first: v3, v2, v1
			const payload = revertPayload(chosen!, previous!);

			const saved = await step(
				reverter,
				{ method: 'PATCH', path: `/items/${POSTS}/${item}`, headers, body: payload },
				`/items/${POSTS}/:pk`,
				{ item },
			);
			const after = await call(ctx, { path: `/items/${POSTS}/${item}`, headers });

			return { payload, saved: saved.step, after: snap(after, `/items/${POSTS}/:pk`, { item }) };
		});

		assertSameTranscripts(transcripts, 'revert across apps');
		expect(transcripts.directus.payload).toEqual({ title: 'v2' });
		expect((transcripts.directus.after.body as any).data).toMatchObject({ title: 'v2', body: 'b3' });
		expect((transcripts.directus.saved.history as any).activity).toEqual([
			expect.objectContaining({ action: 'update' }),
		]);
	});
});

describe('comments and notifications across apps (US4, spec FR-062)', () => {
	it('a comment written at one app is listed, edited and deleted at the other; its notification reads at Directus', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = { ...(await admin()), ...BROWSER };
			const item = (await appRequest(ctx.app, 'POST', `/items/${POSTS}`, { title: 'commented' })).data.id as string;
			const written = await step(
				ctx,
				{ method: 'POST', path: '/comments', headers, body: { collection: POSTS, item, comment: `see @${reader.id}` } },
				'/comments',
				{ item, reader: reader.id },
				(j) => ({ comment: j.data.id }),
			);
			const ids = { item, reader: reader.id, comment: written.json.data.id as string };

			const there: ScenarioContext = { ...ctx, app: other(ctx.app), url: urls()[other(ctx.app)] };
			const listed = await call(there, {
				path: `/comments?filter=${json({ item: { _eq: item } })}&fields=id,comment,user_created.email`,
				headers,
			});
			const edited = await step(
				there,
				{ method: 'PATCH', path: `/comments/${ids.comment}`, headers, body: { comment: 'edited' } },
				'/comments/:pk',
				ids,
			);
			const bell = await call(
				{ ...ctx, app: 'directus', url: urls().directus },
				{
					path: `/notifications?filter=${json({ item: { _eq: item } })}&fields=recipient,subject,collection,item,status`,
					headers: { authorization: `Bearer ${reader.token}` },
				},
			);
			const deleted = await step(
				there,
				{ method: 'DELETE', path: `/comments/${ids.comment}`, headers },
				'/comments/:pk',
				ids,
			);

			return {
				written: written.step,
				listed: snap(listed, '/comments', ids),
				edited: edited.step,
				bell: snap(bell, '/notifications', ids),
				deleted: deleted.step,
			};
		});

		assertSameTranscripts(transcripts, 'comments across apps');
		expect((transcripts.directus.bell.body as any).data).toEqual([
			{
				recipient: '<reader>',
				subject: `You were mentioned in ${POSTS}`,
				collection: POSTS,
				item: '<item>',
				status: 'inbox',
			},
		]);
	});
});
