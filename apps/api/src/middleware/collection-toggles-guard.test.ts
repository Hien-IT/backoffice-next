// Backoffice (spec 024, D-188): the toggles checked on the sanitized query before the shared response cache (research
// R2, R3).
import { SchemaBuilder } from '@backoffice/schema-builder';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getCache } from '../cache.js';
import { runMiddleware } from '../utils/run-middleware.js';
import type { CollectionToggles } from '../utils/collection-toggles.js';
import collectionTogglesGuard from './collection-toggles-guard.js';

vi.mock('../cache.js');

const schema = new SchemaBuilder()
	.collection('a', (c) => {
		c.field('id').id();
		c.field('title').string();
	})
	.collection('directus_users', (c) => {
		c.field('id').id();
		c.field('rel').o2m('a', 'owner');
	})
	.build();

let toggles: CollectionToggles;

beforeEach(() => {
	toggles = { a: { search: false, export: false } };
	vi.mocked(getCache).mockReturnValue({ localSchemaCache: { get: async () => toggles, set: vi.fn() } } as any);
});

function run(originalUrl: string, sanitizedQuery: Record<string, unknown> = {}, extra: Partial<Request> = {}) {
	const req = { method: 'GET', originalUrl, sanitizedQuery, schema, query: {}, body: {}, ...extra } as Request;
	const res = { locals: {} } as Response;
	return { res, done: runMiddleware(collectionTogglesGuard, req, res) };
}

const forbidden = (path = 'root') => ({
	code: 'FORBIDDEN',
	message: `You don't have permission to access collection "a" or it does not exist. Queried in ${path}.`,
});

describe('REST', () => {
	test.each([
		['GET /items/a?search', '/items/a?search=x', { search: 'x' }, 'GET'],
		['GET /items/a/1?search', '/items/a/1?search=x', { search: 'x' }, 'GET'],
		['POST /items/a?search (before the write, FR-017)', '/items/a?search=x', { search: 'x' }, 'POST'],
		['PATCH /items/a/1?search', '/items/a/1?search=x', { search: 'x' }, 'PATCH'],
		['GET /items/a?export', '/items/a?export=csv', { export: 'csv' }, 'GET'],
		['POST /items/a?export (FR-004)', '/items/a?export=csv', { export: 'csv' }, 'POST'],
		['PATCH /items/a/1?export', '/items/a/1?export=json', { export: 'json' }, 'PATCH'],
	])('%s → the collection permission error', async (_name, url, query, method) => {
		await expect(run(url, query, { method }).done).rejects.toMatchObject(forbidden());
	});

	test('a system endpoint with _search of deep through a relation to the collection (FR-017)', async () => {
		await expect(run('/users?deep', { deep: { rel: { _search: 'x' } } }).done).rejects.toMatchObject(
			forbidden('"rel"'),
		);
	});

	test.each([
		['no search', '/items/a', {}],
		['an empty search (dropped by sanitizeQuery)', '/items/a?search=', {}],
		['a filter', '/items/a?filter', { filter: { title: { _eq: 'x' } } }],
		['the toggle on for another collection', '/items/b?search=x', { search: 'x' }],
		['a system collection', '/users?search=x', { search: 'x' }],
		['an extension endpoint (FR-009)', '/parity-endpoint-demo/items?search=x', { search: 'x', export: 'csv' }],
		['a server route', '/server/info', {}],
	])('%s → next()', async (_name, url, query) => {
		await expect(run(url, query).done).resolves.toBeUndefined();
	});
});

describe('GraphQL skips the cache read only while a collection has search off (FR-012, D-188.4)', () => {
	const post = (query: string) => run('/graphql', {}, { method: 'POST', body: { query } });

	test('a document with search', async () => {
		const { res, done } = post('{ a(search: "x") { id } }');
		await done;
		expect(res.locals['skipCacheRead']).toBe(true);
	});

	test('GET /graphql/system reads the document from the query string', async () => {
		const { res, done } = run(
			'/graphql/system',
			{},
			{ query: { query: '{ users { rel(search: "x") { id } } }' } as any },
		);
		await done;
		expect(res.locals['skipCacheRead']).toBe(true);
	});

	test('a document without search', async () => {
		const { res, done } = post('{ a { id } }');
		await done;
		expect(res.locals['skipCacheRead']).toBeUndefined();
	});

	test('no collection with search off', async () => {
		toggles = { a: { export: false } };
		const { res, done } = post('{ a(search: "x") { id } }');
		await done;
		expect(res.locals['skipCacheRead']).toBeUndefined();
	});
});
