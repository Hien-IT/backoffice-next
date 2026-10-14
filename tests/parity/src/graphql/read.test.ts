// Feature 011, US1 (spec FR-010 to FR-016, contracts/parity.md §2): reads of user data through /graphql at both apps,
// compared verbatim. The data model covers m2o, o2m, m2m, m2a and a singleton; each document runs as the admin and,
// where it tells permissions apart, as the users A, B, C of helpers.ts, the public and a share token. One document per
// group is also compared with the REST read of the same query at the new app, as the blackbox files do.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { appRequest, appUrl } from '../directus-api.js';
import { capture } from '../parity.js';
import { attachPolicy, cleanup, CreateRole, createPolicy, createShare, uniqueName } from '../permissions/fixtures.js';
import {
	adminJwt,
	createGraphqlModel,
	createGraphqlUsers,
	type GraphqlModel,
	type GraphqlUsers,
	gql,
	sameGql,
	seedGraphqlModel,
} from './helpers.js';

const run = Math.random().toString(16).slice(2, 8);

let m: GraphqlModel;
let users: GraphqlUsers;
let admin: string;
let articles: number[];
let versionKey: string;

beforeAll(async () => {
	m = await createGraphqlModel(`gql_read_${run}`);
	({ articles } = await seedGraphqlModel(m));
	users = await createGraphqlUsers(m, `gql-read-${run}`);
	admin = await adminJwt();

	// A content version of the first article (feature 008) for <c>_by_version.
	versionKey = `v-${run}`;
	await appRequest('directus', 'POST', '/versions', {
		key: versionKey,
		name: 'draft',
		collection: m.articles,
		item: String(articles[0]),
	});
	const version = (await appRequest('directus', 'GET', `/versions?filter[key][_eq]=${versionKey}`)).data[0];
	await appRequest('directus', 'POST', `/versions/${version.id}/save`, { title: 'alpha (draft)' });
}, 300_000);

afterAll(async () => {
	await appRequest('directus', 'DELETE', '/versions', { query: { filter: { key: { _eq: versionKey } } } }).catch(
		() => {},
	);
	await cleanup();
	await closeHostDb();
}, 300_000);

