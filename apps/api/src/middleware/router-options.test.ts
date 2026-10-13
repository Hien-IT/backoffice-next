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

test.each(['/server/ping', '/', '/robots.txt', '/server/specs/graphql', '/metrics'])(
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

// Feature 007 (contracts/files-api.md §4): measured with OPTIONS on Directus 11.17.4 (T018), TUS off and on.
test.each([
	['/files', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/files/', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/files/import', 'POST,GET,HEAD,PATCH,DELETE'],
	['/files/3f1c', 'GET,HEAD,PATCH,DELETE'],
	['/files/tus', 'GET,HEAD,PATCH,DELETE'],
	['/folders', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/folders/3f1c/', 'GET,HEAD,PATCH,DELETE'],
	['/assets/3f1c', 'GET,HEAD'],
	['/assets/3f1c/photo.jpg', 'GET,HEAD'],
	['/assets/folder', 'GET,HEAD'],
	['/assets/folder/3f1c', 'POST,GET,HEAD'],
	['/assets/files', 'POST,GET,HEAD'],
])('TUS off: OPTIONS %s → Allow: %s', async (path, allow) => {
	const res = await app({}).options(path);
	expect(res.status).toBe(200);
	expect(res.headers['allow']).toBe(allow);
});

test('TUS off: /files/tus/:id and deeper asset paths are not handled (404)', async () => {
	for (const path of ['/files/tus/abc', '/assets/a/b/c', '/files/a/b']) {
		expect((await app({}).options(path)).status, path).toBe(404);
	}
});

test('TUS on: the tus router answers /files/tus, /files/tus/:id goes to the tus handler', async () => {
	expect((await app({ TUS_ENABLED: true }).options('/files/tus')).headers['allow']).toBe('POST');
	// Directus mounts the tus router on `env['TUS_ENABLED'] === true` (the env casts "true"); anything else is off.
	expect((await app({ TUS_ENABLED: 'yes' }).options('/files/tus')).headers['allow']).toBe('GET,HEAD,PATCH,DELETE');
	expect((await app({ TUS_ENABLED: true }).options('/files/tus/')).headers['allow']).toBe('POST');
	expect((await app({ TUS_ENABLED: true }).options('/files/tus/abc')).status).toBe(404);
	expect((await app({ TUS_ENABLED: true }).options('/files/import')).headers['allow']).toBe(
		'POST,GET,HEAD,PATCH,DELETE',
	);
});

// Feature 008 (contracts/history-api.md §5): from the route order of the Directus routers.
test.each([
	['/activity', 'SEARCH,GET,HEAD'],
	['/activity/12', 'GET,HEAD'],
	['/revisions', 'GET,HEAD,SEARCH'],
	['/revisions/12/', 'GET,HEAD'],
	['/versions', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/versions/3f1c', 'GET,HEAD,PATCH,DELETE'],
	['/versions/3f1c/compare', 'GET,HEAD'],
	['/versions/3f1c/save', 'POST'],
	['/versions/3f1c/promote/', 'POST'],
	['/comments/', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/comments/3f1c', 'GET,HEAD,PATCH,DELETE'],
])('OPTIONS %s → Allow: %s', async (path, allow) => {
	const res = await app({}).options(path);
	expect(res.status).toBe(200);
	expect(res.headers['allow']).toBe(allow);
});

test('deeper history paths are not handled (404)', async () => {
	for (const path of ['/activity/1/x', '/versions/a/b/c', '/comments/a/b']) {
		expect((await app({}).options(path)).status, path).toBe(404);
	}
});

// Feature 009 (contracts/flows-api.md §9): from the route order of the Directus flows and operations routers.
test.each([
	['/flows', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/flows/3f1c', 'GET,HEAD,PATCH,DELETE'],
	['/flows/trigger', 'GET,HEAD,PATCH,DELETE'],
	['/flows/trigger/3f1c2d4e-0000-4000-8000-00000000000a', 'GET,HEAD,POST'],
	['/flows/trigger/3F1C2D4E-0000-4000-8000-00000000000A/', 'GET,HEAD,POST'],
	['/operations/', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/operations/3f1c', 'GET,HEAD,PATCH,DELETE'],
])('OPTIONS %s → Allow: %s', async (path, allow) => {
	const res = await app({}).options(path);
	expect(res.status).toBe(200);
	expect(res.headers['allow']).toBe(allow);
});

test('a trigger path without a uuid and deeper flows paths are not handled (404)', async () => {
	for (const path of ['/flows/trigger/not-a-uuid', '/flows/a/b/c', '/operations/a/b']) {
		expect((await app({}).options(path)).status, path).toBe(404);
	}
});

// Feature 010 (contracts/system-api.md §10, utils-api.md §12): from the route order of the nine Directus routers.
const UUID = '3f1c2d4e-0000-4000-8000-00000000000a';

test.each([
	['/server/setup', 'POST'],
	['/settings', 'GET,HEAD,PATCH'],
	['/settings/owner/', 'POST'],
	['/presets', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/presets/12', 'GET,HEAD,PATCH,DELETE'],
	['/notifications/', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/translations/x', 'GET,HEAD,PATCH,DELETE'],
	['/dashboards', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/panels/x', 'GET,HEAD,PATCH,DELETE'],
	['/shares', 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
	['/shares/auth', 'POST'],
	['/shares/invite/', 'POST'],
	[`/shares/info/${UUID}`, 'GET,HEAD'],
	[`/shares/${UUID.toUpperCase()}`, 'GET,HEAD,PATCH,DELETE'],
	['/extensions', 'GET,HEAD'],
	['/extensions/registry', 'GET,HEAD'],
	[`/extensions/registry/account/${UUID}`, 'GET,HEAD'],
	[`/extensions/registry/extension/${UUID}`, 'GET,HEAD'],
	['/extensions/registry/install', 'POST'],
	['/extensions/registry/reinstall', 'POST'],
	[`/extensions/registry/uninstall/${UUID}`, 'DELETE'],
	['/extensions/sources/index.js', 'GET,HEAD'],
	[`/extensions/${UUID}`, 'PATCH,DELETE'],
	['/utils/random/string', 'GET,HEAD'],
	['/utils/hash/generate', 'POST'],
	['/utils/hash/verify', 'POST'],
	['/utils/sort/articles', 'POST'],
	['/utils/revert/12', 'POST'],
	['/utils/import/articles', 'POST'],
	['/utils/export/articles', 'POST'],
	['/utils/translations/generate', 'POST'],
	['/utils/cache/clear', 'POST'],
	['/utils/resolve-redirect', 'POST'],
])('OPTIONS %s → Allow: %s (feature 010)', async (path, allow) => {
	const res = await app({}).options(path);
	expect(res.status).toBe(200);
	expect(res.headers['allow']).toBe(allow);
});

test('paths that match no route of the feature 010 routers are not handled (404)', async () => {
	for (const path of [
		'/settings/other',
		'/shares/not-a-uuid',
		'/shares/info/not-a-uuid',
		'/extensions/not-a-uuid',
		'/extensions/registry/account/not-a-uuid',
		'/presets/a/b',
		'/utils',
		'/utils/sort',
		'/utils/random',
	]) {
		expect((await app({}).options(path)).status, path).toBe(404);
	}
});
