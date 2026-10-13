import * as env from '@backoffice/env';
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { type App, createApp } from './app.js';
import { useLogger } from './logger/index.js';
import getDatabase from './database/index.js';
import { getSchema } from './schema/get-database-schema.js';

vi.mock('./flows.js', async () => (await import('./test-utils/flows.js')).mockFlowManager());

vi.mock('@backoffice/env', async (importOriginal) => {
	const actual = await importOriginal<typeof env>();
	return { ...actual, useEnv: vi.fn(actual.useEnv) };
});

const logger = vi.hoisted(() => ({ warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn(), fatal: vi.fn() }));

// The schema step (feature 002) runs on every route but /server/ping and /server/health; no database here.
vi.mock('./schema/get-database-schema.js', () => ({
	getSchema: vi.fn(async () => ({ collections: {}, relations: [] })),
}));

vi.mock('./database/index.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('./database/index.js')>();
	return { ...original, default: vi.fn(original.default) };
});

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
	// authenticate (every route since feature 004) opens the default connection on each request, like Directus;
	// without a token no query runs, so a placeholder is enough.
	vi.mocked(getDatabase).mockReturnValue({} as never);
});

afterEach(async () => {
	await app?.nest.close();
});

// Feature 009 (research R2): the flows load before the Express pipeline and stop with the shutdown tasks.
test('createApp initializes the FlowManager once and unloads it on shutdown', async () => {
	const { getFlowManager } = await import('./flows.js');
	const { runShutdownTasks } = await import('./shutdown.js');
	await start();

	expect(getFlowManager().initialize).toHaveBeenCalledTimes(1);
	expect(getFlowManager().unload).not.toHaveBeenCalled();

	await runShutdownTasks();
	expect(getFlowManager().unload).toHaveBeenCalled();
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

// Feature 004: authenticate on every route like Directus (D-10 and the D-18 warning of spec 001 are gone)
describe('accountability step', () => {
	const whoami: RequestHandler = (req, res, next) =>
		req.path.toLowerCase().startsWith('/auth/x') || req.path === '/server/whoami'
			? res.json(req.accountability)
			: next();

	// Signed with another secret: 403 INVALID_TOKEN like Directus (an unknown static token is 401), no query.
	const foreign = jwt.sign({ id: 'u', role: null, app_access: false, admin_access: false }, 'other', {
		issuer: 'directus',
	});

	test.each(['/AUTH/x', '/server/whoami', '/nope'])(
		'an invalid token on %s is rejected with 403 INVALID_TOKEN',
		async (path) => {
			const agent = await start({}, { beforeRoutes: [whoami] });

			const res = await agent.get(path).set('Authorization', `Bearer ${foreign}`);
			expect(res.status).toBe(403);
			expect(res.body.errors[0].extensions.code).toBe('INVALID_TOKEN');
			expect(useLogger().warn).not.toHaveBeenCalled();
		},
	);

	test('without a token every route is public, with user agent and origin', async () => {
		const agent = await start({}, { beforeRoutes: [whoami] });
		expect((await agent.get('/auth/x')).body).toMatchObject({ user: null, role: null, admin: false });

		expect((await agent.get('/server/whoami').set('User-Agent', 'ua').set('Origin', 'o')).body).toMatchObject({
			user: null,
			role: null,
			roles: [],
			admin: false,
			app: false,
			userAgent: 'ua',
			origin: 'o',
		});

		expect(useLogger().warn).not.toHaveBeenCalled();
	});

	test('/server/ping answers before authenticate, so an invalid token is ignored there', async () => {
		const res = await (await start()).get('/server/ping').set('Authorization', `Bearer ${foreign}`);
		expect(res.status).toBe(200);
	});
});

// Feature 004: sanitizeQuery after the schema step on every route (D-12 of spec 001 now only covers `export`)
describe('query step', () => {
	const query: RequestHandler = (req, res, next) =>
		req.path === '/server/query' ? res.json(req.sanitizedQuery) : next();

	test('an invalid query is rejected with 400 INVALID_QUERY on any route', async () => {
		const agent = await start({}, { beforeRoutes: [query] });

		for (const path of ['/server/query?filter={bad', '/nope?limit=abc', '/server/info?meta=nope']) {
			const res = await agent.get(path);
			expect(res.status, path).toBe(400);
			expect(res.body.errors[0].extensions.code, path).toBe('INVALID_QUERY');
		}
	});

	test('a valid query is sanitized; no query gives an empty object', async () => {
		const agent = await start({}, { beforeRoutes: [query] });
		expect((await agent.get('/server/query?fields=id,title&limit=2&sort=-id')).body).toEqual({
			fields: ['id', 'title'],
			limit: 2,
			sort: ['-id'],
		});
		expect((await agent.get('/server/query')).body).toEqual({});
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

// Feature 002: schema step (contracts/request-pipeline.md, FR-021, FR-022)
describe('schema step', () => {
	test.each(['/server/ping', '/server/health', '/SERVER/health/'])('%s does not build the schema', async (path) => {
		await (await start()).get(path);
		expect(getSchema).not.toHaveBeenCalled();
	});

	test.each([
		['GET', '/server/info'],
		['GET', '/nope'],
		['OPTIONS', '/server/info'],
	])('%s %s gets the schema', async (method, path) => {
		await (await start())[method.toLowerCase() as 'get' | 'options'](path);
		expect(getSchema).toHaveBeenCalled();
	});

	test('a failing schema step → 500 INTERNAL_SERVER_ERROR', async () => {
		vi.mocked(getSchema).mockRejectedValueOnce(new Error('database down'));
		const res = await (await start()).get('/nope');
		expect(res.status).toBe(500);
		expect(res.body.errors[0].extensions.code).toBe('INTERNAL_SERVER_ERROR');
	});
});
