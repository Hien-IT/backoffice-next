// Ported from directus/tests/blackbox (router behaviour measured on Directus 11.17.4), FR-048, US2.10–US2.13.
import { describe, expect, it } from 'vitest';
import { assertParity, parity, parityStable } from '../parity.js';
import { profileUrls } from '../profiles.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';

describe('router behaviour', () => {
	it.each(['/server/ping', '/server/info', '/server/health', '/server/specs/oas'])(
		'POST %s → 404 ROUTE_NOT_FOUND, no 405',
		async (path) => {
			const result = await parity({ method: 'POST', path });
			assertParity(result);
			expect(result.backoffice.status).toBe(404);
		},
	);

	// Feature 010 (US1): /server/setup is served, so the D-14 difference is gone.
	it('POST /server/setup → 403 at both apps (already set up)', async () => {
		const result = await parity({ method: 'POST', path: '/server/setup', body: {} });
		assertParity(result);
		expect(result.directus.status).toBe(403);
		expect(result.backoffice.status).toBe(403);
	});

	it('OPTIONS /server/setup → 200 Allow: POST', async () => {
		const result = await parity({ method: 'OPTIONS', path: '/server/setup' });
		assertParity(result);
		expect(result.backoffice.status).toBe(200);
		expect(result.backoffice.headers['allow']).toBe('POST');
	});

	it.each(['/server/info', '/server/health', '/server/specs/oas'])(
		'OPTIONS %s → 200 Allow: GET,HEAD body GET,HEAD',
		async (path) => {
			const result = await parity({ method: 'OPTIONS', path });
			assertParity(result);
			expect(result.backoffice.status).toBe(200);
			expect(result.backoffice.headers['allow']).toBe('GET,HEAD');
			expect(result.backoffice.text).toBe('GET,HEAD');
		},
	);

	it.each(['/server/ping', '/', '/robots.txt'])('OPTIONS %s → 404', async (path) => {
		const result = await parity({ method: 'OPTIONS', path });
		assertParity(result);
		expect(result.backoffice.status).toBe(404);
	});

	it.each(['/server/specs/graphql'])('OPTIONS %s → D-15', async (path) => {
		const result = await parity({ method: 'OPTIONS', path });
		assertParity(result);
		expect(result.backoffice.status).toBe(404);
	});

	it.each(['/server/ping', '/server/info', '/server/health'])('HEAD %s → same headers, no body', async (path) => {
		const result = await (path === '/server/health' ? parityStable : parity)({ method: 'HEAD', path });
		assertParity(result);
		expect(result.backoffice.text).toBe('');
	});

	it.each(['/server/ping/', '/SERVER/ping', '/Server/Info', '/server/health/'])(
		'%s is served like the canonical path',
		async (path) => {
			const result = await parity({ path });
			assertParity(result);
			expect(result.backoffice.status).toBe(200);
		},
	);

	it('GET / → 302 Location: ./admin', async () => {
		const result = await parity({ path: '/' });
		assertParity(result);
		expect(result.backoffice.status).toBe(302);
		expect(result.backoffice.headers['location']).toBe('./admin');
	});

	it('GET /robots.txt (default ROBOTS_TXT)', async () => {
		const result = await parity({ path: '/robots.txt' });
		assertParity(result);
		expect(result.backoffice.text).toBe('User-agent: *\nDisallow: /');
	});

	it('GET /admin and /admin/content: Directus serves the app, Backoffice 404 (D-08)', async () => {
		for (const path of ['/admin', '/admin/content']) {
			const result = await parity({ path });
			assertParity(result);
			expect(result.backoffice.status).toBe(404);
		}
	});

	describe.runIf(suite === 'full' && profileUrls('cors-hsts'))('profile cors-hsts', () => {
		it('custom ROBOTS_TXT', async () => {
			const result = await parity({ path: '/robots.txt' }, profileUrls('cors-hsts'));
			assertParity(result);
			expect(result.backoffice.text).toBe('User-agent: parity');
		});

		it('ROOT_REDIRECT=false → GET / falls through to 404', async () => {
			const result = await parity({ path: '/' }, profileUrls('cors-hsts'));
			assertParity(result);
			expect(result.backoffice.status).toBe(404);
		});
	});
});
