// Comparison rules of the benchmark (FR-113, R18): median of the rounds; the new API fails when its p95 is more
// than 10% above Directus or its requests/second more than 10% below. A round with errors fails the endpoint.
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

	return { path, directus: d, backoffice: b, ok: reasons.length === 0, reasons };
}

/** Markdown table of the verdicts (stdout and the GitHub job summary). */
export function table(verdicts: Verdict[]): string {
	const rows = verdicts.map(
		(v) =>
			`| ${v.path} | ${v.directus.p95} | ${v.backoffice.p95} | ${v.directus.rps} | ${v.backoffice.rps} | ${v.ok ? 'ok' : `FAIL: ${v.reasons.join('; ')}`} |`,
	);

	return [
		'| Endpoint | p95 Directus (ms) | p95 Backoffice (ms) | req/s Directus | req/s Backoffice | Result |',
		'| --- | --- | --- | --- | --- | --- |',
		...rows,
	].join('\n');
}
