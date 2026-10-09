// T088, US5, contracts/observability.md §1: HTTP log lines with LOG_STYLE=raw on the `metrics` profile pair.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { logs } from '../docker.js';
import { capture } from '../parity.js';
import { profileUrls } from '../profiles.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';

/** Fields that differ by nature between two processes. */
const SKIPPED = new Set(['time', 'pid', 'hostname', 'req.remotePort', 'responseTime', 'req.id']);

/** Recursive key paths of a log line (values are not compared). */
function keyPaths(value: unknown, prefix = ''): string[] {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];

	return Object.entries(value)
		.flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k))
		.filter((p) => !SKIPPED.has(p))
		.sort();
}

/** The HTTP log line of the request carrying `probe`, from the container logs. */
async function httpLine(service: string, probe: string): Promise<any> {
	for (let i = 0; i < 20; i++) {
		const line = logs(service)
			.split('\n')
			.filter((l) => l.startsWith('{'))
			.map((l) => JSON.parse(l))
			.find((l) => l.req?.query?.probe === probe);

		if (line) return line;
		await new Promise((r) => setTimeout(r, 500));
	}

	throw new Error(`No HTTP log line for probe ${probe} in ${service}`);
}

describe.runIf(suite === 'full' && profileUrls('metrics'))('HTTP log lines (LOG_STYLE=raw)', () => {
	const urls = () => profileUrls('metrics')!;

	it.each([
		[
			'Authorization and Cookie headers',
			{ authorization: 'Bearer log-secret-1', cookie: 'directus_session_token=log-secret-2' },
			'',
		],
		['?access_token=', {}, '&access_token=log-secret-3'],
	])('%s: same key set as Directus, values redacted', { timeout: 30_000 }, async (_label, headers, query) => {
		const probe = randomUUID();
		const req = { path: `/server/ping?probe=${probe}${query}`, headers };

		await capture(urls().directusUrl!, req);
		await capture(urls().backofficeUrl!, req);

		const [d, b] = [await httpLine('directus-metrics', probe), await httpLine('backoffice-api-metrics', probe)];

		expect(keyPaths(b)).toEqual(keyPaths(d));
		expect(b.msg).toBe(d.msg);
		expect(b.res.statusCode).toBe(d.res.statusCode);
		expect(b.req.url).toBe(d.req.url);

		if ('authorization' in headers) {
			expect(b.req.headers.authorization).toBe('--redacted--');
			expect(b.req.headers.cookie).toBe('--redacted--');
		} else {
			expect(b.req.query.access_token).toBe('--redacted--');
			expect(b.req.url).toContain('access_token=--redacted--');
		}

		expect(logs('backoffice-api-metrics')).not.toMatch(/log-secret-\d/);
	});
});
