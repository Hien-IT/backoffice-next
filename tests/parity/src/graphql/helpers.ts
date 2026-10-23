// Feature 011 (research R9, contracts/parity.md §2): shared helpers of the GraphQL parity files. A document is sent to
// both apps at once (sameGql) and compared verbatim, order included (Clarifications: no sorting before the comparison);
// writes run as scenarios (Directus, then Backoffice) and compare the responses and the rows each app wrote.
import { getIntrospectionQuery } from 'graphql';
import { acceptedDifferences } from '../../accepted-differences.js';
import { hostDb } from '../auth/db-effects.js';
import { adminToken, type AppName, appRequest, appUrl } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { assertParity, type Captured, capture, type ParityOptions, type ParityResult, parity } from '../parity.js';
import {
	attachPolicy,
	CreateRole,
	createField,
	createPolicy,
	createUser,
	createUserCollection,
	type Permission,
	type TestUser,
	uniqueName,
} from '../permissions/fixtures.js';

export { comparable, warnLines } from '../system/helpers.js';

export type Scope = 'items' | 'system';

/** The accepted differences (D-09.9 and D-15 left the list when feature 011 closed). */
export const ACCEPTED = acceptedDifferences;

export const endpoint = (scope: Scope) => (scope === 'system' ? '/graphql/system' : '/graphql');

/** The standard introspection query with every option of graphql 16 on (spec Assumptions, SC-001). */
export const INTROSPECTION = getIntrospectionQuery({
	descriptions: true,
	specifiedByUrl: true,
	directiveIsRepeatable: true,
	schemaDescription: true,
	inputValueDeprecation: true,
});

export interface GqlOptions {
	variables?: Record<string, unknown> | null;
	operationName?: string;
	/** A bearer token (JWT or static token); none for the public. */
	token?: string | null | undefined;
	/** GET sends the document in the query string, `variables` as JSON. */
	method?: 'GET' | 'POST';
	/** Extra headers (Cache-Control for the cache cases). */
	headers?: Record<string, string>;
	/** Applied to both answers before the comparison. */
	normalize?: (captured: Captured) => Captured;
}

/**
 * `fields_in_collection` sorted by field name, the ETag hash masked (same length). On MySQL the inspector reads
 * INFORMATION_SCHEMA.COLUMNS without ORDER BY (as Directus), so each app gets the columns in the order of its query plan
 * (CI 39095641641: ordinal at Directus, by name at Backoffice).
 */
