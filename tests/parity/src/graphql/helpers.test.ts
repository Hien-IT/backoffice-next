// Feature 011 (T016): the request shape of the GraphQL parity helpers, no Docker.
import { describe, expect, test } from 'vitest';
import { endpoint, gqlRequest, INTROSPECTION, sortSdlFields } from './helpers.js';

describe('gqlRequest', () => {
	test('POST: the document, variables and operation name in the body; the token as a bearer header', () => {
		expect(gqlRequest('items', '{ a }', { variables: { x: 1 }, operationName: 'Q', token: 't' })).toEqual({
			method: 'POST',
			path: '/graphql',
			headers: { 'cache-control': 'no-store', authorization: 'Bearer t' },
			body: { query: '{ a }', variables: { x: 1 }, operationName: 'Q' },
		});
	});

	test('GET: everything in the query string, variables as JSON; the system scope path', () => {
		const req = gqlRequest('system', '{ server_ping }', { method: 'GET', variables: { x: 1 } });
		const url = new URL(req.path, 'http://h');

		expect(url.pathname).toBe('/graphql/system');
		expect(url.searchParams.get('query')).toBe('{ server_ping }');
		expect(url.searchParams.get('variables')).toBe('{"x":1}');
		expect(req.headers).toEqual({ 'cache-control': 'no-store' });
	});

	test('the public sends no authorization; the standard introspection query asks for every option', () => {
		expect(gqlRequest('items', '{ a }').headers).toEqual({ 'cache-control': 'no-store' });
		expect(endpoint('items')).toBe('/graphql');
		expect(INTROSPECTION).toContain('specifiedByURL');
		expect(INTROSPECTION).toContain('isRepeatable');
		expect(INTROSPECTION).toMatch(/inputFields\(includeDeprecated: true\)/);
	});
});

describe('sortSdlFields (MySQL column order, CI 39901388416)', () => {
	// The two SDLs of that run, cut down: `directus_access` in another column order, and the blank line printSchema puts
	// before a described field that is not the first.
	const directus = [
		'type directus_access {',
		'  id: ID!',
		'  policy: String',
		'  role: String',
		'  sort: Int',
		'  user: String',
		'}',
		'',
		'type directus_shares {',
		'  id: ID!',
		'',
		'  """$t:shared_leave_blank_for_unlimited"""',
		'  max_uses: Float',
		'  times_used: Float',
		'}',
	].join('\n');
	const backoffice = [
		'type directus_access {',
		'  id: ID!',
		'  role: String',
		'  user: String',
		'  policy: String',
		'  sort: Int',
		'}',
		'',
		'type directus_shares {',
		'  """$t:shared_leave_blank_for_unlimited"""',
		'  max_uses: Float',
		'  id: ID!',
		'  times_used: Float',
		'}',
	].join('\n');

	test('the same SDL in another field order compares equal', () => {
		expect(sortSdlFields(backoffice)).toBe(sortSdlFields(directus));
	});

	test('a description stays with its field; a missing field still differs', () => {
		expect(sortSdlFields(directus)).toContain('  """$t:shared_leave_blank_for_unlimited"""\n  max_uses: Float');
		expect(sortSdlFields(backoffice.replace('  sort: Int\n', ''))).not.toBe(sortSdlFields(directus));
	});
});
