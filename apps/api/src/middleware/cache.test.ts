// Backoffice: directus/api/src/middleware/cache.ts has no test; these cases cover every branch (T030).
import { useEnv } from '@backoffice/env';
import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getCache, getCacheValue } from '../cache.js';
import { useLogger } from '../logger/index.js';
import { getCacheKey } from '../utils/get-cache-key.js';
import checkCacheMiddleware from './cache.js';

vi.mock('@backoffice/env');
vi.mock('../cache.js');
vi.mock('../logger/index.js');
vi.mock('../utils/get-cache-key.js');

const logger = { warn: vi.fn() };
const cache = {};

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(getCache).mockReturnValue({ cache } as any);
	vi.mocked(getCacheKey).mockResolvedValue('key');
	vi.mocked(useEnv).mockReturnValue({ CACHE_ENABLED: true, CACHE_STATUS_HEADER: 'x-cache-status', CACHE_TTL: '5m' });
});

function run(req: Partial<Request> = {}, locals: Record<string, unknown> = {}) {
	const res = { setHeader: vi.fn(), json: vi.fn(), locals } as unknown as Response & { setHeader: any; json: any };
	const next = vi.fn() as NextFunction;
	const request = { method: 'GET', originalUrl: '/items/a', get: vi.fn(), ...req } as unknown as Request;

	return new Promise<{ res: typeof res; next: any }>((resolve) => {
		const done = (() => resolve({ res, next })) as any;
		vi.mocked(next).mockImplementation(done);
		res.json.mockImplementation(done);
		checkCacheMiddleware(request, res, next);
	});
}

test('getCache() runs on every request (system caches, feature 002)', async () => {
	await run({ method: 'POST' });
	expect(getCache).toHaveBeenCalledOnce();
});

describe('passes through without reading', () => {
	test.each([
		['a method other than GET', { method: 'POST' }, { CACHE_ENABLED: true }],
		['CACHE_ENABLED=false', {}, { CACHE_ENABLED: false }],
	])('%s', async (_name, req, env) => {
		vi.mocked(useEnv).mockReturnValue(env);
		const { res, next } = await run(req);
		expect(next).toHaveBeenCalledWith();
		expect(getCacheKey).not.toHaveBeenCalled();
		expect(res.setHeader).not.toHaveBeenCalled();
	});

	test('no cache instance', async () => {
		vi.mocked(getCache).mockReturnValue({ cache: null } as any);
		const { next } = await run();
		expect(next).toHaveBeenCalledWith();
		expect(getCacheKey).not.toHaveBeenCalled();
	});
});

test('skipCacheRead of the collection toggles guard → MISS without reading (spec 024, D-188.4)', async () => {
	const { res, next } = await run({ method: 'POST', originalUrl: '/graphql' }, { skipCacheRead: true });
	expect(res.setHeader).toHaveBeenCalledWith('x-cache-status', 'MISS');
	expect(getCacheKey).not.toHaveBeenCalled();
	expect(getCacheValue).not.toHaveBeenCalled();
	expect(next).toHaveBeenCalledWith();
});

test('skip (Cache-Control: no-store with CACHE_SKIP_ALLOWED) → MISS without reading', async () => {
	vi.mocked(useEnv).mockReturnValue({
		CACHE_ENABLED: true,
		CACHE_STATUS_HEADER: 'x-cache-status',
		CACHE_SKIP_ALLOWED: true,
	});
	const { res, next } = await run({
		get: vi.fn((name: string) => (name === 'cache-control' ? 'no-store' : undefined)) as any,
	});
	expect(res.setHeader).toHaveBeenCalledWith('x-cache-status', 'MISS');
	expect(getCacheKey).not.toHaveBeenCalled();
	expect(next).toHaveBeenCalledWith();
});

test('a read error → warn and MISS', async () => {
	vi.mocked(getCacheValue).mockRejectedValueOnce(new Error('down'));
	const { res, next } = await run();
	expect(logger.warn).toHaveBeenCalledWith(expect.any(Error), "[cache] Couldn't read key key. down");
	expect(res.setHeader).toHaveBeenCalledWith('x-cache-status', 'MISS');
	expect(next).toHaveBeenCalledWith();
});

test('a read error of the expiry key → warn and MISS', async () => {
	vi.mocked(getCacheValue).mockResolvedValueOnce({ data: 1 }).mockRejectedValueOnce(new Error('down'));
	const { res, next } = await run();
	expect(logger.warn).toHaveBeenCalledWith(expect.any(Error), "[cache] Couldn't read key key__expires_at. down");
	expect(res.setHeader).toHaveBeenCalledWith('x-cache-status', 'MISS');
	expect(next).toHaveBeenCalledWith();
});

test('HIT: cached body, Cache-Control from the time left, Vary, status header; the route does not run', async () => {
	vi.mocked(getCacheValue)
		.mockResolvedValueOnce({ data: [1] })
		.mockResolvedValueOnce({ exp: Date.now() + 60_000 });
	const { res, next } = await run();
	expect(res.json).toHaveBeenCalledWith({ data: [1] });
	expect(next).not.toHaveBeenCalled();
	expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringMatching(/^public, max-age=(59|60)$/));
	expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Origin, Cache-Control');
	expect(res.setHeader).toHaveBeenCalledWith('x-cache-status', 'HIT');
});

test('HIT without an expiry key → no-cache', async () => {
	vi.mocked(getCacheValue)
		.mockResolvedValueOnce({ data: [1] })
		.mockResolvedValueOnce(undefined);
	const { res } = await run();
	expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
});

test('MISS: status header, the route runs', async () => {
	vi.mocked(getCacheValue).mockResolvedValueOnce(undefined);
	const { res, next } = await run();
	expect(res.setHeader).toHaveBeenCalledWith('x-cache-status', 'MISS');
	expect(next).toHaveBeenCalledWith();
});

test('no CACHE_STATUS_HEADER → no status header', async () => {
	vi.mocked(useEnv).mockReturnValue({ CACHE_ENABLED: true });
	vi.mocked(getCacheValue).mockResolvedValueOnce(undefined);
	const { res } = await run();
	expect(res.setHeader).not.toHaveBeenCalled();
});
