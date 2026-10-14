// Feature 011, US2 (spec FR-020 to FR-025, contracts/parity.md §2): mutations of user data through /graphql. Each
// group runs as a scenario (Directus, then Backoffice) and compares the responses and the rows each app wrote: the
// data tables, directus_activity and directus_revisions. Ids differ between the two runs and are named per run.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, type ScenarioContext, scenario, send, snapshotOf } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import type { Captured } from '../parity.js';
import { cleanup } from '../permissions/fixtures.js';
import {
	adminJwt,
	comparable,
	createGraphqlModel,
	createGraphqlUsers,
	type GraphqlModel,
	type GraphqlUsers,
	type GqlOptions,
	gqlRequest,
	graphqlEffects,
	sameGql,
	seedGraphqlModel,
} from './helpers.js';

const run = Math.random().toString(16).slice(2, 8);

let m: GraphqlModel;
let users: GraphqlUsers;
let admin: string;
let categories: number[];

beforeAll(async () => {
	m = await createGraphqlModel(`gql_write_${run}`);
	({ categories } = await seedGraphqlModel(m));
	users = await createGraphqlUsers(m, `gql-write-${run}`);
	admin = await adminJwt();
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 300_000);

const mutate = (ctx: ScenarioContext, query: string, options: GqlOptions = {}): Promise<Captured> =>
	send(ctx.url, gqlRequest('items', query, { token: admin, ...options }), ctx.host);

/**
 * Integer ids differ between the two runs, and ids of different tables collide as numbers, so each id is named after
 * its table and its position: `<table#n>` where n counts the rows of that table the scenario knew (`known`) and then
 * those it created. Foreign keys are named through the table they point to, `item` of activity and revision rows
 * through their `collection`, the `id`/`ids` of a step through the table of that step. Seeded rows keep their id.
 */
function transcript(
	steps: Record<string, Captured>,
	rows: Record<string, Record<string, unknown>[]>,
	options: { known?: Record<string, (string | number)[]>; stepTables?: Record<string, string> } = {},
) {
	const short = (table: string) => table.replace(`${m.articles.split('_articles')[0]}_`, '<p>_');
	const foreign: Record<string, string> = {
		category: m.categories,
		article: m.articles,
		articles_id: m.articles,
		tags_id: m.tags,
	};

	const names = new Map<string, Map<string, string>>();

	const register = (table: string, ids: unknown[]) => {
		const map = names.get(table) ?? new Map<string, string>();
		for (const id of ids) if (!map.has(String(id))) map.set(String(id), `<${short(table)}#${map.size}>`);
		names.set(table, map);
	};

	for (const [table, ids] of Object.entries(options.known ?? {})) register(table, ids);
	for (const [table, list] of Object.entries(rows))
		register(
			table,
			list.map((r) => r['id']),
		);

	const name = (table: string | undefined, value: unknown) =>
		(table && value != null && names.get(table)?.get(String(value))) || value;

	/** A row (or the data, delta of a revision) of `table`: its id and foreign keys named. */
	const row = (table: string, value: Record<string, unknown>) =>
		Object.fromEntries(
			Object.entries(value).map(([k, v]) => [k, k === 'id' ? name(table, v) : k in foreign ? name(foreign[k], v) : v]),
		);

	const system = (table: string, value: Record<string, unknown>) => {
		const { ip: _ip, user_agent: _ua, ...rest } = value;
		const collection = rest['collection'] as string;
		const out: Record<string, unknown> = { ...rest, id: name(table, rest['id']), item: name(collection, rest['item']) };
		if ('activity' in rest) out['activity'] = name('directus_activity', rest['activity']);
		if ('parent' in rest) out['parent'] = name('directus_revisions', rest['parent']);

		for (const key of ['data', 'delta']) {
			if (rest[key] && typeof rest[key] === 'object') out[key] = row(collection, rest[key] as Record<string, unknown>);
		}

		return out;
	};

	const step = (table: string, value: unknown, key?: string): unknown => {
		if (Array.isArray(value)) return value.map((v) => step(table, v, key));
		if (value && typeof value === 'object') {
			return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, step(table, v, k)]));
		}

		return key === 'id' || key === 'ids' ? name(table, value) : value;
	};

	const raw = {
		steps: Object.fromEntries(
			Object.entries(steps).map(([k, c]) => [
				k,
				step(options.stepTables?.[k] ?? m.articles, snapshotOf('/graphql', c)),
			]),
		),
		rows: Object.fromEntries(
			Object.entries(rows).map(([table, list]) => [
				short(table),
				list.map((r) =>
					table.startsWith('directus_') || table === 'revisionsOfTheItems'
						? system(table === 'revisionsOfTheItems' ? 'directus_revisions' : table, r)
						: row(table, r),
				),
			]),
		),
	};

	return comparable(raw);
}

