import { useEnv } from '@backoffice/env';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { getCache, setCacheValue } from '../cache.js';
import { useLogger } from '../logger/index.js';
import { getCacheKey } from '../utils/get-cache-key.js';
import { permissionsCacheable } from '../utils/permissions-cacheable.js';
import { respond } from './respond.js';

// An empty env at import time: the services behind respond (export) read it when their module loads.
vi.mock('@backoffice/env', () => ({ useEnv: vi.fn(() => ({})) }));
vi.mock('../cache.js');
vi.mock('../database/index.js', () => ({ default: vi.fn() }));
vi.mock('../logger/index.js');
vi.mock('../utils/get-cache-key.js');
vi.mock('../utils/permissions-cacheable.js');

const logger = { warn: vi.fn() };
const cache = { name: 'data cache' };

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useEnv).mockReturnValue({ CACHE_TTL: '5m', CACHE_VALUE_MAX_SIZE: false });
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(getCache).mockReturnValue({ cache: null } as any);
	vi.mocked(getCacheKey).mockResolvedValue('key');
	vi.mocked(permissionsCacheable).mockResolvedValue(true);
});

const req = { method: 'GET', originalUrl: '/items/a', sanitizedQuery: {}, get: vi.fn() } as unknown as Request;

function res(payload: unknown) {
	const r: any = { locals: { payload }, setHeader: vi.fn(), json: vi.fn(), end: vi.fn() };
	r.status = vi.fn(() => r);
	return r;
}

test('JSON payload, Buffer payload, no payload (204); always no-cache and Vary', async () => {
	const json = res({ a: 1 });
	await respond(req, json);
	expect(json.json).toHaveBeenCalledWith({ a: 1 });
	expect(json.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
	expect(json.setHeader).toHaveBeenCalledWith('Vary', 'Origin, Cache-Control');

	const buffer = res(Buffer.from('x'));
	await respond(req, buffer);
	expect(buffer.end).toHaveBeenCalledWith(Buffer.from('x'));

	const empty = res(undefined);
	await respond(req, empty);
	expect(empty.status).toHaveBeenCalledWith(204);
});

describe('response cache (spec FR-012, contracts/cache.md §5)', () => {
	const env = {
		CACHE_ENABLED: true,
		CACHE_TTL: '5m',
		CACHE_VALUE_MAX_SIZE: false,
		CACHE_CONTROL_S_MAXAGE: 0,
		CACHE_AUTO_PURGE: false,
	};

	beforeEach(() => {
		vi.mocked(useEnv).mockReturnValue(env);
		vi.mocked(getCache).mockReturnValue({ cache } as any);
	});

	const get = (extra: Record<string, unknown> = {}) =>
		({ ...req, collection: 'a', schema: {}, ...extra }) as unknown as Request;

	test('GET: stores the payload for CACHE_TTL and its expiry, public without role, private with one', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);
		const r = res({ data: [1] });
		await respond(get(), r);

		expect(setCacheValue).toHaveBeenCalledWith(cache, 'key', { data: [1] }, 300_000);
		expect(setCacheValue).toHaveBeenCalledWith(cache, 'key__expires_at', { exp: 301_000 });
		expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300, s-maxage=0');
		expect(r.setHeader).toHaveBeenCalledWith('Vary', 'Origin, Cache-Control');
		expect(r.json).toHaveBeenCalledWith({ data: [1] });
		expect(permissionsCacheable).toHaveBeenCalledWith('a', { knex: undefined, schema: {} }, undefined);

		const withRole = res({ data: [1] });
		await respond(get({ accountability: { role: 'r' } }), withRole);
		expect(withRole.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=300, s-maxage=0');
		vi.mocked(Date.now).mockRestore();
	});

	test.each([
		['a method other than GET', { method: 'POST' }, {}],
		['a path under /auth', { originalUrl: '/auth/login' }, {}],
		['CACHE_ENABLED=false', {}, { CACHE_ENABLED: false }],
		['export', { sanitizedQuery: { export: 'json' } }, {}],
		['res.locals.cache = false', {}, {}, false],
		['a payload above CACHE_VALUE_MAX_SIZE', {}, { CACHE_VALUE_MAX_SIZE: '5b' }],
	])('not stored: %s → no-cache', async (_name, extra, envExtra, localsCache?: boolean) => {
		vi.mocked(useEnv).mockReturnValue({ ...env, ...envExtra });
		const r = res({ data: [1] });
		if (localsCache === false) r.locals.cache = false;
		r.attachment = vi.fn();
		r.set = vi.fn();
		r.send = vi.fn();

		await respond(get(extra), r);

		expect(setCacheValue).not.toHaveBeenCalled();
		expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
	});

	test('not stored: no data cache', async () => {
		vi.mocked(getCache).mockReturnValue({ cache: null } as any);
		const r = res({ data: [1] });
		await respond(get(), r);
		expect(setCacheValue).not.toHaveBeenCalled();
		expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
	});

	test('not stored: read permissions with $NOW (permissionsCacheable false)', async () => {
		vi.mocked(permissionsCacheable).mockResolvedValue(false);
		const r = res({ data: [1] });
		await respond(get(), r);
		expect(setCacheValue).not.toHaveBeenCalled();
		expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
	});

	test('CACHE_VALUE_MAX_SIZE that bytes cannot parse → no limit', async () => {
		vi.mocked(useEnv).mockReturnValue({ ...env, CACHE_VALUE_MAX_SIZE: 'lots' });
		await respond(get(), res({ data: [1] }));
		expect(setCacheValue).toHaveBeenCalledTimes(2);
	});

	test('a write error → warn, the response is still sent', async () => {
		const error = new Error('down');
		vi.mocked(setCacheValue).mockRejectedValueOnce(error);
		const r = res({ data: [1] });
		await respond(get(), r);
		expect(logger.warn).toHaveBeenCalledWith(error, "[cache] Couldn't set key key. Error: down");
		expect(r.json).toHaveBeenCalledWith({ data: [1] });
	});

	test('CACHE_AUTO_PURGE=true: stored, no-cache', async () => {
		vi.mocked(useEnv).mockReturnValue({ ...env, CACHE_AUTO_PURGE: true });
		const r = res({ data: [1] });
		await respond(get(), r);
		expect(setCacheValue).toHaveBeenCalledTimes(2);
		expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
	});

	test('Cache-Control: no-store with CACHE_SKIP_ALLOWED: stored, no-store', async () => {
		vi.mocked(useEnv).mockReturnValue({ ...env, CACHE_SKIP_ALLOWED: true });
		const r = res({ data: [1] });
		await respond(get({ get: vi.fn((name: string) => (name === 'cache-control' ? 'no-store' : undefined)) }), r);
		expect(setCacheValue).toHaveBeenCalledTimes(2);
		expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
	});

	test('res.locals.cacheInstance and cacheTTL: own instance, no global settings (assets, feature 007)', async () => {
		vi.mocked(useEnv).mockReturnValue({ ...env, CACHE_ENABLED: false, CACHE_AUTO_PURGE: true });
		const own = { name: 'own' };
		const r = res({ data: [1] });
		r.locals.cacheInstance = own;
		r.locals.cacheTTL = 10_000;

		await respond(get({ method: 'POST' }), r);

		expect(setCacheValue).toHaveBeenCalledWith(own, 'key', { data: [1] }, 10_000);
		expect(permissionsCacheable).not.toHaveBeenCalled();
		expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=10');
	});

	test('res.locals.cacheTTL alone: header only, nothing stored', async () => {
		vi.mocked(useEnv).mockReturnValue({ ...env, CACHE_ENABLED: false });
		const r = res({ data: [1] });
		r.locals.cacheTTL = 10_000;
		await respond(get(), r);
		expect(setCacheValue).not.toHaveBeenCalled();
		expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=10');
	});
});

