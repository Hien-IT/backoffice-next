import * as env from '@backoffice/env';
import type { RequestHandler } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { type App, createApp } from './app.js';
import { useLogger } from './logger/index.js';
import { CREDENTIALS_IGNORED_MESSAGE, resetCredentialsWarning } from './middleware/public-accountability.js';

vi.mock('@backoffice/env', async (importOriginal) => {
	const actual = await importOriginal<typeof env>();
	return { ...actual, useEnv: vi.fn(actual.useEnv) };
});

const logger = { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn(), fatal: vi.fn() };

vi.mock('./logger/index.js', () => ({
	useLogger: () => logger,
	createExpressLogger: (): RequestHandler => (_req, _res, next) => next(),
}));

const defaults = (await vi.importActual<typeof env>('@backoffice/env')).useEnv();

let app: App;

async function start(overrides: Record<string, unknown> = {}, options: Parameters<typeof createApp>[0] = {}) {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, ...overrides });
	app = await createApp(options);
	return request(app.express);
}

beforeEach(() => {
	vi.clearAllMocks();
	resetCredentialsWarning();
});

afterEach(async () => {
	await app?.nest.close();
});

describe('GET /server/ping', () => {
	test('returns pong as text/html without Cache-Control', async () => {
		const res = await (await start()).get('/server/ping');
		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
		expect(res.headers['cache-control']).toBeUndefined();
		expect(res.text).toBe('pong');
	});

	test('ignores an invalid Bearer token', async () => {
		const res = await (await start()).get('/server/ping').set('Authorization', 'Bearer nope');
		expect(res.status).toBe(200);
		expect(res.text).toBe('pong');
	});

	test('rejects a token sent both as access_token and Bearer (extractToken runs first)', async () => {
		const res = await (await start()).get('/server/ping?access_token=a').set('Authorization', 'Bearer b');
		expect(res.status).toBe(400);

		expect(res.body).toEqual({
			errors: [
				{
					message: 'Invalid payload. The request uses more than one method for including an access token.',
					extensions: {
						code: 'INVALID_PAYLOAD',
						reason: 'The request uses more than one method for including an access token',
					},
				},
			],
		});
	});

	test('is served case-insensitively and with a trailing slash', async () => {
		const agent = await start();
		expect((await agent.get('/SERVER/ping')).text).toBe('pong');
		expect((await agent.get('/server/ping/')).text).toBe('pong');
	});
});