describe('create with nested relations (US2.1)', () => {
	// The m2a `item` of an input is a String (the key of the related item), not a nested object, at both apps.
	it('create_<c>_item with a new m2o, o2m and m2m; create_<c>_items; the selection after the mutation', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const tables = [m.articles, m.categories, m.comments, m.articlesTags, m.tags, m.blocks, m.text];

			const { result, rows } = await graphqlEffects(tables, async () => ({
				one: await mutate(
					ctx,
					`mutation { create_${m.articles}_item(data: {
						title: "nested", status: "draft", rating: 2,
						category: { name: "new category" },
						comments: [{ body: "first" }, { body: "second" }],
						tags: [{ tags_id: { label: "fresh" } }]
					}) {
						id title category { name } comments(sort: ["id"]) { body } tags { tags_id { label } }
						blocks { collection }
					} }`,
				),
				many: await mutate(
					ctx,
					`mutation { create_${m.articles}_items(data: [{ title: "m1", rating: 1 }, { title: "m2", rating: 2 }]) { id title rating } }`,
				),
				noSelection: await mutate(ctx, `mutation { create_${m.categories}_item(data: { name: "plain" }) { id } }`),
			}));

			return transcript(result, rows, { stepTables: { noSelection: m.categories } });
		});

		assertSameTranscripts(transcripts, 'create');

		// Same answers, and they are successful ones: the nested rows were written.
		const one = ((transcripts.directus as any).steps.one.body as any).data[`create_${m.articles}_item`];
		expect(one).toMatchObject({ title: 'nested', category: { name: 'new category' } });
		expect(one.comments.map((c: { body: string }) => c.body)).toEqual(['first', 'second']);
		expect(one.tags[0].tags_id.label).toBe('fresh');
	});
});

describe('update and delete (US2.2, US2.3)', () => {
	it('update one, many, batch; delete one, many; the singleton', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const created = await mutate(
				ctx,
				`mutation { create_${m.articles}_items(data: [{ title: "u1" }, { title: "u2" }, { title: "u3" }, { title: "u4" }]) { id } }`,
			);

			const ids = ((created.json as any).data[`create_${m.articles}_items`] as { id: string }[]).map((r) => r.id);

			const { result, rows } = await graphqlEffects([m.articles], async () => ({
				one: await mutate(
					ctx,
					`mutation { update_${m.articles}_item(id: "${ids[0]}", data: { rating: 9 }) { id rating } }`,
				),
				many: await mutate(
					ctx,
					`mutation { update_${m.articles}_items(ids: ["${ids[0]}", "${ids[1]}"], data: { status: "published" }) { id status } }`,
				),
				batch: await mutate(
					ctx,
					`mutation { update_${m.articles}_batch(data: [{ id: "${ids[1]}", title: "b1" }, { id: "${ids[2]}", title: "b2" }]) { id title } }`,
				),
				deleteOne: await mutate(ctx, `mutation { delete_${m.articles}_item(id: "${ids[3]}") { id } }`),
				deleteMany: await mutate(ctx, `mutation { delete_${m.articles}_items(ids: ["${ids[2]}"]) { ids } }`),
				singleton: await mutate(ctx, `mutation { update_${m.settings}(data: { headline: "from gql" }) { headline } }`),
				after: await mutate(
					ctx,
					`{ ${m.articles}(filter: { id: { _in: ${JSON.stringify(ids)} } }, sort: ["id"]) { id title status rating } }`,
				),
			}));

			const revisions = await hostDb()('directus_revisions')
				.select('collection', 'item', 'data', 'delta')
				.where('collection', m.articles)
				.whereIn('item', ids)
				.orderBy('id');

			return transcript(result, { ...rows, revisionsOfTheItems: revisions }, { known: { [m.articles]: ids } });
		});

		assertSameTranscripts(transcripts, 'update and delete');
		expect(((transcripts.directus as any).steps.after.body as any).data[m.articles]).toHaveLength(2);
	});
});

