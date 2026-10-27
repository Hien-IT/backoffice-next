// Spec 024 (contracts/tests.md, research R7): the bo_show_search, bo_show_import, bo_show_export toggles of
// directus_collections (spec 022) block the Backoffice HTTP layer. Directus 11.17.4 still answers these requests
// (D-188): read requests go to both apps with the difference accepted as D-188; writes, imports, exports, GraphQL and
// system endpoints are sent to each app on its own (Backoffice first, so its refusal is checked on unchanged data).
// Requests that are not blocked stay identical (FR-011). This file runs alone (fileParallelism: false), so the alias
// field it adds on directus_users is seen by no other file.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminToken, appRequest, appUrl, type AppName } from '../directus-api.js';
import { multipart } from '../files/helpers.js';
import { until } from '../flows/helpers.js';
import { gql } from '../graphql/helpers.js';
import { assertParity, capture, parity, type Captured, type ParityRequest } from '../parity.js';
import {
	attachPolicy,
	cleanup,
	createField,
	createPolicy,
	createShare,
	createUser,
	createUserCollection,
	type TestUser,
} from '../permissions/fixtures.js';

const run = Math.random().toString(16).slice(2, 10);
const A = `parity_toggles_${run}`;
const B = `parity_toggles_b_${run}`;
const USERS_ALIAS = `parity_toggles_${run}`;

let admin: string;
let reader: TestUser;
let readerJwt: string;
let shareToken: string;
let alpha: number;

const forbidden = (path = 'root') =>
	`You don't have permission to access collection "${A}" or it does not exist. Queried in ${path}.`;

async function login(path: string, body: Record<string, unknown>): Promise<string> {
	const res = await fetch(new URL(path, appUrl('directus')), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});

	return ((await res.json()) as { data: { access_token: string } }).data.access_token;
}

/** The toggles of A, saved at Directus; `clear` also clears both caches (not done in the FR-013 case). */
async function setToggles(meta: Record<string, boolean | null>, clear = true) {
	await appRequest('directus', 'PATCH', `/collections/${A}`, { meta });

	if (clear) {
		await appRequest('directus', 'POST', '/utils/cache/clear');
		await appRequest('backoffice', 'POST', '/utils/cache/clear');
	}
}

const auth = (token: string | null): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {});

const titles = async () =>
	((await appRequest('directus', 'GET', `/items/${A}?fields=title&sort=id&limit=-1`)).data as { title: string }[]).map(
		(row) => row.title,
	);

beforeAll(async () => {
	admin = await adminToken('directus');

	await createUserCollection(B);
	await createUserCollection(A, [{ field: 'title', type: 'string' }]);

	// A.b → B with the o2m B.items_a; A.owner → directus_users with an o2m alias on directus_users (no DDL on a
	// system table: a directus_fields row and the one_field of the relation).
	await createField(B, { field: 'items_a', type: 'alias', meta: { special: ['o2m'] } });
	await createField(A, { field: 'b', type: 'integer', meta: { special: ['m2o'] } });
	await appRequest('directus', 'POST', '/relations', {
		collection: A,
		field: 'b',
		related_collection: B,
		meta: { one_field: 'items_a' },
	});
	await createField(A, { field: 'owner', type: 'uuid', meta: { special: ['m2o'] } });
	await createField('directus_users', { field: USERS_ALIAS, type: 'alias', meta: { special: ['o2m'] } });
	await appRequest('directus', 'POST', '/relations', {
		collection: A,
		field: 'owner',
		related_collection: 'directus_users',
		meta: { one_field: USERS_ALIAS },
	});

	const permissions = (['read', 'create', 'update', 'delete'] as const).map((action) => ({
		collection: A,
		action,
		fields: ['*'],
		permissions: {},
	}));

	const policy = await createPolicy('directus', `toggles-${run}`, {
		permissions: [...permissions, { collection: B, action: 'read', fields: ['*'], permissions: {} }],
	});

	reader = await createUser('directus', `toggles-${run}`);
	await attachPolicy('directus', policy, { user: reader.id });
	readerJwt = await login('/auth/login', { email: reader.email, password: reader.password });

	const publicPolicy = await createPolicy('directus', `toggles-public-${run}`, {
		permissions: [{ collection: A, action: 'read', fields: ['*'], permissions: {} }],
	});
	await attachPolicy('directus', publicPolicy, { role: null, user: null });

	const b = await appRequest('directus', 'POST', `/items/${B}`, {});
	const rows = await appRequest('directus', 'POST', `/items/${A}`, [
		{ title: 'alpha', b: b.data.id, owner: reader.id },
		{ title: 'beta', b: b.data.id },
	]);
	alpha = rows.data[0].id;

	shareToken = await login('/shares/auth', { share: await createShare(A, alpha), mode: 'json' });
}, 300_000);