describe('headers', () => {
	test('X-Powered-By is Backoffice, CSP and COOP are set', async () => {
		const res = await (await start()).get('/server/ping');
		expect(res.headers['x-powered-by']).toBe('Backoffice');
		expect(res.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-eval'");
		expect(res.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
		expect(res.headers['strict-transport-security']).toBeUndefined();
	});

	test('HSTS when enabled, no COOP when disabled', async () => {
		const res = await (
			await start({ HSTS_ENABLED: true, CROSS_ORIGIN_OPENER_POLICY_ENABLED: false })
		).get('/server/ping');
		expect(res.headers['strict-transport-security']).toBeDefined();
		expect(res.headers['cross-origin-opener-policy']).toBeUndefined();
	});
});

describe('root routes', () => {
	test('GET / redirects to ROOT_REDIRECT', async () => {
		const res = await (await start()).get('/');
		expect(res.status).toBe(302);
		expect(res.headers['location']).toBe('./admin');
	});

	test('GET / falls through to 404 when ROOT_REDIRECT is false', async () => {
		const res = await (await start({ ROOT_REDIRECT: false })).get('/');
		expect(res.status).toBe(404);
	});

	test('GET /robots.txt returns ROBOTS_TXT', async () => {
		const res = await (await start()).get('/robots.txt');
		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
		expect(res.text).toBe('User-agent: *\nDisallow: /');
	});
});

describe('404 and errors', () => {
	test.each(['/nope', '/admin', '/admin/content'])('%s → ROUTE_NOT_FOUND', async (path) => {
		const res = await (await start()).get(path);
		expect(res.status).toBe(404);
		expect(res.body).toEqual({
			errors: [{ message: `Route ${path} doesn't exist.`, extensions: { path, code: 'ROUTE_NOT_FOUND' } }],
		});
	});

	test('POST /server/ping → 404, no 405', async () => {
		const res = await (await start()).post('/server/ping');
		expect(res.status).toBe(404);
		expect(res.body.errors[0].extensions.code).toBe('ROUTE_NOT_FOUND');
	});

	test('malformed JSON body → INVALID_PAYLOAD', async () => {
		const res = await (await start()).post('/nope').set('Content-Type', 'application/json').send('{bad');
		expect(res.status).toBe(400);
		expect(res.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');
	});

	test('body over MAX_PAYLOAD_SIZE → INVALID_PAYLOAD', async () => {
		const res = await (
			await start({ MAX_PAYLOAD_SIZE: '10b' })
		)
			.post('/nope')
			.set('Content-Type', 'application/json')
			.send(JSON.stringify({ a: 'more than ten bytes' }));

		expect(res.status).toBe(400);
		expect(res.body.errors[0]).toEqual({
			message: 'Invalid payload. request entity too large.',
			extensions: { code: 'INVALID_PAYLOAD', reason: 'request entity too large' },
		});
	});

	test('pressure limiter error → 503 SERVICE_UNAVAILABLE without X-Powered-By', async () => {
		const res = await (
			await start({ PRESSURE_LIMITER_MAX_MEMORY_RSS: 1, PRESSURE_LIMITER_SAMPLE_INTERVAL: 1 })
		).get('/server/ping');
		// The monitor needs one sample before it reports overload.
		await new Promise((r) => setTimeout(r, 20));
		const res2 = await request(app.express).get('/server/ping');
		expect([res.status, res2.status]).toContain(503);
		const overloaded = res.status === 503 ? res : res2;
		expect(overloaded.body.errors[0].extensions.code).toBe('SERVICE_UNAVAILABLE');
		expect(overloaded.headers['x-powered-by']).toBeUndefined();
	});

	test('invalid PRESSURE_LIMITER_SAMPLE_INTERVAL throws', async () => {
		await expect(start({ PRESSURE_LIMITER_SAMPLE_INTERVAL: 'abc' })).rejects.toThrow(
			'Invalid value for PRESSURE_LIMITER_SAMPLE_INTERVAL environment variable',
		);
	});
});

describe('public accountability (FR-044)', () => {
	test('warns once per process, then logs at debug', async () => {
		const agent = await start(
			{},
			{
				beforeRoutes: [(req, res, next) => (req.path === '/whoami' ? res.json(req.accountability) : next())],
			},
		);

		const first = await agent
			.get('/whoami')
			.set('Authorization', 'Bearer x')
			.set('User-Agent', 'ua')
			.set('Origin', 'o');
		expect(first.body).toMatchObject({
			role: null,
			user: null,
			roles: [],
			admin: false,
			app: false,
			userAgent: 'ua',
			origin: 'o',
		});
		expect(useLogger().warn).toHaveBeenCalledWith(CREDENTIALS_IGNORED_MESSAGE);

		await agent.get('/whoami?access_token=x');
		expect(useLogger().warn).toHaveBeenCalledTimes(1);
		expect(useLogger().debug).toHaveBeenCalledWith(CREDENTIALS_IGNORED_MESSAGE);
	});

	test('session cookie counts as credentials', async () => {
		const agent = await start();
		await agent.get('/nope').set('Cookie', 'directus_session_token=abc');
		expect(useLogger().warn).toHaveBeenCalledWith(CREDENTIALS_IGNORED_MESSAGE);
	});

	test('no warning without credentials', async () => {
		await (await start()).get('/nope');
		expect(useLogger().warn).not.toHaveBeenCalled();
	});
});

test('rate limiters are mounted before /server/ping', async () => {
	const limiter = vi.fn<RequestHandler>((_req, res) => {
		res.status(429).send('limited');
	});

	const res = await (await start({}, { rateLimiters: [limiter] })).get('/server/ping');
	expect(res.status).toBe(429);
	expect(limiter).toHaveBeenCalledOnce();
});
