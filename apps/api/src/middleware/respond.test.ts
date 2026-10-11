import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { respond } from './respond.js';

vi.mock('../database/index.js', () => ({ default: vi.fn() }));

const req = { sanitizedQuery: {} } as Request;

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
