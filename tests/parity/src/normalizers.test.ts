import { describe, expect, test } from 'vitest';
import {
	normalizeBody,
	normalizeContentDisposition,
	normalizeDeep,
	normalizeHeader,
	normalizeJwt,
	normalizeLocation,
	normalizeMetaIds,
	normalizeSetCookie,
	normalizeText,
	tokenKind,
} from './normalizers.js';

const jwt = (payload: Record<string, unknown>) =>
	['{"alg":"HS256","typ":"JWT"}', JSON.stringify(payload)].map((p) => Buffer.from(p).toString('base64url')).join('.') +
	'.signature';

const token64 = 'a'.repeat(32) + 'B-_9'.repeat(8);

describe('spec 022 D-181: backoffice_* collections are left out of /collections and /fields', () => {
	const body = {
		data: [
			{ collection: 'articles', meta: null },
			{ collection: 'backoffice_migrations', meta: null },
			{ collection: 'directus_users', meta: { system: true } },
		],
	};
	const kept = ['articles', 'directus_users'];
	const names = (b: unknown) => (b as { data: { collection: string }[] }).data.map((d) => d.collection);

	test.each(['/collections', '/collections/', '/collections?limit=-1', '/fields', '/fields?limit=-1'])('%s', (path) => {
		expect(names(normalizeBody(path, body))).toEqual(kept);
	});

	test('other paths and single items are not filtered', () => {
		expect(names(normalizeBody('/items/articles', body))).toHaveLength(3);
		expect(
			normalizeBody('/collections/backoffice_migrations', { data: { collection: 'backoffice_migrations' } }),
		).toEqual({ data: { collection: 'backoffice_migrations' } });
	});

	test('bodies without a data array are left as they are', () => {
		expect(normalizeBody('/collections', { errors: [{ message: 'x' }] })).toEqual({ errors: [{ message: 'x' }] });
	});

	test('OAS: the tag, the /items path and the schema of backoffice_migrations are left out', () => {
		const tag = { name: 'ItemsBackofficeMigrations', 'x-collection': 'backoffice_migrations' };
		const oas = {
			info: { title: 'x', version: 'abc' },
			tags: [{ name: 'Users', 'x-collection': 'directus_users' }, tag],
			paths: { '/items/backoffice_migrations': {}, '/items/backoffice_migrations/{id}': {}, '/users': {} },
			components: {
				schemas: {
					Users: { 'x-collection': 'directus_users' },
					ItemsBackofficeMigrations: { 'x-collection': 'backoffice_migrations' },
				},
			},
		};

		expect(normalizeBody('/server/specs/oas', oas)).toEqual({
			info: { title: 'x' },
			tags: [{ name: 'Users', 'x-collection': 'directus_users' }],
			paths: { '/users': {} },
			components: { schemas: { Users: { 'x-collection': 'directus_users' } } },
		});
	});

	// An excerpt of the admin items SDL of Directus 11.17.4 on a database with backoffice_migrations (2026-10-26).
	const directusSdl = [
		'type Query {',
		'  bo_sdl_check(filter: bo_sdl_check_filter): [bo_sdl_check!]!',
		'  backoffice_migrations(filter: backoffice_migrations_filter, sort: [String]): [backoffice_migrations!]!',
		'  backoffice_migrations_by_version(version: String!, id: ID!): version_backoffice_migrations',
		'}',
		'',
		'type backoffice_migrations {',
		'  version: ID!',
		'  name: String!',
		'}',
		'',
		'type bo_sdl_check {',
		'  id: ID!',
		'}',
		'',
		'""""""',
		'type version_backoffice_migrations {',
		'  version: ID',
		'}',
		'',
		'""""""',
		'type version_bo_sdl_check {',
		'  id: ID',
		'}',
		'',
		'input update_backoffice_migrations_input {',
		'  version: String',
		'}',
	].join('\n');
	const backofficeSdl = [
		'type Query {',
		'  bo_sdl_check(filter: bo_sdl_check_filter): [bo_sdl_check!]!',
		'}',
		'',
		'type bo_sdl_check {',
		'  id: ID!',
		'}',
		'',
		'""""""',
		'type version_bo_sdl_check {',
		'  id: ID',
		'}',
	].join('\n');

	test('SDL text: definitions and root fields named after backoffice_migrations are left out, the rest verbatim', () => {
		expect(normalizeText(directusSdl)).toBe(backofficeSdl);
		expect(normalizeText(backofficeSdl)).toBe(backofficeSdl);
		expect(normalizeText(`${directusSdl}\n`)).toBe(`${backofficeSdl}\n`);
	});

	test('server_specs_graphql through /graphql/system', () => {
		expect(normalizeBody('/graphql/system', { data: { server_specs_graphql: directusSdl } })).toEqual({
			data: { server_specs_graphql: backofficeSdl },
		});
	});

	test('GraphQL introspection: the backoffice_migrations types and root fields are left out', () => {
		const body = {
			data: {
				__schema: {
					types: [
						{
							name: 'Query',
							fields: [
								{ name: 'articles' },
								{ name: 'backoffice_migrations' },
								{ name: 'backoffice_migrations_by_id' },
							],
						},
						{
							name: 'Mutation',
							fields: [{ name: 'create_backoffice_migrations_item' }, { name: 'create_articles_item' }],
						},
						{ name: 'backoffice_migrations', fields: [{ name: 'version' }] },
						{ name: 'backoffice_migrations_filter', inputFields: [] },
						{ name: 'String', fields: null },
					],
				},
			},
		};

		expect(normalizeBody('/graphql', body)).toEqual({
			data: {
				__schema: {
					types: [
						{ name: 'Query', fields: [{ name: 'articles' }] },
						{ name: 'Mutation', fields: [{ name: 'create_articles_item' }] },
						{ name: 'String', fields: null },
					],
				},
			},
		});
		expect(normalizeBody('/graphql', { data: { articles: [] } })).toEqual({ data: { articles: [] } });
	});

	test('GraphQL system scope: the Subscription field and types of backoffice_migrations are left out', () => {
		const body = {
			data: {
				__schema: {
					types: [
						{
							name: 'Subscription',
							fields: [{ name: 'directus_users_mutated' }, { name: 'backoffice_migrations_mutated' }],
						},
						{ name: 'backoffice_migrations_mutated', fields: [{ name: 'key' }] },
						{ name: 'backoffice_migrations', fields: [{ name: 'version' }] },
					],
				},
			},
		};

		expect(normalizeBody('/graphql/system', body)).toEqual({
			data: { __schema: { types: [{ name: 'Subscription', fields: [{ name: 'directus_users_mutated' }] }] } },
		});
	});
});

