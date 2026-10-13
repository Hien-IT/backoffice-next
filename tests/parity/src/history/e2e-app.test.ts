// Feature 008 (spec FR-063, research R6): the requests the Directus app sends for the history screens, in the order it
// sends them, compared at both apps (the Playwright file history.spec.ts drives the screens themselves): revisions
// sidebar and comparison (use-revisions.ts, use-comparison.ts), comments sidebar (comments-sidebar-detail.vue,
// comment-input.vue), version menu (use-versions.ts, version-menu.vue, comparison-modal.vue), activity module.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { appRequest } from '../directus-api.js';
import { cleanup, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, historyCollection, same } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const POSTS = `parity_e2e_posts_${run}`;
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

let item: string;
let revisions: { id: number }[];
let mentioned: TestUser;

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
	mentioned = await createUser('directus', 'e2e-mentioned', { first_name: 'Bo' } as any);
	await appRequest('directus', 'POST', '/comments', { collection: POSTS, item, comment: `hello @${mentioned.id}` });
	await appRequest('backoffice', 'POST', '/comments', { collection: POSTS, item, comment: 'second' });
	const version = (
		await appRequest('backoffice', 'POST', '/versions', { key: 'draft', name: 'Draft', collection: POSTS, item })
	).data.id;
	await appRequest('directus', 'POST', `/versions/${version}/save`, { title: 'draft title' });
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

describe('comments sidebar (US4.4)', () => {
	it('the list with its users, the user previews of mentions, the count, the user search of a mention', async () => {
		const headers = await admin();
		const fields = [
			'id',
			'comment',
			'date_created',
			'user_created.id',
			'user_created.email',
			'user_created.first_name',
			'user_created.last_name',
			'user_created.avatar.id',
			'user_created.avatar.modified_on',
		];

		await same({
			path: `/comments?filter[collection][_eq]=${POSTS}&filter[item][_eq]=${item}&sort=-date_created&fields=${fields.join(',')}`,
			headers,
		});
		await same({
			path: `/users?filter=${json({ id: { _in: [mentioned.id] } })}&fields=first_name,last_name,email,id`,
			headers,
		});
		await same({
			path: `/comments?filter=${json({ _and: [{ collection: { _eq: POSTS } }, { item: { _eq: item } }] })}&aggregate[count]=id`,
			headers,
		});
		await same({
			path: `/users?filter=${json({ _or: [{ first_name: { _starts_with: 'Bo' } }] })}&fields=first_name,last_name,email,id,avatar.id,avatar.modified_on&limit=10`,
			headers,
		});
	});
});

describe('version menu (US2)', () => {
	it('the versions of the item, the draft read, the comparison', async () => {
		const headers = await admin();
		const filter = json({ _and: [{ collection: { _eq: POSTS } }, { item: { _eq: item } }] });

		const list = await same({ path: `/versions?filter=${filter}&sort=-date_created&fields=*`, headers });
		const version = (list.directus.json as any).data[0].id;

		await same({ path: `/items/${POSTS}/${item}?version=draft`, headers });
		await same({ path: `/versions/${version}/compare`, headers });
		await same({
			path: `/revisions?filter=${json({ _and: [{ collection: { _eq: POSTS } }, { item: { _eq: item } }, { version: { _eq: version } }] })}&aggregate[count]=id`,
			headers,
		});
	});
});

describe('activity module (US1.3)', () => {
	it('the list of the tabular layout and the detail drawer', async () => {
		const headers = await admin();
		const { data } = await appRequest(
			'directus',
			'GET',
			`/activity?filter=${json({ collection: { _eq: POSTS } })}&sort=-timestamp&fields=id`,
		);
		expect(data.length).toBeGreaterThan(0);

		await same({
			path: `/activity?filter=${json({ collection: { _eq: POSTS } })}&sort=-timestamp&limit=25&page=1&fields=id,action,collection,item,timestamp,user.first_name,user.last_name,user.email&meta=filter_count,total_count`,
			headers,
		});
		const fields = [
			'user.id',
			'user.email',
			'user.first_name',
			'user.last_name',
			'action',
			'timestamp',
			'ip',
			'user_agent',
			'origin',
			'collection',
			'item',
		];
		await same({ path: `/activity/${data[0].id}?fields=${fields.join(',')}`, headers });
	});
});