describe('lists, filters, sort, pagination, search (US1.1)', () => {
	it('every filter operator family, _and, _or, through relations, _some, _none, functions', async () => {
		const filters = [
			'{ title: { _eq: "alpha" } }',
			'{ title: { _neq: "alpha" } }',
			'{ rating: { _lt: 4 } }',
			'{ rating: { _lte: 4, _gte: 3 } }',
			'{ rating: { _gt: 3 } }',
			'{ rating: { _in: [1, 5] } }',
			'{ rating: { _nin: [1, 5] } }',
			'{ rating: { _null: true } }',
			'{ price: { _nnull: true } }',
			'{ rating: { _between: [2, 4] } }',
			'{ rating: { _nbetween: [2, 4] } }',
			'{ title: { _contains: "lph" } }',
			'{ title: { _icontains: "LPH" } }',
			'{ title: { _ncontains: "a" } }',
			'{ title: { _starts_with: "al" } }',
			'{ title: { _istarts_with: "AL" } }',
			'{ title: { _nstarts_with: "al" } }',
			'{ title: { _ends_with: "ta" } }',
			'{ title: { _iends_with: "TA" } }',
			'{ title: { _nends_with: "ta" } }',
			'{ title: { _empty: false } }',
			'{ featured: { _eq: true } }',
			'{ published_on: { _gte: "2026-01-01T00:00:00" } }',
			'{ published_on_func: { year: { _eq: 2026 } } }',
			'{ _and: [{ status: { _eq: "published" } }, { rating: { _gte: 5 } }] }',
			'{ _or: [{ status: { _eq: "archived" } }, { title: { _eq: "beta" } }] }',
			'{ category: { name: { _eq: "tech" } } }',
			'{ comments: { _some: { body: { _eq: "c0-1" } } } }',
			'{ comments: { _none: { body: { _starts_with: "c" } } } }',
			'{ tags: { tags_id: { label: { _eq: "b" } } } }',
			'{ comments_func: { count: { _gt: 1 } } }',
		];

		for (const filter of filters) {
			await sameGql('items', `{ ${m.articles}(filter: ${filter}, sort: ["id"]) { id title } }`, { token: admin });
		}
	});

	it('sort on several fields and through a relation, limit, offset, page, search', async () => {
		for (const args of [
			'sort: ["-rating", "title"]',
			'sort: ["category.name", "-id"]',
			'sort: ["id"], limit: 2',
			'sort: ["id"], limit: 2, offset: 1',
			'sort: ["id"], limit: 2, page: 2',
			'sort: ["id"], limit: -1',
			'search: "alp"',
			'search: "5"',
		]) {
			await sameGql('items', `{ ${m.articles}(${args}) { id title rating } }`, { token: admin });
		}
	});

	it('nested relations with their own arguments, scalars of every kind (ids as strings, dates, json, csv)', async () => {
		const document = `{
			${m.articles}(sort: ["id"]) {
				id title status rating price published_on featured details keywords
				published_on_func { year month week day weekday hour minute second }
				category { id name }
				comments(sort: ["-id"], limit: 1) { id body article { id } }
				comments_func { count }
				tags(filter: { tags_id: { label: { _neq: "c" } } }) { id tags_id { id label } }
				blocks { id collection item { __typename ... on ${m.text} { id body } ... on ${m.quote} { id author } } }
			}
		}`;

		const result = await sameGql('items', document, { token: admin });
		const rows = (result.backoffice.json as any).data[m.articles];
		expect(rows).toHaveLength(5);
		expect(typeof rows[0].id).toBe('string');

		// Same data as REST at the new app (blackbox style).
		const rest = await capture(appUrl('backoffice'), {
			path: `/items/${m.articles}?sort=id&fields=id,title,category.name`,
			headers: { authorization: `Bearer ${admin}` },
		});

		expect(rows.map((r: any) => [r.id, r.title, r.category?.name ?? null])).toEqual(
			(rest.json as any).data.map((r: any) => [String(r.id), r.title, r.category?.name ?? null]),
		);
	});
});

describe('one item, versions, singleton (US1.2)', () => {
	it('<c>_by_id, with and without version; a missing id; <c>_by_version; the singleton', async () => {
		const id = String(articles[0]);

		await sameGql('items', `{ ${m.articles}_by_id(id: "${id}") { id title category { name } } }`, { token: admin });
		await sameGql('items', `{ ${m.articles}_by_id(id: "${id}", version: "${versionKey}") { id title } }`, {
			token: admin,
		});
		await sameGql('items', `{ ${m.articles}_by_id(id: "999999") { id } }`, { token: admin });
		await sameGql('items', `{ ${m.articles}_by_version(version: "${versionKey}", id: "${id}") { id title } }`, {
			token: admin,
		});
		await sameGql('items', `{ ${m.articles}_by_version(version: "nope", id: "${id}") { id } }`, { token: admin });
		await sameGql('items', `{ ${m.settings} { id headline } }`, { token: admin });
		await sameGql('items', `{ ${m.settings}_by_version(version: "nope") { headline } }`, { token: admin });
	});
});

describe('aggregates (US1.3)', () => {
	it('every function, groupBy, filter, sort, limit, date functions in groupBy', async () => {
		for (const document of [
			`{ ${m.articles}_aggregated { count { id rating } countDistinct { status } countAll } }`,
			`{ ${m.articles}_aggregated { sum { rating price } sumDistinct { rating } avg { rating } avgDistinct { rating } } }`,
			`{ ${m.articles}_aggregated { min { rating published_on } max { rating published_on } } }`,
			`{ ${m.articles}_aggregated(groupBy: ["status"], sort: ["status"]) { group count { id } } }`,
			`{ ${m.articles}_aggregated(groupBy: ["category"], filter: { rating: { _gte: 3 } }, sort: ["category"], limit: 2) { group countAll } }`,
			`{ ${m.articles}_aggregated(groupBy: ["year(published_on)"]) { group count { id } } }`,
			`{ ${m.comments}_aggregated(groupBy: ["article"], sort: ["article"]) { group count { id } } }`,
		]) {
			await sameGql('items', document, { token: admin });
		}
	});
});