describe('spec 023 D-186: the json path filter type is left out of the GraphQL schema', () => {
	const directusSdl = [
		'input articles_filter {',
		'  details: string_filter_operators',
		'  details_func: count_function_filter_operators',
		'  _and: [articles_filter]',
		'}',
		'',
		'input boolean_filter_operators {',
		'  _eq: Boolean',
		'}',
	].join('\n');
	const backofficeSdl = [
		'input articles_filter {',
		'  details: string_filter_operators',
		'  details_func: count_function_filter_operators',
		'  details_json: json_path_filter_operators',
		'  _and: [articles_filter]',
		'}',
		'',
		'input json_path_filter_operators {',
		'  path: String!',
		'  text: string_filter_operators',
		'  number: number_filter_operators',
		'  boolean: boolean_filter_operators',
		'}',
		'',
		'input boolean_filter_operators {',
		'  _eq: Boolean',
		'}',
	].join('\n');

	test('SDL text and server_specs_graphql: the input type and the <f>_json lines go, the rest verbatim', () => {
		expect(normalizeText(backofficeSdl)).toBe(directusSdl);
		expect(normalizeText(`${backofficeSdl}\n`)).toBe(`${directusSdl}\n`);
		expect(normalizeText(directusSdl)).toBe(directusSdl);
		expect(normalizeBody('/graphql/system', { data: { server_specs_graphql: backofficeSdl } })).toEqual({
			data: { server_specs_graphql: directusSdl },
		});
	});

	test('introspection: the type and the input fields of that type go (nullable or wrapped), other inputs stay', () => {
		const jsonPath = { kind: 'INPUT_OBJECT', name: 'json_path_filter_operators', ofType: null };
		const body = {
			data: {
				__schema: {
					types: [
						{
							name: 'articles_filter',
							fields: null,
							inputFields: [
								{ name: 'details', type: { kind: 'INPUT_OBJECT', name: 'string_filter_operators', ofType: null } },
								{ name: 'details_json', type: jsonPath },
								{ name: 'meta_json', type: { kind: 'NON_NULL', name: null, ofType: jsonPath } },
								{ name: 'x_json', type: { kind: 'INPUT_OBJECT', name: 'string_filter_operators', ofType: null } },
							],
						},
						{ name: 'json_path_filter_operators', fields: null, inputFields: [{ name: 'path' }] },
					],
				},
			},
		};

		expect(normalizeBody('/graphql', body)).toEqual({
			data: {
				__schema: {
					types: [
						{
							name: 'articles_filter',
							fields: null,
							inputFields: [
								{ name: 'details', type: { kind: 'INPUT_OBJECT', name: 'string_filter_operators', ofType: null } },
								{ name: 'x_json', type: { kind: 'INPUT_OBJECT', name: 'string_filter_operators', ofType: null } },
							],
						},
					],
				},
			},
		});
	});
});

