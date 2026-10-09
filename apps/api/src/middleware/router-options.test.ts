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
