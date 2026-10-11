// Feature 005, US4 (FR-020, FR-021, FR-044, contracts/export.md): `?export=` in every format on every kind of payload
// that goes through respond(). Both apps read the same database, so the files must match byte for byte; only the
// timestamp of the file name differs (normalizeContentDisposition).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { adminToken, appRequest } from '../directus-api.js';
import { assertParity, type ParityRequest, parity } from '../parity.js';
import { cleanup, createField, createUserCollection } from '../permissions/fixtures.js';

const run = Math.random().toString(16).slice(2, 10);
const AUTHORS = `parity_export_authors_${run}`;
const ARTICLES = `parity_export_articles_${run}`;
const COMMENTS = `parity_export_comments_${run}`;
const SINGLETON = `parity_export_s_${run}`;
// FR-044: a collection name outside ASCII gives a `filename*=UTF-8''...` part.
const UNICODE = `parity_xuất_${run}`;

const FORMATS = ['json', 'csv', 'csv_utf8', 'xml', 'yaml'] as const;

let admin: string;
let first: number;

beforeAll(async () => {
	admin = `Bearer ${await adminToken('directus')}`;

	await createUserCollection(AUTHORS, [{ field: 'name', type: 'string' }]);
	await createUserCollection(ARTICLES, [
		{ field: 'title', type: 'string' },
		{ field: 'status', type: 'string' },
		{ field: 'published', type: 'timestamp' },
		{ field: 'author', type: 'integer', meta: { special: ['m2o'], interface: 'select-dropdown-m2o' } },
	]);
	await appRequest('directus', 'POST', '/relations', {
		collection: ARTICLES,
		field: 'author',
		related_collection: AUTHORS,
	});
	await createField(ARTICLES, { field: 'comments', type: 'alias', meta: { special: ['o2m'], interface: 'list-o2m' } });
	await createUserCollection(COMMENTS, [
		{ field: 'body', type: 'text' },
		{ field: 'article', type: 'integer' },
	]);
	await appRequest('directus', 'POST', '/relations', {
		collection: COMMENTS,
		field: 'article',
		related_collection: ARTICLES,
		meta: { one_field: 'comments' },
	});
	await createUserCollection(SINGLETON, [{ field: 'headline', type: 'string', schema: { default_value: 'Welcome' } }], {
		meta: { singleton: true },
	});
	await createUserCollection(UNICODE, [{ field: 'tên', type: 'string' }]);

	const author = await appRequest('directus', 'POST', `/items/${AUTHORS}`, { name: 'Ann' });
	const articles = await appRequest('directus', 'POST', `/items/${ARTICLES}`, [
		{
			title: 'a',
			status: 'published',
			published: '2024-05-06T07:08:09.000Z',
			author: author.data.id,
			comments: [{ body: 'first' }, { body: 'line\nbreak' }],
		},
		{ title: 'b, "quoted"', status: 'draft', published: '2025-01-02T03:04:05.000Z', author: null },
		{ title: 'ü <&>', status: 'draft', published: null, author: author.data.id },
	]);
	first = articles.data[0].id;
	await appRequest('directus', 'POST', `/items/${encodeURIComponent(UNICODE)}`, [{ tên: 'một' }, { tên: 'hai' }]);
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 300_000);

const sources: [string, () => ParityRequest][] = [
	[
		'list with nested m2o and o2m',
		() => ({ path: `/items/${ARTICLES}?fields=id,title,author.name,comments.body&sort=id` }),
	],
	['one item', () => ({ path: `/items/${ARTICLES}/${first}?fields=*,author.*` })],
	['singleton', () => ({ path: `/items/${SINGLETON}` })],
	['empty list', () => ({ path: `/items/${ARTICLES}?filter[title][_eq]=none` })],
	['aggregate with groupBy', () => ({ path: `/items/${ARTICLES}?aggregate[count]=*&groupBy[]=status&sort=status` })],
	['fields with a function', () => ({ path: `/items/${ARTICLES}?fields=id,year(published)&sort=id` })],
	[
		'SEARCH',
		() => ({
			method: 'SEARCH',
			path: `/items/${ARTICLES}`,
			body: { query: { fields: ['id', 'title'], sort: ['id'] } },
		}),
	],
	['GET /users', () => ({ path: '/users?fields=id,email,role.name&filter[email][_eq]=admin@example.com' })],
	['GET /server/info', () => ({ path: '/server/info' })],
	// A key that does not exist: a 204 without payload at both apps, nothing to clean up.
	['204 (no payload)', () => ({ method: 'DELETE', path: `/items/${ARTICLES}/999999` })],
	['collection name outside ASCII', () => ({ path: `/items/${encodeURIComponent(UNICODE)}?sort=id` })],
];

const withExport = (path: string, format: string) => `${path}${path.includes('?') ? '&' : '?'}export=${format}`;

describe.each(sources)('%s', (_name, source) => {
	it.each(FORMATS)('export=%s: status, content-type, content-disposition, body byte for byte', async (format) => {
		const req = source();
		const result = await parity({ ...req, path: withExport(req.path, format), headers: { authorization: admin } });

		assertParity(result);
		// parity() compares JSON bodies by structure; the file is compared as bytes (tab indentation included).
		expect(result.backoffice.text).toBe(result.directus.text);
	});
});

it('an unknown format → 400 INVALID_QUERY at both', async () => {
	const result = await parity({ path: `/items/${ARTICLES}?export=pdf`, headers: { authorization: admin } });

	assertParity(result);
	expect(result.backoffice.status).toBe(400);
});
