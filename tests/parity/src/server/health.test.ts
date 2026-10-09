// Ported from directus/tests/blackbox/tests/db/routes/server/health.test.ts (public user only: the admin and
// logged-in variants wait for features 003/004, D-10; the GraphQL part waits for 011).
import { beforeAll, describe, expect, it } from 'vitest';
import { compose } from '../docker.js';
import { assertParity, capture, parity, parityStable } from '../parity.js';
import { profileUrls } from '../profiles.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';

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
				compose('stop', 'redis');

				try {
					const result = await parity({ path: '/server/health', timeoutMs: 15_000 });
					assertParity(result);
					expect(result.directus.status).toBe(0);
					expect(result.backoffice.status).toBe(0);
				} finally {
					compose('start', 'redis');
					await new Promise((r) => setTimeout(r, 3000));
				}
			},
		);

		it.runIf(suite === 'full')('database down → 503 {"status":"error"} on both', { timeout: 120_000 }, async () => {
			compose('stop', 'postgres');

			try {
				const result = await parity({ path: '/server/health' });
				assertParity(result);
				expect(result.backoffice.status).toBe(503);
				expect(result.backoffice.json).toEqual({ status: 'error' });
			} finally {
				compose('start', 'postgres');
				await new Promise((r) => setTimeout(r, 5000));
			}
		});
	});
});
