import { describe, expect, test } from 'vitest';
import {
	compare,
	createLatencyHistogram,
	gatePasses,
	median,
	percentile,
	recordLatency,
	table,
	type Round,
} from './compare.ts';

const round = (p95: number, rps: number, errors = 0): Round => ({ p95, rps, errors });
const same = [round(10, 1000), round(12, 900), round(11, 950)];

describe('median', () => {
	test('odd and even counts; order does not matter', () => {
		expect(median([3, 1, 2])).toBe(2);
		expect(median([4, 1, 3, 2])).toBe(2.5);
		expect(() => median([])).toThrow();
	});
});

describe('percentile from the histogram', () => {
	test('p95 of 1..100 ms is 95 ms; sub-millisecond times keep their precision', () => {
		const h = createLatencyHistogram();
		for (let ms = 1; ms <= 100; ms++) recordLatency(h, ms);
		expect(percentile(h, 95)).toBeCloseTo(95, 0);

		const fast = createLatencyHistogram();
		for (let i = 0; i < 100; i++) recordLatency(fast, 0.25);
		expect(percentile(fast, 95)).toBeCloseTo(0.25, 2);
	});
});

describe('compare (median of the rounds, 10% tolerance)', () => {
	test('equal results pass', () => {
		const v = compare('/server/ping', same, same);
		expect(v).toMatchObject({
			ok: true,
			reasons: [],
			directus: { p95: 11, rps: 950 },
			backoffice: { p95: 11, rps: 950 },
		});
	});

	test('within 10% passes (p95 +10%, req/s -10%)', () => {
		expect(compare('/x', [round(10, 1000)], [round(11, 900)]).ok).toBe(true);
	});

	test('p95 more than 10% above fails', () => {
		const v = compare('/x', [round(10, 1000)], [round(11.1, 1000)]);
		expect(v.ok).toBe(false);
		expect(v.reasons[0]).toMatch(/p95 11.1 ms .* above Directus \(10 ms\)/);
	});

	test('req/s more than 10% below fails', () => {
		const v = compare('/x', [round(10, 1000)], [round(10, 899)]);
		expect(v.ok).toBe(false);
		expect(v.reasons[0]).toMatch(/899 req\/s .* below Directus \(1000 req\/s\)/);
	});

	test('one bad round out of three does not change the median', () => {
		expect(compare('/x', same, [round(10, 1000), round(50, 100), round(11, 950)]).ok).toBe(true);
	});

	test('a round with errors fails the endpoint, on either side', () => {
		expect(compare('/x', same, [round(10, 1000, 3), ...same.slice(1)]).reasons).toEqual([
			'Backoffice round 1: 3 error(s)',
		]);
		expect(compare('/x', [...same.slice(0, 2), round(11, 950, 1)], same).reasons).toEqual([
			'Directus round 3: 1 error(s)',
		]);
	});

	test('table lists each endpoint with its result', () => {
		const text = table([compare('/a', same, same), compare('/b', [round(10, 1000)], [round(20, 1000)])]);
		expect(text).toContain('| /a | 11 | 11 | 950 | 950 | ok |');
		expect(text).toMatch(/\| \/b \| 10 \| 20 \| 1000 \| 1000 \| FAIL: p95/);
	});
});

describe('non-blocking endpoints (accepted differences)', () => {
	test('a failing non-blocking endpoint is reported but does not fail the run; a blocking one does', () => {
		const slow = { ...compare('/server/specs/oas', [round(10, 100)], [round(20, 50)]), notBlocking: 'D-22' };
		const ok = compare('/server/ping', same, same);
		const failing = compare('/server/health', [round(10, 100)], [round(20, 50)]);

		expect(gatePasses([ok, slow])).toBe(true);
		expect(gatePasses([ok, slow, failing])).toBe(false);
		expect(table([slow])).toContain('| not blocking (D-22): p95 20 ms');
		expect(table([failing])).toContain('| FAIL: p95 20 ms');
	});
});
