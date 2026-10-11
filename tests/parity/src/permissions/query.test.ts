// Feature 004, FR-040: the query of the five endpoints (fields, filter, search, sort, limit, offset, page, meta,
// aggregate, groupBy, deep, alias, backlink; qs and JSON syntax; SEARCH with body.query) and the 400 INVALID_QUERY
// cases of validateQuery, for an admin, a user with partial permissions and the public. Reads only: parity().
import { afterAll, beforeAll, describe, it } from 'vitest';
import { appUrl } from '../directus-api.js';
import { assertParity, capture, parity, type ParityRequest } from '../parity.js';
import { attachPolicy, cleanup, createPolicy, createRoleTree, createUser, type TestUser } from './fixtures.js';

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const ENDPOINTS = ['/users', '/roles', '/policies', '/access', '/permissions'];

let admin: string;
let partial: TestUser;

beforeAll(async () => {
	const login = await capture(appUrl('directus'), {
		method: 'POST',
		path: '/auth/login',
		body: { email: 'admin@example.com', password: 'password' },
	});

	admin = (login.json as any).data.access_token;

	const { leaf } = await createRoleTree('directus', 'parity-query');
	const own = { id: { _eq: '$CURRENT_USER' } };

	await attachPolicy(
		'directus',
		await createPolicy('directus', 'parity-query', {
			app: true,
			permissions: [
				{ collection: 'directus_users', action: 'read', fields: ['id', 'email', 'role', 'status'], permissions: own },
				{
					collection: 'directus_roles',
					action: 'read',
					fields: ['id', 'name', 'parent', 'children', 'users'],
					permissions: {},
				},
				{
					collection: 'directus_policies',
					action: 'read',
					fields: ['id', 'name'],
					permissions: { name: { _starts_with: 'parity' } },
				},
				{
					collection: 'directus_access',
					action: 'read',
					fields: ['*'],
					permissions: { role: { _eq: '$CURRENT_ROLE' } },
				},
			],
		}),
		{ role: leaf },
	);

	partial = await createUser('directus', 'parity-query', { role: leaf });
}, 60_000);

afterAll(cleanup, 60_000);

const QUERIES: string[] = [
	'',
	'?fields=*',
	'?fields=id,*.*',
	'?fields[]=id&fields[]=name',
	'?fields=id&sort=-id&limit=3&offset=1',
	'?fields=id&limit=2&page=2',
	'?limit=-1&fields=id',
	'?meta=*',
	'?meta=total_count,filter_count&limit=1',
	'?search=parity&fields=id',
	`?filter=${json({ _and: [{ id: { _nnull: true } }, { _or: [{ id: { _null: true } }, { id: { _nempty: true } }] }] })}&fields=id`,
	'?filter[id][_nnull]=true&fields=id',
	`?filter=${json({ id: { _in: ['00000000-0000-4000-8000-000000000000'] } })}`,
	'?aggregate[count]=*',
	'?aggregate[countDistinct]=id',
	'?aggregate[count]=id&groupBy[]=id&limit=2',
	'?alias[x]=id&fields=x',
	'?backlink=false&fields=*.*',
];

/** Queries that only make sense on one endpoint (relations, functions, deep). */
const SPECIFIC: Record<string, string[]> = {
	'/users': [
		'?fields=id,role.name,role.children.name',
		`?filter=${json({ role: { name: { _contains: 'parity' } } })}&fields=id`,
		`?filter=${json({ 'year(last_access)': { _gte: 2000 } })}&fields=id`,
		`?filter=${json({ last_access: { _gte: '$NOW(-1 year)' } })}&fields=id`,
		'?fields=id,policies.policy.name',
		`?deep=${json({ policies: { _limit: 1, _sort: ['id'] } })}&fields=id,policies.id`,
		`?filter=${json({ email: { _icontains: 'PARITY' } })}&fields=email&sort=email`,
	],
	'/roles': [
		'?fields=id,users.email,children.id',
		`?filter=${json({ users: { _some: { email: { _contains: 'parity' } } } })}&fields=id`,
		`?filter=${json({ users: { _none: { email: { _nnull: true } } } })}&fields=id`,
		`?filter=${json({ children: { _some: { id: { _nnull: true } } } })}&fields=id,name`,
		`?deep=${json({ users: { _filter: { email: { _contains: 'parity' } }, _limit: 1 } })}&fields=id,users.email`,
		`?filter=${json({ 'count(users)': { _gt: 0 } })}&fields=id`,
		'?fields=id,count(users)',
		`?filter=${json({ name: { _starts_with: 'parity', _ncontains: 'zzz' } })}&sort=name&fields=name`,
	],
	'/policies': [
		'?fields=id,users.user.email,roles.role.name,permissions.collection',
		`?filter=${json({ permissions: { _some: { collection: { _eq: 'directus_users' } } } })}&fields=id`,
		`?filter=${json({ ip_access: { _null: true } })}&fields=id&limit=3`,
		`?filter=${json({ admin_access: { _eq: true }, app_access: { _neq: false } })}&fields=id`,
	],
	'/access': [
		'?fields=*,policy.name,role.name,user.email',
		`?filter=${json({ user: { _null: true }, role: { _null: true } })}`,
	],
	'/permissions': [
		`?filter=${json({ collection: { _in: ['directus_users', 'directus_roles'] }, action: { _eq: 'read' } })}&fields=collection,action`,
		'?fields=id,policy.name&sort=collection,action',
		`?filter=${json({ permissions: { _null: false } })}&fields=id`,
	],
};

const INVALID: string[] = [
	'?limit=abc',
	'?limit=-2',
	'?offset=-1',
	'?page=0',
	'?filter={bad',
	`?filter=${json({ id: { _bogus: 1 } })}`,
	`?filter=${json({ id: { _in: 'not-an-array' } })}`,
	'?meta=bogus',
	'?sort[]=',
	'?aggregate=x',
	'?alias[id]=email',
	'?deep=abc',
	'?fields=a.b.c.d.e.f.g.h.i.j.k.l',
];

const headersOf = (who: 'admin' | 'partial' | 'public'): Record<string, string> =>
	who === 'admin'
		? { authorization: `Bearer ${admin}` }
		: who === 'partial'
			? { authorization: `Bearer ${partial.token}` }
			: {};

async function same(req: ParityRequest) {
	assertParity(await parity(req));
}

describe.each(ENDPOINTS)('%s', (endpoint) => {
	it.each(['admin', 'partial', 'public'] as const)('every query as %s', async (who) => {
		const headers = headersOf(who);

		for (const query of [...QUERIES, ...(SPECIFIC[endpoint] ?? []), ...INVALID]) {
			await same({ path: `${endpoint}${query}`, headers });
		}

		await same({
			method: 'SEARCH',
			path: endpoint,
			headers,
			body: { query: { fields: ['id'], limit: 2, sort: ['id'], filter: { id: { _nnull: true } } } },
		});

		await same({ method: 'SEARCH', path: `${endpoint}?limit=1`, headers, body: { query: { limit: 'abc' } } });
	});
});
