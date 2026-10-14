// Feature 011 (spec FR-063, contracts/parity.md §2): the GraphQL requests the Directus app sends, at both apps.
// stores/insights.ts merges the queries of every panel of a dashboard into one /graphql and one /graphql/system request,
// each query aliased `query_<hash>` (queryToGqlString); a misconfigured panel makes the whole request a 400 whose
// error path names the alias, which the app uses to retry without that panel. composables/use-item saveAsCopy reads
// the item to copy through `<collection>_by_id` aliased `item`, with its relational fields and m2a fragments.
import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { cleanup } from '../permissions/fixtures.js';
import {
	adminJwt,
	createGraphqlModel,
	createGraphqlUsers,
	type GraphqlModel,
	type GraphqlUsers,
	sameGql,
	seedGraphqlModel,
} from './helpers.js';

const run = Math.random().toString(16).slice(2, 8);

let m: GraphqlModel;
let users: GraphqlUsers;
let admin: string;
let articles: number[];

beforeAll(async () => {
	m = await createGraphqlModel(`gql_app_${run}`);
	({ articles } = await seedGraphqlModel(m));
	users = await createGraphqlUsers(m, `gql-app-${run}`);
	admin = await adminJwt();
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 300_000);

/** The document of queryToGqlString for a list of panel queries. */
const insights = (queries: Record<string, Record<string, unknown>>) => jsonToGraphQLQuery({ query: queries });

describe('Insights (stores/insights.ts)', () => {
	it('metric, list and time series panels in one request per scope, as the admin and as user A', async () => {
		const items = insights({
			query_aaaa1111: {
				__aliasFor: `${m.articles}_aggregated`,
				__args: { filter: { status: { _eq: 'published' } } },
				count: { id: true },
			},
			query_bbbb2222: {
				__aliasFor: m.articles,
				__args: { limit: 5, sort: ['-published_on'] },
				id: true,
				title: true,
				category: { name: true },
			},
			query_cccc3333: {
				__aliasFor: `${m.articles}_aggregated`,
				__args: { groupBy: ['year(published_on)', 'month(published_on)'], limit: -1 },
				group: true,
				sum: { rating: true },
			},
		});

		const system = insights({
			query_dddd4444: { __aliasFor: 'users_aggregated', count: { id: true } },
			query_eeee5555: { __aliasFor: 'roles', __args: { limit: 3, sort: ['name'] }, name: true },
		});

		for (const token of [admin, users.a.token]) {
			await sameGql('items', items, { token });
			await sameGql('system', system, { token });
		}
	});

	it('a misconfigured panel: 400 with the alias in the error path, then the retry without it', async () => {
		const broken = insights({
			query_ffff6666: { __aliasFor: m.articles, nope: true },
			query_aaaa1111: { __aliasFor: `${m.articles}_aggregated`, count: { id: true } },
		});

		const result = await sameGql('items', broken, { token: admin });
		expect(result.backoffice.status).toBe(400);
		expect((result.backoffice.json as any).errors[0].extensions.errors[0].path).toEqual(['query_ffff6666']);

		await sameGql(
			'items',
			insights({ query_aaaa1111: { __aliasFor: `${m.articles}_aggregated`, count: { id: true } } }),
			{
				token: admin,
			},
		);
	});
});

describe('Save as copy (composables/use-item)', () => {
	it('the item with its duplication fields: m2o, o2m, m2m and the m2a fragments', async () => {
		const document = jsonToGraphQLQuery({
			query: {
				item: {
					__aliasFor: `${m.articles}_by_id`,
					__args: { id: String(articles[0]) },
					title: true,
					status: true,
					category: { id: true },
					comments: { body: true },
					tags: { tags_id: { id: true } },
					blocks: {
						collection: true,
						item: {
							__on: [
								{ __typeName: m.text, id: true, body: true },
								{ __typeName: m.quote, id: true, author: true },
							],
						},
					},
				},
			},
		});

		await sameGql('items', document, { token: admin });

		const system = jsonToGraphQLQuery({
			query: { item: { __aliasFor: 'users_by_id', __args: { id: users.a.id }, email: true, role: { id: true } } },
		});

		await sameGql('system', system, { token: admin });
	});
});
