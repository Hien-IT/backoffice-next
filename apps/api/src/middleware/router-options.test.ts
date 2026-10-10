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

	for (const path of ['/auth/refresh', '/auth/Logout/', '/auth/login', '/AUTH/login/', '/auth/login/LOCAL2', '/auth/login/local2/']) {
		const res = await app(env).options(path);
		expect(res.headers['allow'], path).toBe('POST');
		expect(res.text).toBe('POST');
	}

	for (const path of ['/auth/login/local2/x', '/auth/login/default', '/auth/login/nope']) {
		expect((await app(env).options(path)).status, path).toBe(404);
	}

	expect((await app({ ...env, AUTH_DISABLE_DEFAULT: true }).options('/auth/login')).status).toBe(404);
});
