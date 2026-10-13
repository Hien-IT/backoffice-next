// Feature 005, US1 (FR-001 to FR-006, contracts/items-api.md): every route of /items/:collection, nested o2m writes,
// batches (empty ones included), the singleton routes, the collections that do not answer, errors, OPTIONS and HEAD.
// Write flows run the same steps at each app with that app's own items (scenario()); reads that change nothing go
// to both apps at once (parity()).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario, send } from '../auth/scenario.js';
import { adminToken, appRequest } from '../directus-api.js';
import { assertParity, parity } from '../parity.js';
import {
	attachPolicy,
	cleanup,
	createField,
	createPolicy,
	createUser,
	createUserCollection,
} from '../permissions/fixtures.js';
import { type Flow, startFlow } from '../permissions/flow.js';

const run = Math.random().toString(16).slice(2, 10);
const ARTICLES = `parity_items_${run}`;
const TAGS = `parity_items_tags_${run}`;
const SINGLETON = { directus: `parity_items_s_dir_${run}`, backoffice: `parity_items_s_bac_${run}` };

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

beforeAll(async () => {
	await createUserCollection(
		ARTICLES,
		[
			{ field: 'title', type: 'string' },
			{ field: 'status', type: 'string', schema: { default_value: 'draft' } },
		],
		{ primaryKey: 'uuid' },
	);
	await createField(ARTICLES, { field: 'tags', type: 'alias', meta: { special: ['o2m'], interface: 'list-o2m' } });
	await createUserCollection(
		TAGS,
		[
			{ field: 'tag', type: 'string' },
			{ field: 'article', type: 'uuid' },
		],
		{ primaryKey: 'uuid' },
	);
	await appRequest('directus', 'POST', '/relations', {
		collection: TAGS,
		field: 'article',
		related_collection: ARTICLES,
		meta: { one_field: 'tags' },
		schema: { on_delete: 'SET NULL' },
	});

	for (const name of Object.values(SINGLETON)) {
		await createUserCollection(name, [{ field: 'headline', type: 'string', schema: { default_value: 'Welcome' } }], {
			meta: { singleton: true },
		});
	}
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 300_000);

/** The names of each app's items and singleton differ by the app; give both transcripts the same ones. */
function sameNames<T extends Record<string, unknown>>(transcripts: T, prefix: string): T {
	return Object.fromEntries(
		Object.entries(transcripts).map(([app, t]) => [
			app,
			JSON.parse(
				JSON.stringify(t)
					.split(`${prefix}-${app}`)
					.join(`${prefix}-<app>`)
					.split(SINGLETON[app as keyof typeof SINGLETON])
					.join('<singleton>'),
			),
		]),
	) as T;
}

/** Labels the ids of the articles and tags whose title or tag starts with `name`, in that order. */
async function labelRows(flow: Flow, name: string): Promise<void> {
	for (const [table, column] of [
		[ARTICLES, 'title'],
		[TAGS, 'tag'],
	] as const) {
		const rows = await hostDb().select('id', column).from(table).where(column, 'like', `${name}%`).orderBy(column);
		for (const row of rows) flow.name(row.id, `${table === ARTICLES ? 'article' : 'tag'}:${row[column]}`);
	}
}

async function recordRows(flow: Flow, name: string): Promise<void> {
	await flow.rows(ARTICLES, (q) => q.where('title', 'like', `${name}%`), { orderBy: 'title' });
	await flow.rows(TAGS, (q) => q.where('tag', 'like', `${name}%`), { orderBy: 'tag' });
	await flow.activity([ARTICLES, TAGS]);
}

describe('/items CRUD (US1.1 to US1.3)', () => {
	it('POST one with nested o2m and many; GET, SEARCH (keys and query), GET /:pk', async () => {
		const prefix = `parity-items-read-${run}`;

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const deep = `deep[tags][_sort]=tag`;

			const one = await flow.req('POST', `/items/${ARTICLES}?fields=id,title,status,tags.tag&${deep}`, {
				title: `${name}-a`,
				tags: [{ tag: `${name}-t2` }, { tag: `${name}-t1` }],
			});
			const id = (one.json as any).data.id as string;

			await flow.req('POST', `/items/${ARTICLES}?fields=title,status&sort=title`, [
				{ title: `${name}-c`, status: 'published' },
				{ title: `${name}-b` },
			]);

			const filter = json({ title: { _starts_with: name } });
			await flow.req(
				'GET',
				`/items/${ARTICLES}?filter=${filter}&fields=*,tags.*&sort=-title&meta=filter_count&${deep}`,
			);
			// Without a sort, o2m rows follow their random uuid keys: sort them like the other reads.
			await flow.req('SEARCH', `/items/${ARTICLES}`, {
				keys: [id],
				query: { fields: ['title', 'tags.tag'], deep: { tags: { _sort: ['tag'] } } },
			});
			await flow.req('SEARCH', `/items/${ARTICLES}`, {
				query: { filter: { title: { _starts_with: name } }, fields: ['title'], sort: ['title'], limit: 2 },
			});
			await flow.req('GET', `/items/${ARTICLES}/${id}?fields=title,tags.tag,tags.article.title&${deep}`);

			await labelRows(flow, name);
			await recordRows(flow, name);
			return flow.transcript();
		});

		assertSameTranscripts(sameNames(transcripts, prefix), 'items create and read');
	});

	it('PATCH by array, keys, query and /:pk; DELETE by array, keys, query and /:pk; empty batches', async () => {
		const prefix = `parity-items-write-${run}`;

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;

			const created = await flow.req(
				'POST',
				`/items/${ARTICLES}?fields=id&sort=title`,
				['1', '2', '3', '4', '5'].map((n) => ({ title: `${name}-${n}` })),
			);
			const ids = ((created.json as any).data as { id: string }[]).map((row) => row.id);
			const patch = (body: Record<string, unknown> | unknown[]) =>
				flow.req('PATCH', `/items/${ARTICLES}?fields=title,status&sort=title`, body);

			await patch([{ id: ids[0], status: 'one' }]);
			await patch({ keys: [ids[1]], data: { status: 'two' } });
			await patch({ query: { filter: { title: { _eq: `${name}-3` } } }, data: { status: 'three' } });
			await flow.req('PATCH', `/items/${ARTICLES}/${ids[3]}?fields=title,status`, { status: 'four' });

			// Empty batches (spec Edge Cases): nothing written, empty data or 204.
			await patch([]);
			await patch({ keys: [], data: { status: 'none' } });
			await patch({ query: { filter: { title: { _eq: `${name}-none` } } }, data: { status: 'none' } });

			await flow.req('DELETE', `/items/${ARTICLES}`, [ids[0]]);
			await flow.req('DELETE', `/items/${ARTICLES}`, { keys: [ids[1]] });
			await flow.req('DELETE', `/items/${ARTICLES}`, { query: { filter: { title: { _eq: `${name}-3` } } } });
			await flow.req('DELETE', `/items/${ARTICLES}/${ids[3]}`);
			await flow.req('DELETE', `/items/${ARTICLES}`, []);
			await flow.req('DELETE', `/items/${ARTICLES}`, { keys: [] });
			await flow.req('DELETE', `/items/${ARTICLES}`, { query: { filter: { title: { _eq: `${name}-none` } } } });

			ids.forEach((id, i) => flow.name(id, `article:${i + 1}`));
			await recordRows(flow, name);
			return flow.transcript();
		});

		assertSameTranscripts(sameNames(transcripts, prefix), 'items update and delete');
	});
});

