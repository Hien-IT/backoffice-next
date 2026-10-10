// Ported from directus/tests/blackbox/tests/db/routes/server/health.test.ts (public user only: the admin and
// logged-in variants wait for features 003/004, D-10; the GraphQL part waits for 011).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compose, redisDown, redisUp } from '../docker.js';
import { assertParity, capture, parity, parityStable } from '../parity.js';
import { profileUrls } from '../profiles.js';
import { closeRedis, redis } from '../redis.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';

afterAll(() => closeRedis());

describe('/server', () => {
	describe('GET /health', () => {
		beforeAll(async () => {
			// Warm both apps up: a cold first query can exceed the 150 ms DB threshold and report warn.
			for (let i = 0; i < 3; i++) {
				await capture(process.env['DIRECTUS_URL']!, { path: '/server/health' });
				await capture(process.env['BACKOFFICE_URL']!, { path: '/server/health' });
			}
		});

		it('public: 200 application/health+json {"status":"ok"} no-cache', async () => {
			const result = await parityStable({ path: '/server/health' });
			assertParity(result);
			expect(result.backoffice.status).toBe(200);
			expect(result.backoffice.headers['content-type']).toMatch(/^application\/health\+json/);
			expect(result.backoffice.json).toEqual({ status: 'ok' });
			expect(result.backoffice.headers['cache-control']).toBe('no-cache');
			expect(result.backoffice.headers['vary']).toBe('Origin, Cache-Control');
		});

		it('with an invalid token: Directus 401, Backoffice answers as public (D-10)', async () => {
			const result = await parity({ path: '/server/health', headers: { authorization: 'Bearer invalid-token' } });
			assertParity(result);
			expect(result.directus.status).toBe(401);
			expect(result.backoffice.json).toEqual({ status: 'ok' });
			expect(result.accepted.some((d) => d.id === 'D-10')).toBe(true);
		});

		it.runIf(suite === 'full' && profileUrls('ratelimit'))(
			'rate limiter thresholds very low → warn on both',
			async () => {
				const result = await parity(
					{ path: '/server/health', headers: { 'x-forwarded-for': '10.9.9.9' } },
					profileUrls('ratelimit'),
				);
				assertParity(result);
				expect(result.backoffice.json).toEqual({ status: 'warn' });
			},
		);

		it.runIf(suite === 'full')(
			'Redis down with CACHE_STORE=redis → neither app answers (measured on Directus 11.17.4, FR-025)',
			{ timeout: 120_000 },
			async () => {
				// Directus runs the schema step on /server/health: without a schema in memory (an earlier test emptied
				// it) it needs Redis and fails at once (D-13). Build it in every process first, as when this was measured.
				for (const url of [process.env['DIRECTUS_URL']!, process.env['BACKOFFICE_URL']!]) {
					await capture(url, { path: '/server/info' });
				}

				redisDown();

				try {
					const result = await parity({ path: '/server/health', timeoutMs: 15_000 });
					assertParity(result);
					expect(result.directus.status).toBe(0);
					expect(result.backoffice.status).toBe(0);
				} finally {
					await redisUp();
					await new Promise((r) => setTimeout(r, 3000));
				}
			},
		);

		it.runIf(suite === 'full')('database down → 503 {"status":"error"} on both', { timeout: 240_000 }, async () => {
			// Feature 002: empty the schema cache of every process first, so the routes after the schema step have to
			// build it while the database is down (FR-021, US3.2). /server/health skips that step (D-13).
			await redis().publish('directus:bus:schemaChanged', '{}');
			await new Promise((r) => setTimeout(r, 200));
			compose('stop', 'postgres');

			try {
				const result = await parity({ path: '/server/health' });
				assertParity(result);
				expect(result.backoffice.status).toBe(503);
				expect(result.backoffice.json).toEqual({ status: 'error' });

				// D-13 narrowed by feature 002: every other route builds the schema and fails like Directus.
				for (const path of ['/server/info', '/parity-unknown-path']) {
					const other = await parity({ path, timeoutMs: 60_000 });
					assertParity(other);
					expect(other.backoffice.status, path).toBe(500);
					expect((other.backoffice.json as any).errors[0].extensions.code).toBe('INTERNAL_SERVER_ERROR');
				}
			} finally {
				compose('start', 'postgres');
				await new Promise((r) => setTimeout(r, 5000));
			}
		});
	});
});
