// Feature 008, US2 (spec FR-036, contracts/versions.md §6): an item read with `?version=` at both apps, the delta
// applied in a rolled back transaction (nested fields, o2m created only for the read) or merged raw (`versionRaw`),
// `main`, a list (the parameter is ignored), a singleton, a missing version and a user who cannot read versions.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { appRequest } from '../directus-api.js';
import { cleanup, createField, createUser, createUserCollection, type TestUser } from '../permissions/fixtures.js';
import { admin, historyCollection, same } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const POSTS = `parity_vr_posts_${run}`;
const LINKS = `parity_vr_links_${run}`;
const AUTHORS = `parity_vr_authors_${run}`;
const SINGLE = `parity_vr_single_${run}`;
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

let item: string;
let reader: TestUser;

beforeAll(async () => {
	await createUserCollection(AUTHORS, [{ field: 'name', type: 'string' }], { primaryKey: 'uuid' });
	await historyCollection(POSTS, { versioning: true }, [
		{ field: 'author', type: 'uuid', meta: { special: ['m2o'], interface: 'select-dropdown-m2o' } },
	]);
	await appRequest('directus', 'POST', '/relations', {
		collection: POSTS,
		field: 'author',
		related_collection: AUTHORS,
	});
	await createField(POSTS, { field: 'links', type: 'alias', meta: { special: ['o2m'], interface: 'list-o2m' } });
	await createUserCollection(
		LINKS,
		[
			{ field: 'url', type: 'string' },
			{ field: 'post', type: 'uuid' },
		],
		{ primaryKey: 'uuid' },
	);
	await appRequest('directus', 'POST', '/relations', {
		collection: LINKS,
		field: 'post',
		related_collection: POSTS,
		meta: { one_field: 'links' },
		schema: { on_delete: 'SET NULL' },
	});
	await historyCollection(SINGLE, { versioning: true }).then(() =>
		appRequest('directus', 'PATCH', `/collections/${SINGLE}`, { meta: { singleton: true } }),
	);

	const author = (await appRequest('directus', 'POST', `/items/${AUTHORS}`, { name: 'Ann' })).data.id;
	item = (
		await appRequest('directus', 'POST', `/items/${POSTS}`, {
			title: 'main',
			author,
			links: [{ url: 'https://a.example' }],
		})
	).data.id;
	const link = (await appRequest('directus', 'GET', `/items/${LINKS}?filter=${json({ post: { _eq: item } })}`)).data[0]
		.id;

	const version = (
		await appRequest('directus', 'POST', '/versions', { key: 'draft', name: null, collection: POSTS, item })
	).data.id;
	await appRequest('directus', 'POST', `/versions/${version}/save`, {
		title: 'draft title',
		author: { name: 'Bo' },
		links: { create: [{ url: 'https://b.example' }], update: [{ id: link, url: 'https://a2.example' }], delete: [] },
	});

	await appRequest('directus', 'PATCH', `/items/${SINGLE}`, { title: 'single main' });
	const singleId = (await appRequest('directus', 'GET', `/items/${SINGLE}`)).data.id;
	const singleVersion = (
		await appRequest('directus', 'POST', '/versions', { key: 'draft', name: null, collection: SINGLE, item: singleId })
	).data.id;
	await appRequest('directus', 'POST', `/versions/${singleVersion}/save`, { title: 'single draft' });

	reader = await createUser('directus', 'vr-reader', { role: null } as any);
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 120_000);

describe('?version= at both apps', () => {
	it('the delta applied: plain, nested m2o created for the read, o2m changed and created', async () => {
		const headers = await admin();
		const deep = json({ links: { _sort: ['url'] } });

		await same({ path: `/items/${POSTS}/${item}?version=draft`, headers });
		await same({
			path: `/items/${POSTS}/${item}?version=draft&fields=id,title,author.name,links.url&deep=${deep}`,
			headers,
		});

		// Rows created only for the read are rolled back: no author "Bo", no link "b" after both reads.
		const authors = await hostDb()(AUTHORS).where({ name: 'Bo' });
		const links = await hostDb()(LINKS).where({ url: 'https://b.example' });
		expect([authors.length, links.length]).toEqual([0, 0]);
	});

	it('versionRaw merges the stored delta into the item', async () => {
		const headers = await admin();

		await same({ path: `/items/${POSTS}/${item}?version=draft&versionRaw`, headers });
		await same({ path: `/items/${POSTS}/${item}?version=draft&versionRaw=true&fields=id,title`, headers });
	});

	it('main, a list, a singleton, a missing version, a user who cannot read the item', async () => {
		const headers = await admin();

		await same({ path: `/items/${POSTS}/${item}?version=main`, headers });
		await same({ path: `/items/${POSTS}?version=draft&filter=${json({ id: { _eq: item } })}`, headers });
		await same({ path: `/items/${SINGLE}?version=draft`, headers });
		await same({ path: `/items/${POSTS}/${item}?version=nope`, headers });
		await same({ path: `/items/${POSTS}/${item}?version=draft`, headers: { authorization: `Bearer ${reader.token}` } });
	});
});
