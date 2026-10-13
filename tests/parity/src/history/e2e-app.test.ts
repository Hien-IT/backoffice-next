// Feature 008 (spec FR-063, research R6): the requests the Directus app sends for the history screens, in the order it
// sends them, compared at both apps (the Playwright file history.spec.ts drives the screens themselves). Revisions
// sidebar and comparison (use-revisions.ts, use-comparison.ts, revisions-sidebar-detail.vue).
import { afterAll, beforeAll, describe, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { appRequest } from '../directus-api.js';
import { cleanup } from '../permissions/fixtures.js';
import { admin, historyCollection, same } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const POSTS = `parity_e2e_posts_${run}`;
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

let item: string;
let revisions: { id: number }[];

beforeAll(async () => {
	await historyCollection(POSTS, { versioning: true });
	item = (await appRequest('directus', 'POST', `/items/${POSTS}`, { title: 'one' })).data.id;
	await appRequest('backoffice', 'PATCH', `/items/${POSTS}/${item}`, { title: 'two' });
	await appRequest('backoffice', 'DELETE', `/items/${POSTS}/${item}`);
	item = (await appRequest('backoffice', 'POST', `/items/${POSTS}`, { title: 'three' })).data.id;
	await appRequest('directus', 'PATCH', `/items/${POSTS}/${item}`, { title: 'four' });
	revisions = (
		await appRequest('directus', 'GET', `/revisions?filter=${json({ item: { _eq: item } })}&sort=-id&fields=id`)
	).data;
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 120_000);

const itemFilter = () => ({
	_and: [{ collection: { _eq: POSTS } }, { item: { _eq: item } }, { version: { _null: true } }],
});

describe('revisions sidebar and comparison (US3.2, US3.3)', () => {
	it('count, page, created, then the comparison of a revision with the one before and the main item', async () => {
		const headers = await admin();
		const sidebar = [
			'id',
			'collection',
			'item',
			'activity.action',
			'activity.timestamp',
			'activity.user.id',
			'activity.user.email',
			'activity.user.first_name',
			'activity.user.last_name',
			'activity.ip',
			'activity.user_agent',
			'activity.origin',
		];

		await same({ path: `/revisions?filter=${json(itemFilter())}&aggregate[count]=id`, headers });
		await same({
			path: `/revisions?filter=${json(itemFilter())}&sort=-id&limit=10&page=1&fields=${[...sidebar, 'data', 'delta'].join(',')}`,
			headers,
		});
		await same({
			path: `/revisions?filter=${json({ collection: { _eq: POSTS }, item: { _eq: item }, version: { _null: true }, activity: { action: { _eq: 'create' } } })}&sort=-id&limit=1&fields=id`,
			headers,
		});

		// use-comparison.ts: the latest revision of the main version, the main item, the user of the revision.
		const latest = [
			'activity.timestamp',
			'activity.user.id',
			'activity.user.email',
			'activity.user.first_name',
			'activity.user.last_name',
		];
		await same({
			path: `/revisions?filter=${json(itemFilter())}&sort=-id&limit=1&fields=${latest.join(',')}`,
			headers,
		});
		await same({ path: `/items/${POSTS}/${item}`, headers });
		await same({ path: `/revisions/${revisions[0]!.id}?fields=*,activity.*`, headers });
	});

	it('the revisions of a deleted item and of an item with an action filter', async () => {
		const headers = await admin();
		const deleted = json({ _and: [{ collection: { _eq: POSTS } }, { activity: { action: { _eq: 'delete' } } }] });

		await same({ path: `/revisions?filter=${deleted}&fields=id,data,delta,activity.action`, headers });
		await same({
			path: `/activity?filter=${json({ collection: { _eq: POSTS }, action: { _eq: 'delete' } })}&fields=id,action,revisions.id`,
			headers,
		});
	});
});