describe('refusals and errors (US2.2, US2.4, US2.5)', () => {
	// Directus 11.17.4 resolveMutation hands `create_<c>_item` (suffix not stripped yet) to getQuery as the collection,
	// so the m2a of the selection is not recognised and every inline fragment is merged into one field list: the read
	// back asks each allowed collection for the fields of the others (FORBIDDEN), at both apps. Reads are not affected.
	it('m2a inline fragments in the selection of a mutation', async () => {
		for (const item of [`... on ${m.text} { body }`, `... on ${m.text} { body } ... on ${m.quote} { author }`]) {
			await sameGql(
				'items',
				`mutation { create_${m.articles}_item(data: { title: "fragments" }) { id blocks { item { ${item} } } } }`,
				{ token: admin },
			);
		}

		await sameGql(
			'items',
			`{ ${m.articles}(sort: ["id"], limit: 1) { blocks { item { ... on ${m.text} { body } } } } }`,
			{
				token: admin,
			},
		);
	});

	it('no permission, a record that is not unique, a wrong type, a mutation over GET', async () => {
		const tokens = { a: users.a.token, b: users.b.token, public: null };

		for (const token of Object.values(tokens)) {
			await sameGql('items', `mutation { create_${m.articles}_item(data: { title: "no" }) { id } }`, { token });
			await sameGql('items', `mutation { delete_${m.articles}_item(id: "1") { id } }`, { token });
		}

		await sameGql(
			'items',
			`mutation { create_${m.categories}_item(data: { id: ${categories[0]}, name: "dup" }) { id } }`,
			{
				token: admin,
			},
		);
		await sameGql('items', `mutation { create_${m.articles}_item(data: { rating: "high" }) { id } }`, { token: admin });
		await sameGql('items', `mutation { update_${m.articles}_item(id: "999999", data: { title: "x" }) { id } }`, {
			token: admin,
		});
		await sameGql('items', `mutation { create_${m.articles}_item(data: { title: "get" }) { id } }`, {
			token: admin,
			method: 'GET',
		});
	});

	it('user B creates a category it may not read: the row is written, the read back is refused', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const { result, rows } = await graphqlEffects([m.categories], async () => ({
				create: await mutate(ctx, `mutation { create_${m.categories}_item(data: { name: "by b" }) { id name } }`, {
					token: users.b.token,
				}),
			}));

			return transcript(result, rows, { stepTables: { create: m.categories } });
		});

		assertSameTranscripts(transcripts, 'create without read');
	});
});

describe('cross use (US2.5)', () => {
	it('a mutation at one app is read at the other app', async () => {
		for (const [writer, reader] of [
			['directus', 'backoffice'],
			['backoffice', 'directus'],
		] as const) {
			const title = `cross ${writer} ${run}`;
			await appRequest(writer, 'POST', '/graphql', {
				query: `mutation { create_${m.articles}_item(data: { title: "${title}" }) { id } }`,
			});

			const read = await appRequest(reader, 'POST', '/graphql', {
				query: `{ ${m.articles}(filter: { title: { _eq: "${title}" } }) { title } }`,
			});

			expect(read.data[m.articles]).toEqual([{ title }]);
		}
	});
});