describe('singleton (US1.4)', () => {
	it('GET defaults and meta, PATCH creates then updates, POST and PATCH /:pk 404, GET and DELETE /:pk', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const singleton = SINGLETON[ctx.app];

			await flow.req('GET', `/items/${singleton}`);
			await flow.req('GET', `/items/${singleton}?meta=*`);
			await flow.req('PATCH', `/items/${singleton}?fields=headline`, { headline: 'Hello' });
			await flow.req('PATCH', `/items/${singleton}`, { headline: 'Again' });
			await flow.req('POST', `/items/${singleton}`, { headline: 'x' });
			await flow.req('PATCH', `/items/${singleton}/1`, { headline: 'x' });
			await flow.req('GET', `/items/${singleton}/1?fields=headline`);
			await flow.req('SEARCH', `/items/${singleton}`, { query: { fields: ['headline'] } });

			await flow.rows(singleton, (q) => q);
			await flow.activity([singleton]);
			return flow.transcript();
		});

		assertSameTranscripts(sameNames(transcripts, 'unused'), 'singleton');
	});
});

describe('create without read permission (US1.6)', () => {
	it('204 without body, the item written', async () => {
		const prefix = `parity-items-noread-${run}`;

		const transcripts = await scenario(urls(), async (ctx) => {
			const user = await createUser(ctx.app, `${prefix}-${ctx.app}`);
			const policy = await createPolicy(ctx.app, prefix, {
				permissions: [{ collection: ARTICLES, action: 'create', fields: ['*'] }],
			});
			await attachPolicy(ctx.app, policy, { user: user.id });

			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			await flow.req('POST', `/items/${ARTICLES}`, { title: name }, { authorization: `Bearer ${user.token}` });
			await flow.req('GET', `/items/${ARTICLES}?fields=title`, undefined, { authorization: `Bearer ${user.token}` });

			await labelRows(flow, name);
			await flow.rows(ARTICLES, (q) => q.where('title', name), { columns: ['title', 'status'] });
			return flow.transcript();
		});

		assertSameTranscripts(sameNames(transcripts, prefix), 'create without read');
	});
});

