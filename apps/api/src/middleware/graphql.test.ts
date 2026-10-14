// Backoffice (feature 011, T013): Directus has no test for middleware/graphql.ts; these pin the method, query-string
// and body handling of parseGraphQL the parity suite compares (spec FR-001, contracts/graphql-api.md §1).
import { useEnv } from '@backoffice/env';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parseGraphQL } from './graphql.js';

vi.mock('@backoffice/env', () => ({ useEnv: vi.fn(() => ({})) }));

function run(partial: Partial<Request>): Promise<{ res: Response; error?: any }> {
	const req = { method: 'POST', query: {}, body: {}, ...partial } as Request;
	const res = { locals: {} } as unknown as Response;

	return new Promise((resolve) => {
		parseGraphQL(req, res, (error?: any) => resolve({ res, error }));
	});
}

beforeEach(() => {
	vi.mocked(useEnv).mockReturnValue({ GRAPHQL_QUERY_TOKEN_LIMIT: 5000 });
});

describe('parseGraphQL', () => {
	test.each(['PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])(
		'%s → 405 METHOD_NOT_ALLOWED allowed GET, POST',
		async (method) => {
			const { error } = await run({ method });
			expect(error.code).toBe('METHOD_NOT_ALLOWED');
			expect(error.extensions).toEqual({ allowed: ['GET', 'POST'], current: method });
		},
	);

	test('POST: query, variables and operationName from the body; context per request', async () => {
		const { res, error } = await run({
			body: { query: 'query A { __typename }', variables: { a: 1 }, operationName: 'A' },
		});

		expect(error).toBeUndefined();
		const params = res.locals['graphqlParams'];
		expect(params.query).toBe('query A { __typename }');
		expect(params.variables).toEqual({ a: 1 });
		expect(params.operationName).toBe('A');
		expect(params.document.kind).toBe('Document');
		expect(params.contextValue.cache).toBeInstanceOf(Map);
		expect(params.contextValue.res).toBe(res);
		expect(res.locals['cache']).toBeUndefined();
	});

	test('GET: query, variables (JSON) and operationName from the query string; variables default to {}', async () => {
		const { res, error } = await run({
			method: 'GET',
			query: { query: '{ __typename }', variables: '{"a":1}' },
		});

		expect(error).toBeUndefined();
		expect(res.locals['graphqlParams'].variables).toEqual({ a: 1 });

		const { res: res2 } = await run({ method: 'GET', query: { query: '{ __typename }' } });
		expect(res2.locals['graphqlParams'].variables).toEqual({});
	});

	test('GET with variables that are not JSON → 400 INVALID_QUERY', async () => {
		const { error } = await run({ method: 'GET', query: { query: '{ __typename }', variables: '{a' } });
		expect(error.code).toBe('INVALID_QUERY');
		expect(error.message).toBe('Invalid query. Variables are invalid JSON.');
	});

	test('no query → 400 INVALID_PAYLOAD "Must provide query string"', async () => {
		const { error } = await run({ body: {} });
		expect(error.code).toBe('INVALID_PAYLOAD');
		expect(error.message).toBe('Invalid payload. Must provide query string.');
	});

	test('a document that does not parse → GRAPHQL_VALIDATION with the parse error', async () => {
		const { error } = await run({ body: { query: '{ __typename' } });
		expect(error.code).toBe('GRAPHQL_VALIDATION');
		expect(error.extensions.errors[0].message).toMatch(/Syntax Error/);
	});

	test('a document over GRAPHQL_QUERY_TOKEN_LIMIT → GRAPHQL_VALIDATION', async () => {
		vi.mocked(useEnv).mockReturnValue({ GRAPHQL_QUERY_TOKEN_LIMIT: 3 });
		const { error } = await run({ body: { query: '{ a b c d e }' } });
		expect(error.code).toBe('GRAPHQL_VALIDATION');
		expect(error.extensions.errors[0].message).toMatch(/Document contains more that 3 tokens/); // sic, graphql 16.12;
	});

	test('a mutation over GET → 405 allowed POST; over POST it disables the response cache', async () => {
		const { error } = await run({ method: 'GET', query: { query: 'mutation { x }' } });
		expect(error.code).toBe('METHOD_NOT_ALLOWED');
		expect(error.extensions).toEqual({ allowed: ['POST'], current: 'GET' });

		const { res, error: error2 } = await run({ body: { query: 'mutation { x }' } });
		expect(error2).toBeUndefined();
		expect(res.locals['cache']).toBe(false);
	});

	test('operationName picks the operation that decides the method check', async () => {
		const document = 'query Q { a } mutation M { b }';
		const { error } = await run({ method: 'GET', query: { query: document, operationName: 'Q' } });
		expect(error).toBeUndefined();

		const { error: error2 } = await run({ method: 'GET', query: { query: document, operationName: 'M' } });
		expect(error2.code).toBe('METHOD_NOT_ALLOWED');
	});
});