describe('export (spec FR-020, FR-021)', () => {
	// 2026-01-02 09:05:30 local time: getDateTimeFormatted() pads month and day, not hours, minutes, seconds.
	beforeAll(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(2026, 0, 2, 9, 5, 30));
	});

	afterAll(() => vi.useRealTimers());

	function app(payload: unknown, collection?: string) {
		const a = express();

		a.all('/', (r: Request, s: Response, next: NextFunction) => {
			r.sanitizedQuery = { export: r.query['export'] as any };
			if (collection) r.collection = collection;
			s.locals['payload'] = payload;
			respond(r, s).catch(next);
		});

		a.use((error: Error, _r: Request, s: Response, _next: NextFunction) => {
			s.status(500).json({ message: error.message });
		});

		return a;
	}

	const data = { data: [{ id: 1, title: 'a' }] };

	test.each([
		['json', 'json', 'application/json; charset=utf-8', '[\n\t{\n\t\t"id": 1,\n\t\t"title": "a"\n\t}\n]'],
		['xml', 'xml', 'text/xml; charset=utf-8', "<?xml version='1.0'?>"],
		['csv', 'csv', 'text/csv; charset=utf-8', '"id","title"\n1,"a"'],
		['csv_utf8', 'csv', 'text/csv; charset=utf-8', '﻿"id","title"\n1,"a"'],
		['yaml', 'yaml', 'text/yaml; charset=utf-8', '- id: 1\n  title: a\n'],
	])('%s: attachment "<collection> <YYYYMMDD-HMS>.%s", type, body of transform', async (format, ext, type, body) => {
		const response = await request(app(data, 'articles')).get(`/?export=${format}`);

		expect(response.status).toBe(200);
		expect(response.headers['content-disposition']).toBe(`attachment; filename="articles 20260102-9530.${ext}"`);
		expect(response.headers['content-type']).toBe(type);
		expect(response.headers['cache-control']).toBe('no-cache');
		expect(response.text.startsWith(body)).toBe(true);
	});

	test('no collection: Export <YYYYMMDD-HMS>', async () => {
		const response = await request(app(data)).get('/?export=json');
		expect(response.headers['content-disposition']).toBe('attachment; filename="Export 20260102-9530.json"');
	});

	test('no payload: 200 with null for json, the TypeError of transform for csv (headers already set)', async () => {
		const json = await request(app(undefined, 'articles')).get('/?export=json');
		expect(json.status).toBe(200);
		expect(json.text).toBe('null');

		const csv = await request(app(undefined, 'articles')).get('/?export=csv');
		expect(csv.status).toBe(500);
		// res.json keeps the Content-Type already set, so the error body arrives as text/csv.
		expect(JSON.parse(csv.text).message).toMatch(/reading 'length'/);
		expect(csv.headers['content-disposition']).toBe('attachment; filename="articles 20260102-9530.csv"');
		expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');
	});

	test('HEAD: same headers, no body', async () => {
		const response = await request(app(data, 'articles')).head('/?export=csv');
		expect(response.status).toBe(200);
		expect(response.headers['content-disposition']).toBe('attachment; filename="articles 20260102-9530.csv"');
		expect(response.text).toBeUndefined();
	});
});