describe('requests that change nothing (US1.5, US1.7, FR-005)', () => {
	let admin: string;
	let id: string;

	beforeAll(async () => {
		admin = `Bearer ${await adminToken('directus')}`;
		id = (await appRequest('directus', 'POST', `/items/${ARTICLES}`, { title: `parity-items-fixed-${run}` })).data.id;
	}, 60_000);

	const check = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
		assertParity(
			await parity({
				method,
				path,
				...(body === undefined ? {} : { body: body as any }),
				headers: { authorization: admin, ...headers },
			}),
		);

	it('unknown and system collections at every route', async () => {
		for (const collection of ['parity_items_nope', 'directus_users', 'Parity_Items_Nope']) {
			await check('GET', `/items/${collection}`);
			await check('GET', `/items/${collection}/1`);
			await check('POST', `/items/${collection}`, {});
			await check('SEARCH', `/items/${collection}`, {});
			await check('PATCH', `/items/${collection}`, {});
			await check('PATCH', `/items/${collection}`, { keys: ['1'], data: {} });
			await check('PATCH', `/items/${collection}/1`, {});
			await check('DELETE', `/items/${collection}`, {});
			await check('DELETE', `/items/${collection}/1`);
		}
	});

	it('errors in the order of Directus: query, body, key type, token', async () => {
		await check('GET', `/items/${ARTICLES}?limit=abc`);
		await check('GET', `/items/${ARTICLES}?filter={bad`);
		await check('GET', `/items/${ARTICLES}?export=pdf`);
		await check('GET', `/items/parity_items_nope?export=pdf`);
		await check('PATCH', `/items/${ARTICLES}`, { data: { title: 'x' } });
		await check('DELETE', `/items/${ARTICLES}`, {});
		await check('SEARCH', `/items/${ARTICLES}`, { keys: [id], other: 1 });
		await check('GET', `/items/${ARTICLES}/not-a-uuid`);
		await check('GET', `/items/${ARTICLES}`, undefined, { authorization: 'Bearer invalid-token' });
		await check('GET', `/items/%E0%A4%A`);
	});

	it('reads: list, SEARCH without body, GET /:pk, version=main and a list with version', async () => {
		await check('GET', `/items/${ARTICLES}/${id}?fields=title,status`);
		await check('SEARCH', `/items/${ARTICLES}?fields=title&filter=${json({ id: { _eq: id } })}`);
		await check('GET', `/items/${ARTICLES}/${id}?fields=title&version=main`);
		await check('GET', `/items/${ARTICLES}?fields=title&filter=${json({ id: { _eq: id } })}&version=nope`);
		await check('GET', `/items/${ARTICLES}`, undefined, {});
	});

	it('OPTIONS, HEAD, trailing slash and paths without a route', async () => {
		for (const path of [`/items/${ARTICLES}`, `/items/${ARTICLES}/`, `/items/${ARTICLES}/${id}`, '/items/nope/1/']) {
			await check('OPTIONS', path);
		}

		await check('HEAD', `/items/${ARTICLES}/${id}`);
		await check('GET', `/items/${ARTICLES}/${id}/?fields=title`);
		await check('GET', '/items');
		await check('GET', '/items/');
		await check('GET', `/items/${ARTICLES}/${id}/x`);
	});

	// Feature 008 (spec FR-036): a version that does not exist is Forbidden at both apps.
	it('version other than main on GET /:pk that does not exist: 403 at both apps', async () => {
		const path = `/items/${ARTICLES}/${id}?version=nope`;
		const host = new URL(urls().directus).host;
		const directus = await send(urls().directus, { path, headers: { authorization: admin } }, host);
		const backoffice = await send(urls().backoffice, { path, headers: { authorization: admin } }, host);

		expect([directus.status, (directus.json as any).errors[0].extensions.code]).toEqual([403, 'FORBIDDEN']);
		expect([backoffice.status, backoffice.json]).toEqual([directus.status, directus.json]);
	});
});
