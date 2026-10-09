import { useEnv } from '@backoffice/env';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { errorHandler } from '../errors/error-handler.js';
import { useLogger } from '../logger/index.js';

vi.mock('@backoffice/env');
vi.mock('../logger/index.js');

const logger = { error: vi.fn(), debug: vi.fn(), warn: vi.fn() };

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
});

async function appWith(path: string, env: Record<string, unknown>) {
	vi.mocked(useEnv).mockReturnValue({ RATE_LIMITER_STORE: 'memory', IP_TRUST_PROXY: true, ...env });
	const { default: limiter } = await import(path);
	const app = express();
	app.set('trust proxy', true);
	app.use(limiter);
	app.get('/', (_req, res) => res.send('ok'));
	app.use(errorHandler);
	return request(app);
}

describe('IP rate limiter', () => {
	test('passes through when disabled', async () => {
		const agent = await appWith('./rate-limiter-ip.js', { RATE_LIMITER_ENABLED: false });
		for (let i = 0; i < 3; i++) expect((await agent.get('/')).status).toBe(200);
	});

	test('429 REQUESTS_EXCEEDED with Retry-After and extensions.limit/reset', async () => {
		const agent = await appWith('./rate-limiter-ip.js', {
			RATE_LIMITER_ENABLED: true,
			RATE_LIMITER_POINTS: 2,
			RATE_LIMITER_DURATION: 60,
		});
		await agent.get('/');
		await agent.get('/');
		const res = await agent.get('/');
		expect(res.status).toBe(429);
		expect(res.headers['retry-after']).toMatch(/^\d+$/);
		expect(res.body.errors[0].extensions).toMatchObject({ code: 'REQUESTS_EXCEEDED', limit: 2 });
		expect(res.body.errors[0].message).toMatch(/^Too many requests, retry after .+\.$/);
	});

	test('counts per IP', async () => {
		const agent = await appWith('./rate-limiter-ip.js', {
			RATE_LIMITER_ENABLED: true,
			RATE_LIMITER_POINTS: 1,
			RATE_LIMITER_DURATION: 60,
		});
		expect((await agent.get('/').set('X-Forwarded-For', '1.1.1.1')).status).toBe(200);
		expect((await agent.get('/').set('X-Forwarded-For', '2.2.2.2')).status).toBe(200);
		expect((await agent.get('/').set('X-Forwarded-For', '1.1.1.1')).status).toBe(429);
	});
});

describe('global rate limiter', () => {
	const exit = () => vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

	test('requires the IP rate limiter (exit 1)', async () => {
		const spy = exit();
		await appWith('./rate-limiter-global.js', {
			RATE_LIMITER_GLOBAL_ENABLED: true,
			RATE_LIMITER_ENABLED: false,
			RATE_LIMITER_GLOBAL_POINTS: 10,
			RATE_LIMITER_GLOBAL_DURATION: 1,
		});
		expect(logger.error).toHaveBeenCalledWith(
			'The IP based rate limiter needs to be enabled when using the global rate limiter.',
		);
		expect(spy).toHaveBeenCalledWith(1);
		spy.mockRestore();
	});

	test('must allow more requests per second than the IP limiter (exit 1)', async () => {
		const spy = exit();

		await appWith('./rate-limiter-global.js', {
			RATE_LIMITER_GLOBAL_ENABLED: true,
			RATE_LIMITER_ENABLED: true,
			RATE_LIMITER_POINTS: 10,
			RATE_LIMITER_DURATION: 1,
			RATE_LIMITER_GLOBAL_POINTS: 10,
			RATE_LIMITER_GLOBAL_DURATION: 1,
		});

		expect(logger.error).toHaveBeenCalledWith(
			'The global rate limiter needs to allow more requests per second than the IP based rate limiter.',
		);
		expect(spy).toHaveBeenCalledWith(1);
		spy.mockRestore();
	});

	test('429 once the global budget is used, whatever the IP', async () => {
		const agent = await appWith('./rate-limiter-global.js', {
			RATE_LIMITER_GLOBAL_ENABLED: true,
			RATE_LIMITER_ENABLED: true,
			RATE_LIMITER_POINTS: 1,
			RATE_LIMITER_DURATION: 60,
			RATE_LIMITER_GLOBAL_POINTS: 2,
			RATE_LIMITER_GLOBAL_DURATION: 1,
		});

		expect((await agent.get('/').set('X-Forwarded-For', '1.1.1.1')).status).toBe(200);
		expect((await agent.get('/').set('X-Forwarded-For', '2.2.2.2')).status).toBe(200);
		const res = await agent.get('/').set('X-Forwarded-For', '3.3.3.3');
		expect(res.status).toBe(429);
		expect(res.body.errors[0].extensions).toMatchObject({ code: 'REQUESTS_EXCEEDED', limit: 2 });
	});
});
