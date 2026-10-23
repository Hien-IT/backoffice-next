// T086, contracts/observability.md §1: HTTP log lines and logger options, as in DR 11.17.4.
import { useEnv } from '@backoffice/env';
import express from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createExpressLogger, createLogger } from './index.js';

vi.mock('@backoffice/env');

let lines: string[] = [];

beforeEach(() => {
	lines = [];
	vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
		lines.push(String(chunk));
		return true;
	});
});

afterEach(() => vi.restoreAllMocks());

function app(env: Record<string, unknown>) {
	vi.mocked(useEnv).mockReturnValue(env);
	const a = express();
	a.use(createExpressLogger());
	a.get('/*path', (_req, res) => res.cookie('session', 'cookie-secret').json({ ok: true }));
	return request(a);
}

const json = () => lines.map((l) => JSON.parse(l));

describe('LOG_STYLE=raw', () => {
	test('one JSON line per request with req.id, method, url, statusCode, responseTime', async () => {
		await app({ LOG_STYLE: 'raw' }).get('/server/info');
		expect(lines).toHaveLength(1);
		const [line] = json();
		expect(line).toMatchObject({
			level: 30,
			msg: 'request completed',
			req: { id: expect.any(Number), method: 'GET', url: '/server/info' },
			res: { statusCode: 200 },
			responseTime: expect.any(Number),
		});
	});

	test('credentials are redacted: Authorization, Cookie, ?access_token= (query and url), Set-Cookie', async () => {
		await app({ LOG_STYLE: 'raw' })
			.get('/server/ping?access_token=query-secret&x=1')
			.set('Authorization', 'Bearer header-secret')
			.set('Cookie', 'directus_session_token=cookie-in');

		const [line] = json();
		expect(line.req.headers.authorization).toBe('--redacted--');
		expect(line.req.headers.cookie).toBe('--redacted--');
		expect(line.req.query.access_token).toBe('--redacted--');
		expect(line.req.query.x).toBe('1');
		expect(line.req.url).toBe('/server/ping?access_token=--redacted--&x=1');
		expect(line.res.headers['set-cookie']).toBe('--redacted--');

		for (const secret of ['query-secret', 'header-secret', 'cookie-in', 'cookie-secret']) {
			expect(lines.join('')).not.toContain(secret);
		}
	});

	test('request ids are increasing numbers; X-Request-Id is neither read nor returned', async () => {
		const agent = app({ LOG_STYLE: 'raw' });
		const res = await agent.get('/a').set('X-Request-Id', 'from-client');
		await agent.get('/b');
		const [first, second] = json();
		expect(typeof first.req.id).toBe('number');
		expect(second.req.id).toBe(first.req.id + 1);
		expect(res.headers['x-request-id']).toBeUndefined();
	});

	test('LOG_LEVEL=warn drops the info request lines', async () => {
		await app({ LOG_STYLE: 'raw', LOG_LEVEL: 'warn' }).get('/server/ping');
		expect(lines).toEqual([]);
	});

	test('LOG_HTTP_IGNORE_PATHS skips the listed pathnames (query ignored)', async () => {
		const agent = app({ LOG_STYLE: 'raw', LOG_HTTP_IGNORE_PATHS: ['/server/ping'] });
		await agent.get('/server/ping?x=1');
		await agent.get('/server/info');
		expect(json().map((l) => l.req.url)).toEqual(['/server/info']);
	});

	test('LOGGER_LEVELS adds a severity field', async () => {
		await app({ LOG_STYLE: 'raw', LOGGER_LEVELS: 'info:INFO,warn:WARNING' }).get('/x');
		expect(json()[0]).toMatchObject({ severity: 'INFO', level: 30 });
	});
});

describe('default LOG_STYLE', () => {
	test('Authorization and Cookie are still redacted, the line is human readable (pino-http-print)', async () => {
		await app({}).get('/x').set('Authorization', 'Bearer header-secret');
		const output = lines.join('');
		expect(output).toContain('GET');
		expect(output).toContain('/x');
		expect(output).not.toContain('header-secret');
		expect(() => JSON.parse(lines[0]!)).toThrow();
	});

	test('the main logger writes through pino-pretty, not raw stdout; raw writes JSON to stdout', () => {
		const multistream = vi.spyOn(pino, 'multistream');

		vi.mocked(useEnv).mockReturnValue({});
		createLogger();
		expect(multistream.mock.calls[0]![0]).not.toEqual([expect.objectContaining({ stream: process.stdout })]);

		vi.mocked(useEnv).mockReturnValue({ LOG_STYLE: 'raw', LOG_LEVEL: 'debug' });
		createLogger().info({ secret: undefined }, 'hello');
		expect(multistream.mock.calls[1]![0]).toEqual([{ level: 'debug', stream: process.stdout }]);
		expect(json().at(-1)).toMatchObject({ level: 30, msg: 'hello' });
	});

	test('main logger: LOGGER_LEVELS severity and Authorization redaction', () => {
		vi.mocked(useEnv).mockReturnValue({ LOG_STYLE: 'raw', LOGGER_LEVELS: 'warn:WARNING' });
		createLogger().warn({ req: { headers: { authorization: 'Bearer x-secret' } } }, 'w');
		const line = json().at(-1);
		expect(line.severity).toBe('WARNING');
		expect(line.req.headers.authorization).toBe('--redacted--');
	});
});
