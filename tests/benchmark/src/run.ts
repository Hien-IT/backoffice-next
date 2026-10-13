// Benchmark of the new API against Directus 11.17.4 (FR-113, SC-006, R18). Needs `benchmark:env-up` first.
// For each endpoint: 5 s warm-up, then two phases of BENCH_ROUNDS rounds alternating Directus and Backoffice,
// BENCH_DURATION seconds each, compared on the median of the rounds (SC-006 "same load"):
// - throughput: 50 connections, as many requests as each app answers (req/s);
// - latency: the same fixed rate for both apps, RATE_SHARE of the Directus req/s; p95 from every response time.
// With a fixed number of connections the faster app also receives more requests per second, which loads the shared
// DB, Redis and MinIO more and raises its own p95; a fixed rate compares both under the same load.
import { appendFileSync } from 'node:fs';
import autocannon from 'autocannon';
import {
	compare,
	confirmed,
	createLatencyHistogram,
	gatePasses,
	median,
	percentile,
	recordLatency,
	type Round,
	table,
	type Verdict,
} from './compare.ts';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
const BACKOFFICE = process.env['BACKOFFICE_URL'] ?? 'http://127.0.0.1:8156';
const ROUNDS = Number(process.env['BENCH_ROUNDS'] ?? 3);
const DURATION = Number(process.env['BENCH_DURATION'] ?? 20);
const WARMUP = 5;
const CONNECTIONS = 50;
const RATE_SHARE = 0.8;

// Every request sends Cache-Control: no-store (feature 005, research R10): both apps skip the shared response cache
// (CACHE_SKIP_ALLOWED=true in the vendor env) and build each answer. Since feature 002 both build the schema step the
// same way (SC-005).
// rateShare replaces RATE_SHARE for the latency phase. /server/health writes the same object to MinIO on every call at
// both apps; at 80% of the Directus req/s MinIO queues those writes and p95 swings 2-4x between rounds of the same app
// (diagnostic runs of 2026-10-12, spec 005 tasks.md): 40% keeps MinIO out of saturation so p95 compares the apps.
const ENDPOINTS: { path: string; directus: string; notBlocking?: string; rateShare?: number }[] = [
	{ path: '/server/ping', directus: DIRECTUS },
	{ path: '/server/health', directus: DIRECTUS, rateShare: 0.4 },
	{ path: '/server/info', directus: DIRECTUS },
	{ path: '/server/specs/oas', directus: DIRECTUS },
];

async function measure(baseUrl: string, path: string, duration: number, overallRate?: number): Promise<Round> {
	const histogram = createLatencyHistogram();
	const url = new URL(path, baseUrl).href;
	const result = await new Promise<autocannon.Result>((resolve, reject) => {
		const options = {
			url,
			connections: CONNECTIONS,
			duration,
			headers: { 'cache-control': 'no-store' },
			...(overallRate ? { overallRate } : {}),
		};
		const instance = autocannon(options, (err, res) => (err ? reject(err) : resolve(res)));

		instance.on('response', (_client, _status, _bytes, responseTime) => recordLatency(histogram, responseTime));
	});

	return {
		p95: percentile(histogram, 95),
		rps: Math.round(result.requests.average),
		errors: result.errors + result.timeouts + result.non2xx,
	};
}

/** One round per index: req/s from the throughput phase, p95 from the fixed-rate phase, errors from both. */
function combine(throughput: Round[], latency: Round[]): Round[] {
	return throughput.map((t, i) => ({ rps: t.rps, p95: latency[i]!.p95, errors: t.errors + latency[i]!.errors }));
}

const verdicts: Verdict[] = [];

for (const endpoint of ENDPOINTS) {
	await measure(endpoint.directus, endpoint.path, WARMUP);
	await measure(BACKOFFICE, endpoint.path, WARMUP);

	const verdict = await confirmed(async () => {
		const throughput = { directus: [] as Round[], backoffice: [] as Round[] };

		for (let i = 0; i < ROUNDS; i++) {
			throughput.directus.push(await measure(endpoint.directus, endpoint.path, DURATION));
			throughput.backoffice.push(await measure(BACKOFFICE, endpoint.path, DURATION));
		}

		const share = endpoint.rateShare ?? RATE_SHARE;
		const rate = Math.max(1, Math.round(share * median(throughput.directus.map((r) => r.rps))));
		const latency = { directus: [] as Round[], backoffice: [] as Round[] };

		for (let i = 0; i < ROUNDS; i++) {
			latency.directus.push(await measure(endpoint.directus, endpoint.path, DURATION, rate));
			latency.backoffice.push(await measure(BACKOFFICE, endpoint.path, DURATION, rate));
		}

		return compare(
			`${endpoint.path} (p95 at ${rate} req/s)`,
			combine(throughput.directus, latency.directus),
			combine(throughput.backoffice, latency.backoffice),
		);
	});
	verdicts.push(endpoint.notBlocking ? { ...verdict, notBlocking: endpoint.notBlocking } : verdict);
}

const report = table(verdicts);
process.stdout.write(`${report}\n`);
if (process.env['GITHUB_STEP_SUMMARY'])
	appendFileSync(process.env['GITHUB_STEP_SUMMARY'], `## Benchmark\n\n${report}\n`);

process.exit(gatePasses(verdicts) ? 0 : 1);
