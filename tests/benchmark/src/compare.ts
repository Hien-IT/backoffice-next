// Comparison rules of the benchmark (FR-113, R18): median of the rounds; the new API fails when its p95 is more
// than 10% above Directus or its requests/second more than 10% below. A round with errors fails the endpoint. A failing
// scenario is measured again and fails when most attempts fail (confirmed()).
import * as hdr from 'hdr-histogram-js';

export const TOLERANCE = 0.1;

export interface Round {
	/** p95 latency in ms. */
	p95: number;
	/** Average requests per second. */
	rps: number;
	/** Connection errors, timeouts and non-2xx answers. */
	errors: number;
}

export interface Verdict {
	path: string;
	directus: { p95: number; rps: number };
	backoffice: { p95: number; rps: number };
	ok: boolean;
	reasons: string[];
	/** Accepted difference (spec code and reason) that keeps a failing endpoint from failing the run. */
	notBlocking?: string;
	/** Backoffice had errors in a round while Directus answered every request: a real failure, never measured again. */
	backofficeOnlyErrors?: boolean;
	/** Outcome of each attempt when the scenario was measured again (confirmed()). */
	attempts?: ('ok' | 'fail')[];
}

/** Response times are recorded in microseconds (hdr histograms hold integers). */
export function createLatencyHistogram(): hdr.Histogram {
	return hdr.build({
		lowestDiscernibleValue: 1,
		highestTrackableValue: 3_600_000_000,
		numberOfSignificantValueDigits: 3,
	});
}

export function recordLatency(histogram: hdr.Histogram, ms: number): void {
	histogram.recordValue(Math.max(1, Math.round(ms * 1000)));
}

/** Percentile of the recorded response times, in ms. */
export function percentile(histogram: hdr.Histogram, p: number): number {
	return histogram.getValueAtPercentile(p) / 1000;
}

export function median(values: number[]): number {
	if (values.length === 0) throw new Error('median of no values');
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function compare(path: string, directus: Round[], backoffice: Round[], tolerance = TOLERANCE): Verdict {
	const reasons: string[] = [];

	for (const [name, rounds] of [
		['Directus', directus],
		['Backoffice', backoffice],
	] as const) {
		rounds.forEach((r, i) => {
			if (r.errors > 0) reasons.push(`${name} round ${i + 1}: ${r.errors} error(s)`);
		});
	}

	const d = { p95: median(directus.map((r) => r.p95)), rps: median(directus.map((r) => r.rps)) };
	const b = { p95: median(backoffice.map((r) => r.p95)), rps: median(backoffice.map((r) => r.rps)) };

	if (b.p95 > d.p95 * (1 + tolerance)) {
		reasons.push(`p95 ${b.p95} ms is more than ${tolerance * 100}% above Directus (${d.p95} ms)`);
	}

	if (b.rps < d.rps * (1 - tolerance)) {
		reasons.push(`${b.rps} req/s is more than ${tolerance * 100}% below Directus (${d.rps} req/s)`);
	}

	const errorsOf = (rounds: Round[]) => rounds.reduce((sum, r) => sum + r.errors, 0);
	const backofficeOnlyErrors = errorsOf(backoffice) > 0 && errorsOf(directus) === 0;

	return { path, directus: d, backoffice: b, ok: reasons.length === 0, reasons, backofficeOnlyErrors };
}

/**
 * Measures a failing scenario again: on a shared GitHub runner a run moves past the tolerance in either direction
 * (benchmark runs of 2026-10-13: the failing scenarios changed every run, some with Backoffice twice as fast), so a
 * failure counts only when it repeats, in a majority of `attempts`. Errors at Backoffice alone fail at once.
 */
export async function confirmed(measure: () => Promise<Verdict>, attempts = 3): Promise<Verdict> {
	const first = await measure();
	if (first.ok || first.backofficeOnlyErrors) return first;

	const runs = [first];
	const needed = Math.floor(attempts / 2) + 1;
	const failures = () => runs.filter((v) => !v.ok).length;

	while (failures() < needed && runs.length - failures() < needed) runs.push(await measure());

	const failed = failures() >= needed;
	const kept = [...runs].reverse().find((v) => v.ok === !failed)!;
	return { ...kept, attempts: runs.map((v) => (v.ok ? 'ok' : 'fail')) };
}

/** The run passes when every endpoint is within tolerance or its failure is an accepted, non-blocking difference. */
export function gatePasses(verdicts: Verdict[]): boolean {
	return verdicts.every((v) => v.ok || v.notBlocking !== undefined);
}

/** Markdown table of the verdicts (stdout and the GitHub job summary). */
export function table(verdicts: Verdict[]): string {
	const rows = verdicts.map(
		(v) =>
			`| ${v.path} | ${v.directus.p95} | ${v.backoffice.p95} | ${v.directus.rps} | ${v.backoffice.rps} | ${result(v)} |`,
	);

	return [
		'| Endpoint | p95 Directus (ms) | p95 Backoffice (ms) | req/s Directus | req/s Backoffice | Result |',
		'| --- | --- | --- | --- | --- | --- |',
		...rows,
	].join('\n');
}

function result(v: Verdict): string {
	const tries = v.attempts ? ` (attempts: ${v.attempts.join(', ')})` : '';
	if (v.ok) return `ok${tries}`;
	const reasons = v.reasons.join('; ');
	return v.notBlocking ? `not blocking (${v.notBlocking}): ${reasons}` : `FAIL${tries}: ${reasons}`;
}
