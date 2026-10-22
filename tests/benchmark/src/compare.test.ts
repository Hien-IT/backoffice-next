import { describe, expect, test } from 'vitest';
import {
	compare,
	confirmed,
	createLatencyHistogram,
	gatePasses,
	median,
	percentile,
	recordLatency,
	table,
	type Round,
	type Verdict,
	webSlower,
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
		expect(text).toContain('| /a | 11 | 11 | 950 | 950 | - | - | ok |');
		expect(text).toMatch(/\| \/b \| 10 \| 20 \| 1000 \| 1000 \| - \| - \| FAIL: p95/);
	});

	test('CPU per request (FR-113 revised 2026-10-22): fails above Directus +10%, only when every round has a reading', () => {
		const cpu = (p95: number, cpuMs: number | null): Round => ({ p95, rps: 100, errors: 0, cpuMs });
		const d = [cpu(10, 10), cpu(10, 10.2), cpu(10, 9.8)];

		expect(compare('/x', d, [cpu(10, 10.9), cpu(10, 11), cpu(10, 10.8)]).ok).toBe(true);
		const slow = compare('/x', d, [cpu(10, 11.2), cpu(10, 11.4), cpu(10, 11)]);
		expect(slow.reasons).toEqual(['CPU 11.2 ms/request is more than 10% above Directus (10 ms/request)']);
		expect(table([slow])).toContain('| 100 | 100 | 10 | 11.2 | FAIL: CPU 11.2');
		expect(compare('/x', d, [cpu(10, 20), cpu(10, null), cpu(10, 20)]).ok).toBe(true);
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

describe('confirmed (a failure counts when most attempts fail)', () => {
	const ok = compare('/x', same, same);
	const slow = compare('/x', [round(10, 1000)], [round(20, 1000)]);
	const runs = (...verdicts: Verdict[]) => {
		let i = 0;
		const measure = async () => verdicts[i++]!;
		return { measure, count: () => i };
	};

	test('a passing scenario is measured once', async () => {
		const r = runs(ok);
		expect(await confirmed(r.measure)).toEqual(ok);
		expect(r.count()).toBe(1);
	});

	test('fail then ok, ok: passes, with the attempts in the table', async () => {
		const r = runs(slow, ok, ok);
		const v = await confirmed(r.measure);
		expect([v.ok, v.attempts, r.count()]).toEqual([true, ['fail', 'ok', 'ok'], 3]);
		expect(table([v])).toContain('| ok (attempts: fail, ok, ok) |');
	});

	test('fail, fail: fails after two attempts and reports the last failure', async () => {
		const r = runs(slow, slow, ok);
		const v = await confirmed(r.measure);
		expect([v.ok, v.attempts, r.count()]).toEqual([false, ['fail', 'fail'], 2]);
		expect(table([v])).toContain('FAIL (attempts: fail, fail): p95 20 ms');
		expect(gatePasses([v])).toBe(false);
	});

	test('errors at Backoffice while Directus answered everything fail at once', async () => {
		const broken = compare('/x', same, [round(10, 1000, 2), ...same.slice(1)]);
		const r = runs(broken, ok, ok);
		const v = await confirmed(r.measure);
		expect([v.ok, v.attempts, r.count()]).toEqual([false, undefined, 1]);
	});

	test('errors at both apps (an overloaded runner) are measured again', async () => {
		const both = compare('/x', [round(10, 1000, 1)], [round(10, 1000, 3)]);
		const r = runs(both, ok, ok);
		expect((await confirmed(r.measure)).ok).toBe(true);
	});
});

describe('webSlower (TOLERANCE and WEB_FLOOR_MS)', () => {
	test('a short step needs both 10 % and 25 ms', () => {
		expect(webSlower('web', 134, 119)).toBeUndefined();
		expect(webSlower('web', 145, 119)).toContain('145 ms');
	});

	test('a long step fails at 10 %', () => {
		expect(webSlower('web', 1700, 1500)).toContain('1700 ms');
		expect(webSlower('web', 1640, 1500)).toBeUndefined();
	});
});
