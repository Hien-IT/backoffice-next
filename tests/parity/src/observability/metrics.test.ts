// T088, US5, contracts/observability.md §2: /metrics on the `metrics` profile pair (METRICS_ENABLED, a 5 s schedule).
// Metric values differ by nature (FR-103 compares names and help texts only).
import { describe, expect, it } from 'vitest';
import { assertParity, capture, parity } from '../parity.js';
import { profileUrls } from '../profiles.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';
const TOKEN = { authorization: 'Metrics parity-metrics-token' };

/** `# HELP` and `# TYPE` lines: metric names, help texts and types, without values. */
const descriptors = (text: string) =>
	text
		.split('\n')
		.filter((l) => l.startsWith('# '))
		.sort();

describe('/metrics disabled (main pair)', () => {
	it.each(['GET', 'OPTIONS'])('%s /metrics → 404 ROUTE_NOT_FOUND on both', async (method) => {
		const result = await parity({ method, path: '/metrics', headers: TOKEN });
		assertParity(result);
		expect(result.backoffice.status).toBe(404);
	});
});

describe.runIf(suite === 'full' && profileUrls('metrics'))('/metrics enabled (profile metrics)', () => {
	const urls = () => profileUrls('metrics')!;

	it('after a schedule run: same metric names, help texts and types; FR-104 headers', { timeout: 60_000 }, async () => {
		// Wait until both processes generated once (the error counters appear on the first run).
		let d = '';
		let b = '';

		for (let i = 0; i < 30; i++) {
			[d, b] = await Promise.all([
				capture(urls().directusUrl!, { path: '/metrics', headers: TOKEN }).then((r) => r.text),
				capture(urls().backofficeUrl!, { path: '/metrics', headers: TOKEN }).then((r) => r.text),
			]);
			if (d.includes('connection_errors') && b.includes('connection_errors')) break;
			await new Promise((r) => setTimeout(r, 1000));
		}

		expect(descriptors(d).length).toBeGreaterThan(0);
		expect(descriptors(b)).toEqual(descriptors(d));

		const result = await parity({ path: '/metrics', headers: TOKEN }, urls());
		expect(result.backoffice.status).toBe(200);
		expect(result.differences.filter((x) => x.kind !== 'body')).toEqual([]);
		expect(result.backoffice.headers['content-type']).toBe('text/plain; charset=utf-8');
		expect(result.backoffice.headers['vary']).toBe('Origin, Cache-Control');
		expect(result.backoffice.headers['cache-control']).toBe('no-cache');
	});

	it('OPTIONS /metrics → 200 Allow: GET,HEAD', async () => {
		const result = await parity({ method: 'OPTIONS', path: '/metrics' }, urls());
		assertParity(result);
		expect(result.backoffice.headers['allow']).toBe('GET,HEAD');
	});

	it('HEAD /metrics with the token → 200, no body', async () => {
		const result = await parity({ method: 'HEAD', path: '/metrics', headers: TOKEN }, urls());
		expect(result.differences.filter((x) => x.kind !== 'body')).toEqual([]);
		expect(result.backoffice.status).toBe(200);
		expect(result.backoffice.text).toBe('');
	});

	it.each([{}, { authorization: 'Metrics wrong' }, { authorization: 'Basic abc' }])(
		'no or wrong Metrics token %o → 403 FORBIDDEN on both',
		async (headers) => {
			const result = await parity({ path: '/metrics', headers }, urls());
			assertParity(result);
			expect(result.backoffice.status).toBe(403);
			expect((result.backoffice.json as any).errors[0].extensions.code).toBe('FORBIDDEN');
		},
	);

	it('Bearer token → Directus 401, Backoffice 403 (D-10)', async () => {
		const result = await parity({ path: '/metrics', headers: { authorization: 'Bearer invalid' } }, urls());
		assertParity(result);
		expect(result.accepted.map((a) => a.id)).toContain('D-10');
	});

	it('?access_token= → Directus 401, Backoffice 403 (D-10)', async () => {
		const result = await parity({ path: '/metrics?access_token=invalid' }, urls());
		assertParity(result);
		expect(result.backoffice.status).toBe(403);
	});

	it('/metrics?limit=abc → Directus 400 INVALID_QUERY, Backoffice ignores the query (D-12)', async () => {
		const result = await parity({ path: '/metrics?limit=abc', headers: TOKEN }, urls());
		assertParity(result);
		expect(result.accepted.map((a) => a.id)).toContain('D-12');
	});
});