describe('tokens', () => {
	test('classifies empty values, JWTs and 64-character tokens', () => {
		expect(tokenKind('')).toBe('<empty>');
		expect(tokenKind(jwt({ id: 'x' }))).toBe('<jwt>');
		expect(tokenKind(token64)).toBe('<token64>');
		expect(tokenKind('static-token')).toBe('static-token');
	});

	test('keeps the claims of an access token, its lifetime and the kind of the session claim', () => {
		expect(
			normalizeJwt(
				jwt({
					id: 'u',
					role: null,
					app_access: true,
					admin_access: false,
					session: token64,
					iat: 100,
					exp: 1000,
					iss: 'directus',
				}),
			),
		).toEqual({
			claims: { id: 'u', role: null, app_access: true, admin_access: false, session: '<token64>', iss: 'directus' },
			ttl: 900,
		});
	});

	test('normalizes access_token and refresh_token wherever they are in a body', () => {
		const body = { data: { expires: 900000, refresh_token: token64, access_token: jwt({ id: 'u', iat: 1, exp: 2 }) } };

		expect(normalizeBody('/auth/login', body)).toEqual({
			data: { expires: 900000, refresh_token: '<token64>', access_token: { claims: { id: 'u' }, ttl: 1 } },
		});
	});
});

describe('Set-Cookie', () => {
	const now = Date.parse('2026-10-10T00:00:00Z');

	test('keeps names and attributes, replaces values and Expires', () => {
		const header = [
			`directus_session_token=${jwt({ id: 'u' })}; Max-Age=86400; Path=/; Expires=Sun, 11 Oct 2026 00:00:00 GMT; HttpOnly; SameSite=Lax`,
			`directus_refresh_token=${token64}; Max-Age=604800; Path=/; Expires=Sat, 17 Oct 2026 00:00:00 GMT; HttpOnly; SameSite=Lax`,
		].join('\n');

		expect(normalizeSetCookie(header, now)).toBe(
			[
				'directus_refresh_token=<token64>; Max-Age=604800; Path=/; Expires=<future>; HttpOnly; SameSite=Lax',
				'directus_session_token=<jwt>; Max-Age=86400; Path=/; Expires=<future>; HttpOnly; SameSite=Lax',
			].join('\n'),
		);
	});

	test('tells an Express 4 cleared cookie (empty, Max-Age kept) from an Express 5 one (Expires 1970)', () => {
		const express4 =
			'directus_refresh_token=; Max-Age=604800; Path=/; Expires=Sat, 17 Oct 2026 00:00:00 GMT; HttpOnly; SameSite=Lax';
		const express5 = 'directus_refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax';

		expect(normalizeSetCookie(express4, now)).toBe(
			'directus_refresh_token=<empty>; Max-Age=604800; Path=/; Expires=<future>; HttpOnly; SameSite=Lax',
		);

		expect(normalizeSetCookie(express5, now)).toBe(
			'directus_refresh_token=<empty>; Path=/; Expires=<past>; HttpOnly; SameSite=Lax',
		);
	});

	test('is applied by normalizeHeader', () => {
		expect(normalizeHeader('set-cookie', `openid.oidc=${jwt({ verifier: 'v' })}; Path=/; HttpOnly; SameSite=Lax`)).toBe(
			'openid.oidc=<jwt>; Path=/; HttpOnly; SameSite=Lax',
		);
	});
});

