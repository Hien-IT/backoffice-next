// FR-048, US2.11: If-None-Match matching the ETag → 304, measured on Directus.
import { describe, expect, it } from 'vitest';
import { assertParity, capture, parity, parityStable } from '../parity.js';

describe('conditional requests', () => {
	it.each(['/server/ping', '/server/info', '/server/health'])('%s → 304 with the ETag', async (path) => {
		const first = await capture(process.env['DIRECTUS_URL']!, { path });
		const etag = first.headers['etag']!;
		expect(etag).toMatch(/^W\//);

		const result = await (path === '/server/health' ? parityStable : parity)({
			path,
			headers: { 'if-none-match': etag },
		});
		assertParity(result);
		expect(result.backoffice.status).toBe(304);
		expect(result.backoffice.headers['etag']).toBe(etag);
	});
});
