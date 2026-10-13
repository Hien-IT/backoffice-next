// Feature 008, US1 (spec FR-010, FR-012, FR-013, FR-060): /revisions read at both apps with the queries of the
// revisions sidebar of the Directus app (directus/app/src/composables/use-revisions.ts), and the revisions of nested
// writes (parent) each app writes for the same request.
import { afterAll, beforeAll, describe, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { cleanup, createField, createUser, createUserCollection, type TestUser } from '../permissions/fixtures.js';
import { admin, BROWSER, historyCollection, same, step } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const POSTS = `parity_rev_posts_${run}`;
const LINKS = `parity_rev_links_${run}`;
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const full = process.env['PARITY_SUITE'] !== 'reduced';

let item: string;
let apiUser: TestUser;

beforeAll(async () => {
	await historyCollection(POSTS);
	await createField(POSTS, { field: 'links', type: 'alias', meta: { special: ['o2m'], interface: 'list-o2m' } });
	await createUserCollection(
		LINKS,
		[
			{ field: 'url', type: 'string' },
			{ field: 'post', type: 'uuid' },
		],
		{ primaryKey: 'uuid', meta: { accountability: 'all' } },
	);
	await appRequest('directus', 'POST', '/relations', {
		collection: LINKS,
		field: 'post',
		related_collection: POSTS,
		meta: { one_field: 'links' },
		schema: { on_delete: 'SET NULL' },
	});

	// One item with revisions written by both apps: created at Directus, changed at Backoffice, then at Directus.
	item = (await appRequest('directus', 'POST', `/items/${POSTS}`, { title: 'a' })).data.id;
	await appRequest('backoffice', 'PATCH', `/items/${POSTS}/${item}`, { title: 'b' });
	await appRequest('directus', 'PATCH', `/items/${POSTS}/${item}`, { title: 'c' });

	apiUser = await createUser('directus', 'rev-api');
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 120_000);

const itemFilter = () => ({
	_and: [{ collection: { _eq: POSTS } }, { item: { _eq: item } }, { version: { _null: true } }],
});

const SIDEBAR_FIELDS = [
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

describe('the queries of the revisions sidebar (US1.3, US1.4)', () => {
	it('count, a page, the full page and the created revision', async () => {
		const headers = await admin();
		const filter = json(itemFilter());

		await same({ path: `/revisions?filter=${filter}&aggregate[count]=id`, headers });
		await same({
			path: `/revisions?filter=${filter}&sort=-id&limit=10&page=1&fields=${SIDEBAR_FIELDS.join(',')}`,
			headers,
		});
		await same({
			path: `/revisions?filter=${filter}&sort=-id&limit=10&page=1&fields=${[...SIDEBAR_FIELDS, 'data', 'delta'].join(',')}`,
			headers,
		});

		const created = json({
			collection: { _eq: POSTS },
			item: { _eq: item },
			version: { _null: true },
			activity: { action: { _eq: 'create' } },
		});

		await same({ path: `/revisions?filter=${created}&sort=-id&limit=1&fields=id`, headers });
	});

	it('SEARCH, GET /:pk, a revision that does not exist, a user without access, OPTIONS and HEAD', async () => {
		const headers = await admin();
		const { data } = await appRequest('directus', 'GET', `/revisions?filter=${json(itemFilter())}&sort=id&fields=id`);

		await same({
			method: 'SEARCH',
			path: '/revisions',
			headers,
			body: { query: { filter: itemFilter(), sort: ['id'] } },
		});
		await same({ method: 'SEARCH', path: '/revisions', headers, body: { keys: [data[0].id] } });
		await same({ path: `/revisions/${data[1].id}?fields=*,activity.*`, headers });
		await same({ path: '/revisions/2147483000', headers });
		await same({
			path: `/revisions?filter=${json(itemFilter())}`,
			headers: { authorization: `Bearer ${apiUser.token}` },
		});
		await same({ path: `/revisions?filter=${json(itemFilter())}` });

		for (const path of ['/revisions', `/revisions/${data[0].id}`]) await same({ method: 'OPTIONS', path });
		await same({ method: 'HEAD', path: `/revisions?filter=${json(itemFilter())}`, headers });
	});
});

describe('revisions of a nested write (spec FR-010 parent)', () => {
	it.runIf(full)('a post created with two links: the link revisions point to the post revision', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const path = `/items/${POSTS}`;

			const created = await step(
				ctx,
				{
					method: 'POST',
					// The links come back in primary key order (random uuids): sort them by url.
					path: `${path}?fields=id,links.id,links.url&deep=${json({ links: { _sort: ['url'] } })}`,
					headers: { ...(await admin()), ...BROWSER },
					body: { title: 'nested', links: [{ url: 'https://a.example' }, { url: 'https://b.example' }] },
				},
				path,
				{},
				(j) => {
					const links = [...j.data.links].sort((x: any, y: any) => x.url.localeCompare(y.url));
					return { post: j.data.id, linkA: links[0].id, linkB: links[1].id };
				},
			);

			return created.step;
		});

		assertSameTranscripts(transcripts, 'nested create');
	});
});