afterAll(async () => {
	await setToggles({ bo_show_search: true, bo_show_import: true, bo_show_export: true }).catch(() => undefined);
	// The rows reference the test user (A.owner), which cleanup() deletes first.
	await appRequest('directus', 'DELETE', `/items/${A}`, { query: { limit: -1 } });
	await cleanup();
	await appRequest('directus', 'POST', '/utils/cache/clear');
	await appRequest('backoffice', 'POST', '/utils/cache/clear');
}, 300_000);

/** Both apps: Directus answers, Backoffice refuses with the collection error; only D-188 differs. */
async function blocked(req: ParityRequest, directusStatus = 200, path = 'root') {
	const result = await parity(req);
	expect(result.differences, JSON.stringify(result.differences)).toEqual([]);
	expect(result.directus.status, result.directus.text).toBe(directusStatus);
	expect(result.backoffice.status, result.backoffice.text).toBe(403);
	expect((result.backoffice.json as any).errors[0]).toMatchObject({
		message: forbidden(path),
		extensions: { code: 'FORBIDDEN' },
	});
	expect(result.accepted.map((d) => d.id)).toContain('D-188');
}

/** One request to one app, for requests that write or differ by design. */
const at = (app: AppName, req: ParityRequest): Promise<Captured> =>
	capture(appUrl(app), { ...req, headers: { 'cache-control': 'no-store', ...req.headers } });

const CALLERS: [string, () => string | null][] = [
	['admin', () => admin],
	['user (JWT)', () => readerJwt],
	['user (static token)', () => reader.token],
	['share', () => shareToken],
	['public', () => null],
];

