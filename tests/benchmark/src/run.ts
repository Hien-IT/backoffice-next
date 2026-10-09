// Benchmark of the new API against Directus 11.17.4 (FR-113, SC-006, R18). Needs `benchmark:env-up` first.
// For each endpoint: 5 s warm-up, then BENCH_ROUNDS rounds alternating Directus and Backoffice, BENCH_DURATION
// seconds each, 50 connections; p95 from every response time, compared on the median of the rounds.
import { appendFileSync } from 'node:fs';
import autocannon from 'autocannon';
import {
	compare,
	createLatencyHistogram,
	gatePasses,
	percentile,
	recordLatency,
	type Round,
	table,
	type Verdict,
} from './compare.ts';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
const DIRECTUS_NOCACHE = process.env['DIRECTUS_NOCACHE_URL'] ?? 'http://127.0.0.1:8655';
const BACKOFFICE = process.env['BACKOFFICE_URL'] ?? 'http://127.0.0.1:8156';
const ROUNDS = Number(process.env['BENCH_ROUNDS'] ?? 3);
const DURATION = Number(process.env['BENCH_DURATION'] ?? 20);
const WARMUP = 5;
const CONNECTIONS = 50;

// /server/specs/oas: Backoffice builds the schema on every request until feature 002, so the reference is Directus
// with CACHE_SCHEMA=false. It is measured but does not fail the run (D-22): Directus still reads policies and
// permissions from its permissions cache, which comes with feature 002 (D-20).
const ENDPOINTS: { path: string; directus: string; notBlocking?: string }[] = [
	{ path: '/server/ping', directus: DIRECTUS },
	{ path: '/server/health', directus: DIRECTUS },
	{ path: '/server/info', directus: DIRECTUS },
	{ path: '/server/specs/oas', directus: DIRECTUS_NOCACHE, notBlocking: 'D-22, until feature 002' },
];

async function measure(baseUrl: string, path: string, duration: number): Promise<Round> {
	const histogram = createLatencyHistogram();
	const result = await new Promise<autocannon.Result>((resolve, reject) => {
		const instance = autocannon({ url: new URL(path, baseUrl).href, connections: CONNECTIONS, duration }, (err, res) =>
			err ? reject(err) : resolve(res),
		);

		instance.on('response', (_client, _status, _bytes, responseTime) => recordLatency(histogram, responseTime));
	});

	return {
		p95: percentile(histogram, 95),
		rps: Math.round(result.requests.average),
		errors: result.errors + result.timeouts + result.non2xx,
	};
}

const verdicts: Verdict[] = [];

for (const endpoint of ENDPOINTS) {
	await measure(endpoint.directus, endpoint.path, WARMUP);
	await measure(BACKOFFICE, endpoint.path, WARMUP);

	const directus: Round[] = [];
	const backoffice: Round[] = [];

	for (let i = 0; i < ROUNDS; i++) {
		directus.push(await measure(endpoint.directus, endpoint.path, DURATION));
		backoffice.push(await measure(BACKOFFICE, endpoint.path, DURATION));
	}

	const verdict = compare(endpoint.path, directus, backoffice);
	verdicts.push(endpoint.notBlocking ? { ...verdict, notBlocking: endpoint.notBlocking } : verdict);
}

const report = table(verdicts);
process.stdout.write(`${report}\n`);
if (process.env['GITHUB_STEP_SUMMARY'])
	appendFileSync(process.env['GITHUB_STEP_SUMMARY'], `## Benchmark\n\n${report}\n`);

process.exit(gatePasses(verdicts) ? 0 : 1);