export function fieldsByName(captured: Captured): Captured {
	const json = captured.json as { data?: { fields_in_collection?: { field: string }[] } } | null;
	const fields = json?.data?.fields_in_collection;
	if (!fields) return captured;
	return {
		...captured,
		json: {
			...json,
			data: { ...json.data, fields_in_collection: [...fields].sort((a, b) => a.field.localeCompare(b.field)) },
		},
		headers: { ...captured.headers, etag: captured.headers['etag']?.replace(/-[^-"]+"$/, '-<hash>"') ?? '' },
	};
}

/**
 * Sorts the field lines of every type, input, interface and enum block of an SDL (a description stays with its field,
 * blank lines are dropped: printSchema puts one before a described field that is not the first). Same cause as
 * fieldsByName: on MySQL each app builds its schema in the column order of its own INFORMATION_SCHEMA plan (CI
 * 39901388416: `directus_access` ordinal at Backoffice, by name at Directus).
 */
export function sortSdlFields(sdl: string): string {
	return sdl.replace(/^((?:type|input|interface|enum) [^\n]*\{\n)([\s\S]*?)(\n\})/gm, (_m, head, body, tail) => {
		const entries: string[][] = [];
		let current: string[] = [];
		let inDescription = false;

		for (const line of (body as string).split('\n')) {
			if (line.trim() === '') continue;
			current.push(line);
			if ((line.split('"""').length - 1) % 2 === 1) inDescription = !inDescription;
			if (!inDescription && !line.trimStart().startsWith('"""')) {
				entries.push(current);
				current = [];
			}
		}

		const key = (entry: string[]) => entry.at(-1)!;
		return (
			head +
			entries
				.sort((a, b) => key(a).localeCompare(key(b)))
				.map((e) => e.join('\n'))
				.join('\n') +
			tail
		);
	});
}

/**
 * On MySQL only (verbatim elsewhere): the SDL of the route or of `server_specs_graphql` with sorted fields, the ETag
 * hash masked. ponytail: introspection (`__schema` fields) is still compared in column order; sort it the same way if
 * it flakes on MySQL.
 */
export function sdlByField(captured: Captured): Captured {
	if (getDbsToTest()[0] !== 'mysql') return captured;
	const json = captured.json as { data?: { server_specs_graphql?: string } } | null;
	const etag = captured.headers['etag']?.replace(/-[^-"]+"$/, '-<hash>"') ?? '';
	const sdl = json?.data?.server_specs_graphql;

	if (typeof sdl === 'string') {
		return {
			...captured,
			json: { ...json, data: { ...json!.data, server_specs_graphql: sortSdlFields(sdl) } },
			headers: { ...captured.headers, etag },
		};
	}

	return captured.isJson
		? captured
		: { ...captured, text: sortSdlFields(captured.text), headers: { ...captured.headers, etag } };
}

/** The parity request of a GraphQL document. */
export function gqlRequest(scope: Scope, query: string, options: GqlOptions = {}) {
	// Fresh answers like the GET requests of capture(): POST /graphql is cached too (FR-004), CACHE_SKIP_ALLOWED=true in
	// the vendor env. The cache cases set their own Cache-Control.
	const headers: Record<string, string> = { 'cache-control': 'no-store', ...options.headers };
	if (options.token) headers['authorization'] = `Bearer ${options.token}`;

	if (options.method === 'GET') {
		const params = new URLSearchParams({ query });
		if (options.variables) params.set('variables', JSON.stringify(options.variables));
		if (options.operationName) params.set('operationName', options.operationName);
		return { method: 'GET', path: `${endpoint(scope)}?${params}`, headers };
	}

	const body: Record<string, unknown> = { query };
	if (options.variables !== undefined) body['variables'] = options.variables;
	if (options.operationName !== undefined) body['operationName'] = options.operationName;
	return {
		method: 'POST',
		path: endpoint(scope),
		headers,
		body,
		...(options.normalize && { normalize: options.normalize }),
	};
}

/** Sends a document to one app. */
export function gql(app: AppName, scope: Scope, query: string, options: GqlOptions = {}): Promise<Captured> {
	return capture(appUrl(app), gqlRequest(scope, query, options));
}

/** Sends a document to both apps at once and fails on any difference that is not accepted (verbatim, order included). */
export async function sameGql(
	scope: Scope,
	query: string,
	options: GqlOptions = {},
	parityOptions: ParityOptions = {},
): Promise<ParityResult> {
	const result = await parity(gqlRequest(scope, query, options), { accepted: ACCEPTED, ...parityOptions });
	assertParity(result);
	return result;
}

/** The introspection result of one app for a token (none for the public). */
export async function introspection(app: AppName, scope: Scope, token?: string | null, baseUrl?: string) {
	const captured = await capture(baseUrl ?? appUrl(app), gqlRequest(scope, INTROSPECTION, { token }));
	return captured.json as { data?: { __schema: unknown }; errors?: unknown[] };
}

/** The SDL of /server/specs/graphql[/system] of one app: status, body and the headers the parity compares. */
export async function sdl(app: AppName, scope: Scope, token?: string | null, baseUrl?: string) {
	const captured = await capture(baseUrl ?? appUrl(app), {
		path: scope === 'system' ? '/server/specs/graphql/system' : '/server/specs/graphql',
		headers: token ? { authorization: `Bearer ${token}` } : {},
	});

	return {
		status: captured.status,
		text: captured.text,
		contentType: captured.headers['content-type'],
		// The date in the file name is the day of the request: the same at both apps within one run.
		disposition: captured.headers['content-disposition'],
	};
}

/** Admin token issued by Directus (same SECRET, valid at both apps). */
export const adminJwt = () => adminToken('directus');

// --- Data model --------------------------------------------------------------------------------------------------

export interface GraphqlModel {
	categories: string;
	articles: string;
	tags: string;
	articlesTags: string;
	comments: string;
	blocks: string;
	text: string;
	quote: string;
	settings: string;
}

/**
 * The data model of the GraphQL files, made through Directus and removed by cleanup(): `<p>articles` (integer key;
 * string, integer, decimal, dateTime, json (with the `cast-json` special: a json field without meta fails POST /collections at Directus), boolean, csv fields) with a m2o `category`, an o2m `comments`, a m2m `tags`
 * through `<p>articles_tags` and a m2a `blocks` (`<p>text`, `<p>quote`) through `<p>articles_blocks`, and a singleton
 * `<p>settings`; articles have content versioning on (`<c>_by_version`). Each file passes its own prefix so shards running in parallel do not share collections.
 */
export async function createGraphqlModel(prefix: string): Promise<GraphqlModel> {
	const p = `${prefix}_`;
	const m: GraphqlModel = {
		categories: `${p}categories`,
		articles: `${p}articles`,
		tags: `${p}tags`,
		articlesTags: `${p}articles_tags`,
		comments: `${p}comments`,
		blocks: `${p}articles_blocks`,
		text: `${p}text`,
		quote: `${p}quote`,
		settings: `${p}settings`,
	};

	const relation = (body: Record<string, unknown>) => appRequest('directus', 'POST', '/relations', body);

	await createUserCollection(m.categories, [{ field: 'name', type: 'string' }]);
	await createUserCollection(m.tags, [{ field: 'label', type: 'string' }]);
	await createUserCollection(m.text, [{ field: 'body', type: 'text' }]);
	await createUserCollection(m.quote, [{ field: 'author', type: 'string' }]);

	await createUserCollection(
		m.articles,
		[
			{ field: 'title', type: 'string' },
			{ field: 'status', type: 'string', schema: { default_value: 'draft' } },
			{ field: 'rating', type: 'integer' },
			{ field: 'price', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 } },
			{ field: 'published_on', type: 'dateTime' },
			{ field: 'featured', type: 'boolean', schema: { default_value: false } },
			{ field: 'details', type: 'json', meta: { special: ['cast-json'] } },
			{ field: 'keywords', type: 'csv' },
			{ field: 'category', type: 'integer' },
		],
		{ meta: { versioning: true } },
	);

	await relation({ collection: m.articles, field: 'category', related_collection: m.categories });

	// o2m
	await createUserCollection(m.comments, [
		{ field: 'body', type: 'string' },
		{ field: 'article', type: 'integer' },
	]);

	await createField(m.articles, { field: 'comments', type: 'alias', meta: { special: ['o2m'] } });
	await relation({
		collection: m.comments,
		field: 'article',
		related_collection: m.articles,
		meta: { one_field: 'comments' },
	});

	// m2m
	await createUserCollection(m.articlesTags, [
		{ field: 'articles_id', type: 'integer' },
		{ field: 'tags_id', type: 'integer' },
	]);

	await createField(m.articles, { field: 'tags', type: 'alias', meta: { special: ['m2m'] } });

	await relation({
		collection: m.articlesTags,
		field: 'articles_id',
		related_collection: m.articles,
		meta: { one_field: 'tags', junction_field: 'tags_id' },
		schema: { on_delete: 'CASCADE' },
	});

	await relation({
		collection: m.articlesTags,
		field: 'tags_id',
		related_collection: m.tags,
		meta: { junction_field: 'articles_id' },
		schema: { on_delete: 'SET NULL' },
	});

	// m2a
	await createUserCollection(m.blocks, [
		{ field: 'articles_id', type: 'integer' },
		{ field: 'item', type: 'string' },
		{ field: 'collection', type: 'string' },
	]);

	await createField(m.articles, { field: 'blocks', type: 'alias', meta: { special: ['m2a'] } });

	await relation({
		collection: m.blocks,
		field: 'item',
		related_collection: null,
		meta: {
			one_allowed_collections: [m.text, m.quote],
			one_collection_field: 'collection',
			junction_field: 'articles_id',
		},
	});

	await relation({
		collection: m.blocks,
		field: 'articles_id',
		related_collection: m.articles,
		meta: { one_field: 'blocks', junction_field: 'item' },
		schema: { on_delete: 'CASCADE' },
	});

	await createUserCollection(m.settings, [{ field: 'headline', type: 'string' }], { meta: { singleton: true } });

	return m;
}

/**
 * Rows of the model, written through Directus: three categories, five articles (two published), tags, comments,
 * blocks of both kinds and the singleton. Returns the article ids in insertion order.
 */
export async function seedGraphqlModel(m: GraphqlModel): Promise<{ articles: number[]; categories: number[] }> {
	const write = (collection: string, body: unknown) => appRequest('directus', 'POST', `/items/${collection}`, body);

	const categories = (await write(m.categories, [{ name: 'news' }, { name: 'tech' }, { name: 'life' }])).data.map(
		(c: { id: number }) => c.id,
	);

	const tags = (await write(m.tags, [{ label: 'a' }, { label: 'b' }, { label: 'c' }])).data.map(
		(t: { id: number }) => t.id,
	);

	const texts = (await write(m.text, [{ body: 'hello' }])).data.map((t: { id: number }) => t.id);
	const quotes = (await write(m.quote, [{ author: 'ada' }])).data.map((q: { id: number }) => q.id);

	const articles: number[] = [];

	const rows = [
		{
			title: 'alpha',
			status: 'published',
			rating: 5,
			price: '10.50',
			published_on: '2026-01-15T10:00:00',
			category: categories[0],
		},
		{
			title: 'beta',
			status: 'draft',
			rating: 3,
			price: '7.00',
			published_on: '2026-02-20T08:30:00',
			category: categories[1],
		},
		{
			title: 'gamma',
			status: 'published',
			rating: 4,
			price: '12.00',
			published_on: '2025-12-01T12:00:00',
			category: categories[1],
		},
		{ title: 'delta', status: 'archived', rating: 1, price: null, published_on: null, category: null },
		{
			title: 'epsilon',
			status: 'draft',
			rating: null,
			price: '3.25',
			published_on: '2026-03-03T00:00:00',
			category: categories[2],
		},
	];

	for (const [i, row] of rows.entries()) {
		const created = await write(m.articles, {
			...row,
			featured: i === 0,
			details: { order: i, nested: { flag: i % 2 === 0 } },
			keywords: ['k', String(i)],
			comments: i < 2 ? [{ body: `c${i}-1` }, { body: `c${i}-2` }] : [],
			tags: i < 3 ? [{ tags_id: tags[i] }, { tags_id: tags[(i + 1) % 3] }] : [],
			blocks:
				i === 0
					? [
							{ collection: m.text, item: String(texts[0]) },
							{ collection: m.quote, item: String(quotes[0]) },
						]
					: [],
		});

		articles.push(created.data.id);
	}

	await appRequest('directus', 'PATCH', `/items/${m.settings}`, { headline: 'Welcome' });

	return { articles, categories };
}

// --- Users of the permission cases (SC-001) ---------------------------------------------------------------------

export interface GraphqlUsers {
	/** A: reads some fields of articles and categories. */
	a: TestUser;
	/** B: reads published articles only; creates categories without reading them. */
	b: TestUser;
	/** C: updates and deletes tags without reading them; reads articles and categories. */
	c: TestUser;
	/** The policy of each user, for the cases that change a permission. */
	policies: { a: string; b: string; c: string };
}

async function userWith(prefix: string, permissions: Permission[]): Promise<[TestUser, string]> {
	const role = await CreateRole('directus', { name: uniqueName(`${prefix}-role`) });
	const policy = await createPolicy('directus', prefix, { app: false, permissions });
	await attachPolicy('directus', policy, { role: role.id });
	return [await createUser('directus', prefix, { role: role.id }), policy];
}

export async function createGraphqlUsers(m: GraphqlModel, prefix: string): Promise<GraphqlUsers> {
	const [a, policyA] = await userWith(`${prefix}-a`, [
		{ collection: m.articles, action: 'read', fields: ['id', 'title', 'status', 'category'] },
		{ collection: m.categories, action: 'read', fields: ['id', 'name'] },
	]);

	const [b, policyB] = await userWith(`${prefix}-b`, [
		{ collection: m.articles, action: 'read', fields: ['*'], permissions: { status: { _eq: 'published' } } },
		{ collection: m.categories, action: 'create', fields: ['name'] },
	]);

	const [c, policyC] = await userWith(`${prefix}-c`, [
		{ collection: m.tags, action: 'update', fields: ['label'] },
		{ collection: m.tags, action: 'delete' },
		{ collection: m.articles, action: 'read', fields: ['*'] },
		{ collection: m.categories, action: 'read', fields: ['*'] },
	]);

	return { a, b, c, policies: { a: policyA, b: policyB, c: policyC } };
}

// --- DB effects of mutations -------------------------------------------------------------------------------------

const maxId = async (table: string) => Number((await hostDb().max({ m: 'id' }).from(table).first())?.['m'] ?? 0);

/**
 * Runs `fn` and returns its result with the rows of `tables` (integer keys) and of directus_activity and
 * directus_revisions created while it ran, ordered by id. Rows updated in place are read again by the caller.
 */
export async function graphqlEffects<T>(
	tables: string[],
	fn: () => Promise<T>,
): Promise<{ result: T; rows: Record<string, Record<string, unknown>[]> }> {
	const all = [...tables, 'directus_activity', 'directus_revisions'];
	const before = new Map(await Promise.all(all.map(async (t) => [t, await maxId(t)] as const)));
	const result = await fn();
	const rows: Record<string, Record<string, unknown>[]> = {};

	for (const table of all) {
		rows[table] = await hostDb().select('*').from(table).where('id', '>', before.get(table)!).orderBy('id');
	}

	return { result, rows };
}