describe('permissions (US1.4)', () => {
	it('users A, B, C and the public: fields, rows and collections they may read; validation errors otherwise', async () => {
		const tokens = { a: users.a.token, b: users.b.token, c: users.c.token, public: null };

		for (const token of Object.values(tokens)) {
			await sameGql('items', `{ ${m.articles}(sort: ["id"]) { id title } }`, { token });
			await sameGql('items', `{ ${m.articles}(sort: ["id"]) { id rating } }`, { token });
			await sameGql('items', `{ ${m.articles}_by_id(id: "${articles[1]}") { id title } }`, { token });
			await sameGql('items', `{ ${m.categories} { id name } }`, { token });
			await sameGql('items', `{ ${m.tags} { id label } }`, { token });
			await sameGql('items', `{ ${m.articles}(sort: ["id"]) { id category { name } } }`, { token });
		}
	});

	it('a share token: the shared item and its allowed relations, another item refused (FR-040)', async () => {
		const role = await CreateRole('directus', { name: uniqueName(`gql-share-${run}`) });
		const policy = await createPolicy('directus', `gql-share-${run}`, {
			permissions: [
				{ collection: m.articles, action: 'read', fields: ['*'] },
				{ collection: m.categories, action: 'read', fields: ['*'] },
			],
		});
		await attachPolicy('directus', policy, { role: role.id });

		const share = await createShare(m.articles, articles[0]!, { role: role.id });
		const login = await capture(appUrl('directus'), { method: 'POST', path: '/shares/auth', body: { share } });
		const token = (login.json as any).data.access_token as string;

		await sameGql('items', `{ ${m.articles}_by_id(id: "${articles[0]}") { id title category { name } } }`, { token });
		await sameGql('items', `{ ${m.articles}_by_id(id: "${articles[1]}") { id title } }`, { token });
		await sameGql('items', `{ ${m.articles}(sort: ["id"]) { id } }`, { token });
	});
});

describe('documents (US1.5, US1.6)', () => {
	it('aliases, fragments, inline fragments, __typename, variables, operationName', async () => {
		const id = String(articles[0]);

		await sameGql(
			'items',
			`{ first: ${m.articles}_by_id(id: "${id}") { name: title } all: ${m.articles}(sort: ["id"], limit: 2) { id __typename } }`,
			{ token: admin },
		);

		await sameGql(
			'items',
			`fragment A on ${m.articles} { id title category { ...C } } fragment C on ${m.categories} { name }
			 query { ${m.articles}(sort: ["id"]) { ...A } }`,
			{ token: admin },
		);

		await sameGql(
			'items',
			`query Q($id: ID!, $limit: Int) { ${m.articles}_by_id(id: $id) { id } ${m.comments}(limit: $limit, sort: ["id"]) { id } }`,
			{ token: admin, variables: { id, limit: 1 } },
		);

		const two = `query One { ${m.articles}(limit: 1, sort: ["id"]) { id } } query Two { ${m.categories}(sort: ["id"]) { name } }`;
		await sameGql('items', two, { token: admin, operationName: 'Two' });
		await sameGql('items', two, { token: admin });
		await sameGql('items', two, { token: admin, operationName: 'Three' });
	});

	it('GET gives the result of POST; variables from the query string', async () => {
		const document = `query Q($n: Int) { ${m.articles}(sort: ["id"], limit: $n) { id title } }`;

		const get = await sameGql('items', document, { token: admin, method: 'GET', variables: { n: 2 } });
		const post = await gql('backoffice', 'items', document, { token: admin, variables: { n: 2 } });
		expect(get.backoffice.json).toEqual(post.json);
	});
});