describe('search off on the collection (D-188)', () => {
	beforeAll(() => setToggles({ bo_show_search: false }));

	describe.each(CALLERS)('%s', (_name, token) => {
		it.each([
			['GET ?search', `?search=alpha`],
			['only spaces', `?search=%20%20`],
			['with aggregate', `?search=alpha&aggregate[count]=*`],
			['with groupBy', `?search=alpha&groupBy=title&aggregate[count]=*`],
		])('%s', async (_case, query) => {
			await blocked({ path: `/items/${A}${query}`, headers: auth(token()) });
		});

		it('GET :pk?search', async () => {
			await blocked({ path: `/items/${A}/${alpha}?search=alpha`, headers: auth(token()) });
		});

		it('SEARCH with the search in the body', async () => {
			await blocked({
				method: 'SEARCH',
				path: `/items/${A}`,
				headers: auth(token()),
				body: { query: { search: 'alpha' } },
			});
		});
	});

	it.each([
		['no search', `/items/${A}?fields=title&sort=id`],
		['an empty search', `/items/${A}?fields=title&search=`],
		['a filter', `/items/${A}?fields=title&filter[title][_eq]=alpha`],
		['meta', `/items/${A}?fields=title&meta=*`],
	])('not blocked: %s (FR-011)', async (_case, path) => {
		assertParity(await parity({ path, headers: auth(admin) }));
	});

	it.each(['PATCH', 'DELETE'] as const)('%s by query: refused before the write (FR-017)', async (method) => {
		// A search that matches nothing, so Directus answers without changing the shared rows.
		const body = method === 'PATCH' ? { query: { search: 'zzz' }, data: { title: 'x' } } : { query: { search: 'zzz' } };
		await blocked({ method, path: `/items/${A}`, headers: auth(admin), body }, method === 'PATCH' ? 200 : 204);
		expect(await titles()).toEqual(['alpha', 'beta']);
	});

	it('?search= on writes: refused before the write (FR-017)', async () => {
		const before = await titles();

		for (const req of [
			{ method: 'POST', path: `/items/${A}?search=zzz`, body: { title: 'created' } },
			{ method: 'PATCH', path: `/items/${A}/${alpha}?search=zzz`, body: { title: 'changed' } },
		]) {
			const res = await at('backoffice', { ...req, headers: auth(admin) });
			expect(res.status, res.text).toBe(403);
			expect((res.json as any).errors[0].message).toBe(forbidden());
		}

		expect(await titles()).toEqual(before);
		expect((await at('directus', { path: `/items/${A}?search=zzz`, headers: auth(admin) })).status).toBe(200);
	});

	it('deep._search through a relation, from a user collection and from /users (FR-017, analyze C1)', async () => {
		await blocked(
			{ path: `/items/${B}?fields=items_a.title&deep[items_a][_search]=alpha`, headers: auth(admin) },
			200,
			'"items_a"',
		);

		const path = `/users?fields=id&filter[id][_eq]=${reader.id}&deep[${USERS_ALIAS}][_search]=alpha`;
		const directus = await at('directus', { path, headers: auth(admin) });
		const backoffice = await at('backoffice', { path, headers: auth(admin) });
		expect(directus.status, directus.text).toBe(200);
		expect(backoffice.status).toBe(403);
		expect((backoffice.json as any).errors[0].message).toBe(forbidden(`"${USERS_ALIAS}"`));
	});

	it('GraphQL: the root, _aggregated, a nested field, /graphql/system, a mutation (FR-003, FR-017)', async () => {
		const cases: ['items' | 'system', string, string[]][] = [
			['items', `{ ${A}(search: "alpha") { id } }`, [A]],
			['items', `{ ${A}_aggregated(search: "alpha") { count { id } } }`, [`${A}_aggregated`]],
			['items', `{ ${B} { items_a(search: "alpha") { id } } }`, [B]],
			[
				'system',
				`{ users(filter: { id: { _eq: "${reader.id}" } }) { ${USERS_ALIAS}(search: "alpha") { id } } }`,
				['users'],
			],
		];

		for (const [scope, query, path] of cases) {
			const directus = await gql('directus', scope, query, { token: admin });
			const backoffice = await gql('backoffice', scope, query, { token: admin });
			expect((directus.json as any).errors, directus.text).toBeUndefined();
			expect(backoffice.status).toBe(200);
			expect((backoffice.json as any).errors[0]).toMatchObject({ extensions: { code: 'FORBIDDEN' }, path });
		}

		const before = await titles();
		const mutation = `mutation { create_${A}_items(data: [{ title: "created" }], search: "zzz") { id } }`;
		const created = await gql('backoffice', 'items', mutation, { token: admin });
		expect((created.json as any).errors[0].extensions.code).toBe('FORBIDDEN');
		expect(await titles()).toEqual(before);
	});

	it('GraphQL without a search answers as Directus', async () => {
		const query = `{ ${A}(sort: ["id"]) { title } }`;
		const directus = await gql('directus', 'items', query, { token: admin });
		const backoffice = await gql('backoffice', 'items', query, { token: admin });
		expect(backoffice.json).toEqual(directus.json);
	});

	it('POST /utils/export with a search in the body query, export on (FR-017)', async () => {
		const res = await at('backoffice', {
			method: 'POST',
			path: `/utils/export/${A}`,
			headers: auth(admin),
			body: { query: { search: 'alpha' }, format: 'csv' },
		});
		expect(res.status, res.text).toBe(403);
	});
});

describe('export off on the collection (D-188.1)', () => {
	beforeAll(() => setToggles({ bo_show_search: true, bo_show_export: false }));

	it.each([
		['csv', `/items/${A}?export=csv`],
		['json of one item', `/items/${A}/1?export=json`],
	])('?export= %s', async (_case, path) => {
		await blocked({ path: path.replace('/1?', `/${alpha}?`), headers: auth(admin) });
	});

	it('?export= on a write and POST /utils/export: refused, no file, no row (FR-004)', async () => {
		const before = await titles();
		const title = `parity-toggles-${run}`;

		for (const req of [
			{ method: 'POST', path: `/items/${A}?export=csv`, body: { title: 'created' } },
			{ method: 'POST', path: `/utils/export/${A}`, body: { query: {}, format: 'csv', file: { title } } },
		]) {
			const res = await at('backoffice', { ...req, headers: auth(admin) });
			expect(res.status, res.text).toBe(403);
		}

		await new Promise((resolve) => setTimeout(resolve, 2000));
		const files = await appRequest('directus', 'GET', `/files?filter[title][_eq]=${title}&fields=id`);
		expect(files.data).toEqual([]);
		expect(await titles()).toEqual(before);
	});

	it('a read without export answers as Directus', async () => {
		assertParity(await parity({ path: `/items/${A}?fields=title&search=alpha`, headers: auth(admin) }));
	});
});

