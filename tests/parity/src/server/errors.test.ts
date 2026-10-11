// T050: error format and codes (FR-050, FR-051), routes not built yet (D-09.*, D-15, D-17), query and token
// checks on every route (D-10 removed, D-12 narrowed by feature 004), rate limiting on shared Redis keys (FR-046) and
// the pressure limiter (FR-045).
import { describe, expect, it } from 'vitest';
import { redisDown, redisUp } from '../docker.js';
import { assertParity, capture, parity } from '../parity.js';
import { profileUrls } from '../profiles.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';

describe('errors', () => {
	it('unknown path → 404 ROUTE_NOT_FOUND, same body', async () => {
		const result = await parity({ path: '/nope' });
		assertParity(result);
		expect(result.backoffice.json).toEqual({
			errors: [{ message: "Route /nope doesn't exist.", extensions: { path: '/nope', code: 'ROUTE_NOT_FOUND' } }],
		});
	});

	it('malformed JSON body → 400 INVALID_PAYLOAD', async () => {
		const result = await parity({
			method: 'POST',
			path: '/nope',
			body: '{bad',
			headers: { 'content-type': 'application/json' },
		});
		assertParity(result);
		expect((result.backoffice.json as any).errors[0].extensions.code).toBe('INVALID_PAYLOAD');
	});

	it('body over MAX_PAYLOAD_SIZE (1mb) → INVALID_PAYLOAD', async () => {
		const result = await parity({
			method: 'POST',
			path: '/nope',
			body: JSON.stringify({ a: 'x'.repeat(1_100_000) }),
			headers: { 'content-type': 'application/json' },
		});
		assertParity(result);
		expect((result.backoffice.json as any).errors[0].extensions.code).toBe('INVALID_PAYLOAD');
	});

	it.each(['/server/info?limit=abc', '/nope?limit=abc', '/server/info?filter={bad'])(
		'%s → 400 INVALID_QUERY on both',
		async (path) => {
			const result = await parity({ path });
			assertParity(result);
			expect((result.backoffice.json as any).errors[0].extensions.code).toBe('INVALID_QUERY');
		},
	);

	it.each([
		['GET', '/nope'],
		['POST', '/server/ping'],
	])('%s %s with an unknown token → 401 INVALID_CREDENTIALS on both', async (method, path) => {
		const result = await parity({ method, path, headers: { authorization: 'Bearer invalid' } });
		assertParity(result);
		expect(result.backoffice.status).toBe(401);
	});

	// /auth is built by feature 003 (src/auth/*.test.ts), /users, /roles, /policies, /access, /permissions by 004.
	it.each(['/items/directus_users', '/collections', '/files', '/activity', '/flows', '/settings', '/graphql'])(
		'%s is not built yet → 404 on Backoffice (D-09.*)',
		async (path) => {
			const result = await parity({ path });
			assertParity(result);
			expect(result.backoffice.status).toBe(404);
		},
	);

	it.each(['/mcp', '/ai/chat', '/deployments', '/server/specs/graphql'])(
		'%s out of scope → 404 on Backoffice (D-17, D-15)',
		async (path) => {
			const result = await parity({ path });
			assertParity(result);
			expect(result.backoffice.status).toBe(404);
		},
	);
});

describe.runIf(suite === 'full' && profileUrls('ratelimit'))('rate limiter (profile ratelimit, Redis store)', () => {
	const urls = () => profileUrls('ratelimit')!;

	it(
		'IP limit reached → 429 REQUESTS_EXCEEDED on both; counters shared through Redis (rlflx:<ip>)',
		{ timeout: 60_000 },
		async () => {
			// Both rate limiters must be connected to Redis again (an earlier test may have restarted it).
			for (let i = 0; i < 30; i++) {
				const probe = { 'x-forwarded-for': `10.250.0.${i + 1}` };
				const [d, b] = await Promise.all([
					capture(urls().directusUrl!, { path: '/server/ping', headers: probe }),
					capture(urls().backofficeUrl!, { path: '/server/ping', headers: probe }),
				]);
				if (d.status === 200 && b.status === 200) break;
				await new Promise((r) => setTimeout(r, 1000));
			}

			// A fresh IP for every run: counters live 60 s in the shared Redis.
			const ip = {
				'x-forwarded-for': `10.${Math.floor(Date.now() / 1000) % 200}.${Math.floor(Date.now() / 7) % 250}.1`,
			};

			// 10 points per IP, shared: 5 requests on each app use the whole budget.
			for (let i = 0; i < 5; i++) {
				await capture(urls().directusUrl!, { path: '/server/ping', headers: ip });
				await capture(urls().backofficeUrl!, { path: '/server/ping', headers: ip });
			}

			const result = await parity({ path: '/server/ping', headers: ip }, urls());
			assertParity(result);
			expect(result.backoffice.status).toBe(429);
			expect((result.backoffice.json as any).errors[0].extensions).toMatchObject({
				code: 'REQUESTS_EXCEEDED',
				limit: 10,
			});
			expect(result.backoffice.headers['retry-after']).toMatch(/^\d+$/);
		},
	);

	it(
		'Redis down → every request through the limiter (including /server/ping) answers 500 (FR-025)',
		{ timeout: 120_000 },
		async () => {
			redisDown();

			try {
				const result = await parity({ path: '/server/ping', headers: { 'x-forwarded-for': '10.2.2.2' } }, urls());
				assertParity(result);
				expect(result.backoffice.status).toBe(500);
				expect((result.backoffice.json as any).errors[0].extensions.code).toBe('INTERNAL_SERVER_ERROR');
			} finally {
				await redisUp();
			}
		},
	);
});

describe.runIf(suite === 'full' && profileUrls('pressure'))('pressure limiter (profile pressure)', () => {
	it('503 SERVICE_UNAVAILABLE with Retry-After; no X-Powered-By, CSP or COOP on either (FR-045)', async () => {
		const result = await parity({ path: '/server/ping' }, profileUrls('pressure'));
		assertParity(result);
		expect(result.backoffice.status).toBe(503);
		expect((result.backoffice.json as any).errors[0].extensions.code).toBe('SERVICE_UNAVAILABLE');
		expect(result.backoffice.headers['x-powered-by']).toBeUndefined();
		expect(result.backoffice.headers['content-security-policy']).toBeUndefined();
		expect(result.backoffice.headers['retry-after']).toBe('60');
	});
});
