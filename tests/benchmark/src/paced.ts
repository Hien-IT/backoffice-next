// autocannon with the requests of a fixed rate spread over each second (FR-113, research R18 of spec 001, owner
// 2026-10-23). With `overallRate`, autocannon 8 gives each connection a budget per second that every connection
// refills at the same moment, so a rate of 42 req/s arrives as 42 simultaneous requests at the start of each second and
// the p95 measures how long a burst takes to drain (schema user no-store, benchmark run 39823743161). Here the rate
// is `overallRate` instances of one connection at 1 req/s each, started 1000 / rate ms apart: one request every
// 1000 / rate ms. Without `overallRate` it is plain autocannon. Same call shape as autocannon: (options, callback),
// returning an emitter of `response` events; the result keeps the fields the suites read.
import { EventEmitter } from 'node:events';
import autocannon from 'autocannon';

type Callback = (err: Error | null, result: autocannon.Result) => void;

/** Requests of each instance when `amount` is split over `count` instances (the first ones take the remainder). */
export function splitAmount(amount: number, count: number): number[] {
	return Array.from({ length: count }, (_, i) => Math.floor(amount / count) + (i < amount % count ? 1 : 0));
}

/** The fields of several autocannon results that the suites read, summed. */
export function mergeResults(results: autocannon.Result[]): autocannon.Result {
	const statusCodeStats: Record<string, { count: number }> = {};

	for (const r of results) {
		for (const [code, stats] of Object.entries(r.statusCodeStats ?? {})) {
			statusCodeStats[code] = { count: (statusCodeStats[code]?.count ?? 0) + (stats?.count ?? 0) };
		}
	}

	const sum = (pick: (r: autocannon.Result) => number) => results.reduce((total, r) => total + pick(r), 0);

	return {
		requests: { total: sum((r) => r.requests.total), average: sum((r) => r.requests.average) },
		errors: sum((r) => r.errors),
		timeouts: sum((r) => r.timeouts),
		non2xx: sum((r) => r.non2xx),
		statusCodeStats,
	} as unknown as autocannon.Result;
}

export function paced(options: autocannon.Options, callback: Callback): EventEmitter {
	if (!options.overallRate) return autocannon(options, callback) as unknown as EventEmitter;

	const rate = Math.max(1, Math.round(options.overallRate));
	const { overallRate: _rate, connections: _connections, ...rest } = options;
	const amounts = options.amount ? splitAmount(options.amount, rate) : Array.from({ length: rate }, () => undefined);
	const starts = amounts.map((amount, i) => ({ amount, delay: (i * 1000) / rate })).filter((s) => s.amount !== 0);

	const events = new EventEmitter();
	const results: autocannon.Result[] = [];
	let failed = false;

	for (const { amount, delay } of starts) {
		setTimeout(() => {
			if (failed) return;

			const instance = autocannon(
				{ ...rest, connections: 1, connectionRate: 1, ...(amount !== undefined ? { amount } : {}) },
				(err, result) => {
					if (failed) return;
					if (err) {
						failed = true;
						callback(err, result);
						return;
					}

					results.push(result);
					if (results.length === starts.length) callback(null, mergeResults(results));
				},
			);

			instance.on('response', (...args: unknown[]) => events.emit('response', ...args));
		}, delay);
	}

	return events;
}