describe('import off on the collection (D-188.2)', () => {
	beforeAll(() => setToggles({ bo_show_export: true, bo_show_import: false }));

	it('POST /utils/import: refused, no row; POST /items still creates (FR-005)', async () => {
		const before = await titles();
		const { body, headers } = multipart([
			{ name: 'file', data: Buffer.from('title\nimported\n'), filename: 'a.csv', contentType: 'text/csv' },
		]);

		const res = await at('backoffice', {
			method: 'POST',
			path: `/utils/import/${A}`,
			headers: { ...headers, ...auth(admin) },
			body,
		});
		expect(res.status, res.text).toBe(403);
		expect((res.json as any).errors[0].message).toBe(forbidden());
		expect(await titles()).toEqual(before);

		const created = await at('backoffice', {
			method: 'POST',
			path: `/items/${A}`,
			headers: auth(admin),
			body: { title: 'gamma' },
		});
		expect(created.status, created.text).toBe(200);
		await appRequest('directus', 'DELETE', `/items/${A}/${(created.json as any).data.id}`);
	});
});

describe('toggles on or null answer as Directus (FR-008, FR-011)', () => {
	it.each([true, null])('%s', async (value) => {
		await setToggles({ bo_show_search: value, bo_show_import: value, bo_show_export: value });
		assertParity(await parity({ path: `/items/${A}?fields=title&search=alpha`, headers: auth(admin) }));
		assertParity(await parity({ path: `/items/${A}?fields=title&export=json`, headers: auth(admin) }));
	});
});

describe('a toggle saved at Directus applies at Backoffice without clearing a cache (FR-013, analyze G1)', () => {
	it('off then on', async () => {
		const path = `/items/${A}?fields=title&search=alpha`;
		const status = async () => (await at('backoffice', { path, headers: auth(admin) })).status;

		await setToggles({ bo_show_search: true });
		expect(await status()).toBe(200);

		await setToggles({ bo_show_search: false }, false);
		expect(await until(async () => (await status()) === 403)).toBe(true);

		await setToggles({ bo_show_search: true }, false);
		expect(await until(async () => (await status()) === 200)).toBe(true);
	});
});

describe('the response cache shared with Directus (FR-012, SC-003, D-188.4)', () => {
	// A Cache-Control of its own, so capture() does not add no-store and both apps read the shared cache.
	const cached = { 'cache-control': 'max-age=0' };
	const read = (app: AppName, req: ParityRequest) => capture(appUrl(app), req);

	it('an entry Directus wrote does not answer a blocked request', async () => {
		// Off first: saving the collection purges the response cache (CACHE_AUTO_PURGE), then Directus writes the entry.
		await setToggles({ bo_show_search: false });
		const rest: ParityRequest = {
			path: `/items/${A}?fields=title&search=beta`,
			headers: { ...auth(admin), ...cached },
		};
		const graphql = `{ ${A}(search: "beta") { title } }`;

		await read('directus', rest);
		expect((await read('directus', rest)).headers['x-cache-status']).toBe('HIT');
		await gql('directus', 'items', graphql, { token: admin, headers: cached });
		expect((await gql('directus', 'items', graphql, { token: admin, headers: cached })).headers['x-cache-status']).toBe(
			'HIT',
		);

		expect((await read('backoffice', rest)).status).toBe(403);
		const blockedGql = await gql('backoffice', 'items', graphql, { token: admin, headers: cached });
		expect((blockedGql.json as any).errors[0].extensions.code).toBe('FORBIDDEN');
		expect(blockedGql.headers['x-cache-status']).toBe('MISS');
	});

	it('no collection with search off: a GraphQL document with search reads the cache as Directus (D-188.4)', async () => {
		await setToggles({ bo_show_search: true });
		const graphql = `{ ${A}(search: "beta") { title } }`;

		await gql('directus', 'items', graphql, { token: admin, headers: cached });
		expect(
			(await gql('backoffice', 'items', graphql, { token: admin, headers: cached })).headers['x-cache-status'],
		).toBe('HIT');
	});
});
