// Feature 011, US5 (spec FR-001, FR-002, FR-047, FR-050 to FR-052, contracts/graphql-api.md §1, §5): every kind of
// GraphQL error at both apps, compared verbatim (status, code, message, locations, path, extensions): parse and
// validation errors, execution errors, resolver errors as the admin and as another user, scalar errors, the method and
// query-string checks of parseGraphQL, and a subscription sent over HTTP (research R12.1, R12.2).
import { afterAll, beforeAll, describe, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { assertParity, parity } from '../parity.js';
import { cleanup } from '../permissions/fixtures.js';
import {
	ACCEPTED,
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

beforeAll(async () => {
	m = await createGraphqlModel(`gql_err_${run}`);
	await seedGraphqlModel(m);
	users = await createGraphqlUsers(m, `gql-err-${run}`);
	admin = await adminJwt();
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 300_000);

async function same(req: Parameters<typeof parity>[0]) {
	assertParity(
		await parity({ ...req, headers: { 'cache-control': 'no-store', ...req.headers } }, { accepted: ACCEPTED }),
	);
}

describe('parse and validation (US5.1)', () => {
	it('syntax, unknown fields and types, wrong argument types, operations, fragments only', async () => {
		for (const document of [
			'{ ',
			'{ nope }',
			`{ ${m.articles} { nope } }`,
			`{ ${m.articles}(limit: "two") { id } }`,
			`{ ${m.articles}(filter: { rating: { _eq: "five" } }) { id } }`,
			`{ ${m.articles}_by_id { id } }`,
			`query A { ${m.articles} { id } } query B { ${m.tags} { id } }`,
			`fragment F on ${m.articles} { id }`,
			`query ($n: Int!) { ${m.articles}(limit: $n) { id } }`,
			`{ ${m.articles}(filter: { published_on: { _eq: 1 } }) { id } }`,
		]) {
			await sameGql('items', document, { token: admin });
		}

		await sameGql('items', `query A { ${m.articles} { id } }`, { token: admin, operationName: 'Nope' });
		await sameGql('items', `query ($n: Int) { ${m.articles}(limit: $n) { id } }`, {
			token: admin,
			variables: { n: 'x' },
		});
	});

	it('scalars: BigInt, Date, Hash, string or float (FR-052)', async () => {
		for (const document of [
			`{ ${m.articles}(filter: { price: { _eq: true } }) { id } }`,
			`mutation { create_${m.articles}_item(data: { published_on: 12 }) { id } }`,
			`{ ${m.articles}(filter: { id: { _eq: "not-a-number" } }) { id } }`,
		]) {
			await sameGql('items', document, { token: admin });
		}

		await sameGql('system', `{ users(filter: { password: { _null: false } }, limit: 1) { password } }`, {
			token: admin,
		});
	});
});

describe('resolver errors (US5.2, FR-051)', () => {
	it('a Directus error keeps its code for everyone; any other error is shown to the admin only', async () => {
		for (const token of [admin, users.a.token, null]) {
			await sameGql('items', `{ ${m.articles}_by_id(id: "999999") { id } }`, { token });
			await sameGql('system', `{ users_me { email } }`, { token });
			await sameGql('items', `{ ${m.articles}(filter: { id: { _eq: "not-a-number" } }) { id } }`, { token });
		}
	});
});

describe('the transport (US1.6, research R12.1, R12.2)', () => {
	it('methods, a missing query, variables that are not JSON, a mutation over GET', async () => {
		for (const method of ['PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
			await same({ method, path: '/graphql' });
			await same({ method, path: '/graphql/system' });
		}

		await same({ method: 'POST', path: '/graphql', body: {} });
		await same({ path: '/graphql' });
		await same({ path: `/graphql?query=${encodeURIComponent('{ __typename }')}&variables=%7Bx` });
		await same({ path: `/graphql?query=${encodeURIComponent('mutation { utils_cache_clear }')}` });
		await same({ path: `/graphql/system?query=${encodeURIComponent('mutation { utils_cache_clear }')}` });
		await same({ method: 'POST', path: '/graphql/anything', body: { query: '{ __typename }' } });
		await same({ method: 'POST', path: '/graphql/system/anything', body: { query: '{ server_ping }' } });
		await same({ method: 'POST', path: '/graphql/systemx', body: { query: '{ server_ping }' } });
	});

	it('a subscription over HTTP: null data when the field exists, an error when there is no Subscription type', async () => {
		await sameGql('items', `subscription { ${m.articles}_mutated { key event } }`, { token: admin });
		await sameGql('system', `subscription { directus_users_mutated { key } }`, { token: admin });
		await sameGql('items', `subscription { x_mutated { key } }`);
		await sameGql('items', `subscription { ${m.articles}_mutated { key } }`, { token: admin, method: 'GET' });
	});
});
