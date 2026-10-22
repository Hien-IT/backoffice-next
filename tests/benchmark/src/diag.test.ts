import { describe, expect, test, vi } from 'vitest';

vi.mock('./redis.ts', () => ({ redis: {} }));

const { diagLine } = await import('./diag.ts');

describe('diagLine', () => {
	test('CPU ms and Redis GETs per request', () => {
		const line = diagLine(
			'presets-list @64',
			'backoffice',
			{ cpuUsec: 1_000, redisGets: 10 },
			{ cpuUsec: 41_000, redisGets: 90 },
			20,
		);
		expect(line).toBe('diag presets-list @64 backoffice requests=20 cpu_ms_per_req=2.000 redis_get_per_req=4.000\n');
	});

	test('n/a without a CPU reading or requests', () => {
		expect(diagLine('x', 'directus', { cpuUsec: null, redisGets: 0 }, { cpuUsec: 5, redisGets: 0 }, 3)).toContain(
			'cpu_ms_per_req=n/a',
		);
		expect(diagLine('x', 'directus', { cpuUsec: 1, redisGets: 0 }, { cpuUsec: 5, redisGets: 2 }, 0)).toContain(
			'redis_get_per_req=n/a',
		);
	});
});
