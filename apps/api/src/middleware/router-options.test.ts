import { useEnv } from '@backoffice/env';
import express from 'express';
import request from 'supertest';
import { expect, test, vi } from 'vitest';
import { createRouterOptions } from './router-options.js';

vi.mock('@backoffice/env');

function app(env: Record<string, unknown>) {
	vi.mocked(useEnv).mockReturnValue(env);
	const a = express();
	a.use(createRouterOptions());
	a.use((_req, res) => res.status(404).send('nope'));
	return request(a);
}

test.each(['/server/info', '/server/health', '/server/specs/oas', '/SERVER/Info/', '/server/health/'])(
	'OPTIONS %s → 200 Allow: GET,HEAD',
	async (path) => {
		const res = await app({}).options(path);
		expect(res.status).toBe(200);
		expect(res.headers['allow']).toBe('GET,HEAD');
		expect(res.text).toBe('GET,HEAD');
	},
);

test.each(['/server/ping', '/', '/robots.txt', '/server/setup', '/server/specs/graphql', '/metrics'])(
	'OPTIONS %s → not handled (404)',
	async (path) => {
		expect((await app({}).options(path)).status).toBe(404);
	},
);

test('respects OPENAPI_ENABLED and METRICS_ENABLED; other methods pass through', async () => {
	expect((await app({ OPENAPI_ENABLED: false }).options('/server/specs/oas')).status).toBe(404);
	expect((await app({ METRICS_ENABLED: true }).options('/metrics')).status).toBe(200);
	expect((await app({}).get('/server/info')).status).toBe(404);
});

// Feature 003 (FR-034): the auth routes and the login routers of the default and the local providers answer POST.
test('OPTIONS of the auth routes → Allow: POST', async () => {
	const env = { AUTH_PROVIDERS: 'local2,sso', AUTH_LOCAL2_DRIVER: 'local', AUTH_SSO_DRIVER: 'openid' };

	for (const path of [
		'/users/me/tfa/generate/',
		'/auth/password/request',
		'/auth/password/reset/',
		'/auth/refresh',
		'/auth/Logout/',
		'/auth/login',
		'/AUTH/login/',
		'/auth/login/LOCAL2',
		'/auth/login/local2/',
	]) {
		const res = await app(env).options(path);
		expect(res.headers['allow'], path).toBe('POST');
		expect(res.text).toBe('POST');
	}

	for (const path of ['/auth/login/local2/x', '/auth/login/default', '/auth/login/nope']) {
		expect((await app(env).options(path)).status, path).toBe(404);
	}

	expect((await app({ ...env, AUTH_DISABLE_DEFAULT: true }).options('/auth/login')).status).toBe(404);
});

test('OPTIONS of GET /auth and the SSO and LDAP providers', async () => {
	const env = {
		AUTH_PROVIDERS: 'sso,gh,dir,saml',
		AUTH_SSO_DRIVER: 'openid',
		AUTH_GH_DRIVER: 'oauth2',
		AUTH_DIR_DRIVER: 'ldap',
		AUTH_SAML_DRIVER: 'saml',
	};

	const allow = async (path: string) => (await app(env).options(path)).headers['allow'];

	expect(await allow('/auth')).toBe('GET,HEAD');
	expect(await allow('/auth/login/SSO')).toBe('GET,HEAD');
	expect(await allow('/auth/login/sso/callback/')).toBe('POST,GET,HEAD');
	expect(await allow('/auth/login/gh/callback')).toBe('POST,GET,HEAD');
	expect(await allow('/auth/login/dir')).toBe('POST');
	expect((await app(env).options('/auth/login/dir/callback')).status).toBe(404);
	expect((await app(env).options('/auth/login/saml')).status).toBe(404);
});

// Feature 004 (contracts/permissions-api.md §3).
test.each([
	['/roles', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/Policies/', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/access', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/permissions', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/users', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/users/me', 'GET,HEAD,PATCH,DELETE'],
	['/users/abc', 'GET,HEAD,PATCH,DELETE'],
	['/users/invite', 'GET,HEAD,PATCH,DELETE,POST'],
	['/users/register/', 'GET,HEAD,PATCH,DELETE,POST'],
	['/users/me/track/page', 'PATCH'],
	['/users/invite/accept', 'POST'],
	['/users/me/tfa/enable', 'POST'],
	['/users/me/tfa/disable', 'POST'],
	['/users/abc/tfa/disable', 'POST'],
	['/users/register/verify-email', 'GET,HEAD'],
	['/roles/me', 'GET,HEAD,PATCH,DELETE'],
	['/policies/abc', 'GET,HEAD,PATCH,DELETE'],
	['/access/abc/', 'GET,HEAD,PATCH,DELETE'],
	['/permissions/me', 'GET,HEAD,PATCH,DELETE'],
	['/policies/me/globals', 'GET,HEAD'],
	['/permissions/me/articles', 'GET,HEAD'],
	['/permissions/me/articles/1', 'GET,HEAD'],
])('OPTIONS %s → Allow: %s', async (path, allow) => {
	expect((await app({}).options(path)).headers['allow']).toBe(allow);
});

test.each(['/roles/a/b', '/access/a/b', '/permissions/me/a/b/c'])('OPTIONS %s → not handled (404)', async (path) => {
	expect((await app({}).options(path)).status).toBe(404);
});

// Feature 005 (contracts/items-api.md §3): the methods of controllers/items.ts in route order, HEAD after GET.
test.each([
	['/items/articles', 'POST,SEARCH,GET,HEAD,PATCH,DELETE'],
	['/items/articles/', 'POST,SEARCH,GET,HEAD,PATCH,DELETE'],
	['/items/no_such_collection', 'POST,SEARCH,GET,HEAD,PATCH,DELETE'],
	['/items/articles/1', 'GET,HEAD,PATCH,DELETE'],
	['/items/articles/1/', 'GET,HEAD,PATCH,DELETE'],
])('OPTIONS %s → Allow: %s', async (path, allow) => {
	const res = await app({}).options(path);
	expect(res.status).toBe(200);
	expect(res.headers['allow']).toBe(allow);
});

test.each(['/items', '/items/', '/items/a/b/c'])('OPTIONS %s → not handled (404)', async (path) => {
	expect((await app({}).options(path)).status).toBe(404);
});

// Feature 006 (contracts/schema-api.md §3): measured with OPTIONS on Directus 11.17.4 (T017).
test.each([
	['/collections', 'POST,GET,HEAD,SEARCH,PATCH'],
	['/collections/', 'POST,GET,HEAD,SEARCH,PATCH'],
	['/collections/articles', 'GET,HEAD,PATCH,DELETE'],
	['/fields', 'GET,HEAD'],
	['/fields/articles', 'GET,HEAD,POST,PATCH'],
	['/fields/articles/title/', 'GET,HEAD,PATCH,DELETE'],
	['/relations', 'GET,HEAD,POST'],
	['/relations/articles', 'GET,HEAD'],
	['/relations/articles/author', 'GET,HEAD,PATCH,DELETE'],
	['/schema/snapshot', 'GET,HEAD'],
	['/schema/diff', 'POST'],
	['/schema/apply/', 'POST'],
])('OPTIONS %s → Allow: %s', async (path, allow) => {
	const res = await app({}).options(path);
	expect(res.status).toBe(200);
	expect(res.headers['allow']).toBe(allow);
});

test.each(['/schema', '/schema/x', '/collections/a/b', '/fields/a/b/c'])(
	'OPTIONS %s → not handled (404)',
	async (path) => {
		expect((await app({}).options(path)).status).toBe(404);
	},
);