describe('Location', () => {
	test('replaces random PKCE and state values of absolute URLs', () => {
		const location =
			'http://idp:9000/authorize?client_id=c&scope=openid&state=abc&nonce=abc&code_challenge=abc&redirect_uri=x';

		expect(normalizeLocation(location)).toBe(
			'http://idp:9000/authorize?client_id=c&scope=openid&state=%3Cstate%3E&nonce=%3Cnonce%3E&code_challenge=%3Ccode_challenge%3E&redirect_uri=x',
		);
	});

	test('keeps relative redirects relative and leaves URLs without random values unchanged', () => {
		expect(normalizeLocation('./callback?code=abc&state=def')).toBe('./callback?code=%3Ccode%3E&state=%3Cstate%3E');
		expect(normalizeLocation('/admin/content?reason=INVALID_CREDENTIALS')).toBe(
			'/admin/content?reason=INVALID_CREDENTIALS',
		);
		expect(normalizeHeader('location', './?prompt=true')).toBe('./?prompt=true');
	});
});

test('TFA secret and otpauth URL', () => {
	expect(
		normalizeDeep({
			data: { secret: 'JBSWY3DPEHPK3PXP', otpauth_url: 'otpauth://totp/P:a%40b.c?secret=JBSWY3DPEHPK3PXP&issuer=P' },
		}),
	).toEqual({ data: { secret: '<base32>', otpauth_url: 'otpauth://totp/P:a%40b.c?secret=<base32>&issuer=P' } });
});

test('text body of a redirect: random SSO parameters like the Location header', () => {
	expect(normalizeText('Found. Redirecting to http://idp/authorize?state=abc&nonce=def&scope=x')).toBe(
		'Found. Redirecting to http://idp/authorize?state=%3Cstate%3E&nonce=%3Cnonce%3E&scope=x',
	);
	expect(normalizeText('plain')).toBe('plain');
});

describe('normalizeContentDisposition (feature 005)', () => {
	test.each([
		['attachment; filename="articles 20261011-93005.csv"', 'attachment; filename="articles <timestamp>.csv"'],
		['attachment; filename="Export 20261011-000.json"', 'attachment; filename="Export <timestamp>.json"'],
		// Feature 007: zip names of /assets/folder/:pk and /assets/files.
		['attachment; filename="folder-Holiday-20261013-953.zip"', 'attachment; filename="folder-Holiday-<timestamp>.zip"'],
		['attachment; filename="files-20261013-12305.zip"', 'attachment; filename="files-<timestamp>.zip"'],
		[
			'attachment; filename="a 20261011-123456.yaml"; filename*=UTF-8\'\'a',
			'attachment; filename="a <timestamp>.yaml"; filename*=UTF-8\'\'a',
		],
		[
			'attachment; filename="parity_xu?t 20261011-93005.csv"; filename*=UTF-8\'\'parity_xu%E1%BA%A5t%2020261011-93005.csv',
			'attachment; filename="parity_xu?t <timestamp>.csv"; filename*=UTF-8\'\'parity_xu%E1%BA%A5t%20<timestamp>.csv',
		],
		['attachment; filename="no-date.csv"', 'attachment; filename="no-date.csv"'],
	])('%s', (value, expected) => {
		expect(normalizeContentDisposition(value)).toBe(expected);
		expect(normalizeHeader('content-disposition', value)).toBe(expected);
	});
});

describe('normalizeMetaIds (feature 006)', () => {
	test('replaces the numeric id of every meta object, nowhere else', () => {
		const body = {
			data: [
				{ collection: 'a', field: 'id', meta: { id: 12, sort: 1 }, schema: { id: 3 } },
				{ collection: 'a', meta: { id: 'not-a-number' } },
				{ collection: 'b', meta: null },
			],
		};

		expect(normalizeMetaIds(body)).toEqual({
			data: [
				{ collection: 'a', field: 'id', meta: { id: '<id>', sort: 1 }, schema: { id: 3 } },
				{ collection: 'a', meta: { id: 'not-a-number' } },
				{ collection: 'b', meta: null },
			],
		});
	});
});
