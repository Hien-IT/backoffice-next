// FR-045, FR-104: the compared header set on every kind of response (security headers, CORS, HSTS).
import { describe, expect, it } from 'vitest';
import { assertParity, parity, parityStable } from '../parity.js';
import { profileUrls } from '../profiles.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';

describe('headers', () => {
	it.each(['/server/ping', '/server/info', '/server/health', '/nope', '/robots.txt'])(
		'%s: CSP, COOP, X-Powered-By (D-01), Content-Type, Cache-Control, Vary',
		async (path) => {
			const result = await (path === '/server/health' ? parityStable : parity)({ path });
			assertParity(result);
			expect(result.backoffice.headers['content-security-policy']).toBe(
				result.directus.headers['content-security-policy'],
			);
			expect(result.backoffice.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
			expect(result.backoffice.headers['x-powered-by']).toBe('Backoffice');
		},
	);

	describe.runIf(suite === 'full' && profileUrls('cors-hsts'))('profile cors-hsts', () => {
		it('CORS preflight and simple request; HSTS', async () => {
			const urls = profileUrls('cors-hsts');

			const preflight = await parity(
				{
					method: 'OPTIONS',
					path: '/server/info',
					headers: { origin: 'https://a.test', 'access-control-request-method': 'GET' },
				},
				urls,
			);

			assertParity(preflight);
			expect(preflight.backoffice.headers['access-control-allow-origin']).toBe('https://a.test');

			const simple = await parity({ path: '/server/ping', headers: { origin: 'https://a.test' } }, urls);
			assertParity(simple);
			expect(simple.backoffice.headers['strict-transport-security']).toBeDefined();
		});
	});
});
