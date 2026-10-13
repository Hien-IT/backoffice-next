// Benchmark of the data model reads against Directus 11.17.4 (feature 006, FR-065, SC-007, research R10), like
// items.ts: per scenario a warm-up, then BENCH_ROUNDS rounds alternating the apps, throughput (50 connections) then p95
// at 80% of the Directus req/s, compared by compare.ts (10%). Scenarios: GET /collections, /fields, /relations (the
// requests the Directus app makes when it starts) as an admin and as a user who reads part of the model, fresh
// (Cache-Control: no-store) and from the shared response cache; GET /schema/snapshot and POST /schema/diff of that
// snapshot (204) as an admin, and GET /fields without cache, with HEAVY_CONNECTIONS: a few hundred ms of CPU per request,
// which 50 connections queue past the 10 s autocannon timeout at both apps. Needs `benchmark:env-up` first.
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
import { flushPermissions, redis } from './redis.ts';
import { cleanup, type SchemaSeed, seed } from './seed-schema.ts';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
const BACKOFFICE = process.env['BACKOFFICE_URL'] ?? 'http://127.0.0.1:8156';
const ROUNDS = Number(process.env['BENCH_ROUNDS'] ?? 3);
const DURATION = Number(process.env['BENCH_DURATION'] ?? 10);
const WARMUP = 5;
const CONNECTIONS = 50;
const HEAVY_CONNECTIONS = 5;
const RATE_SHARE = 0.8;

type App = 'directus' | 'backoffice';

interface Scenario {
	name: string;
	method: 'GET' | 'POST';
	path: string;
	body?: string;
	user: 'admin' | 'user';
	fresh: boolean;
	connections?: number;
}

function scenarios(seeded: SchemaSeed): Scenario[] {
	const out: Scenario[] = [];

	for (const path of ['/collections', '/fields', '/relations']) {
		for (const user of ['admin', 'user'] as const) {
			for (const fresh of [true, false]) {
				// /fields without cache takes about 700 ms of CPU (928 fields): 50 connections queue past the 10 s timeout
				// at both apps on a GitHub runner (benchmark run 38393898403, 2026-10-13), like the snapshot below.
				const heavy = path === '/fields' && fresh;
				out.push({
					name: path,
					method: 'GET',
					path,
					user,
					fresh,
					...(heavy ? { connections: HEAVY_CONNECTIONS } : {}),
				});
			}
		}
	}

	for (const fresh of [true, false]) {
		out.push({
			name: '/schema/snapshot',
			method: 'GET',
			path: '/schema/snapshot',
			user: 'admin',
			fresh,
			connections: HEAVY_CONNECTIONS,
		});
	}

	out.push({
		name: '/schema/diff',
		method: 'POST',
		path: '/schema/diff',
		body: JSON.stringify(seeded.snapshot),
		user: 'admin',
		fresh: true,
		connections: HEAVY_CONNECTIONS,
	});

	return out;
}

async function measure(seeded: SchemaSeed, s: Scenario, app: App, duration: number, rate?: number): Promise<Round> {
	await flushPermissions();
	const histogram = createLatencyHistogram();

	const result = await new Promise<autocannon.Result>((resolve, reject) => {
		const options = {
			url: `${app === 'directus' ? DIRECTUS : BACKOFFICE}${s.path}`,
			connections: s.connections ?? CONNECTIONS,
			duration,
			method: s.method,
			...(s.body ? { body: s.body } : {}),
			headers: {
				authorization: `Bearer ${seeded.tokens[s.user]}`,
				...(s.body ? { 'content-type': 'application/json' } : {}),
				...(s.fresh ? { 'cache-control': 'no-store' } : {}),
			},
			...(rate ? { overallRate: rate } : {}),
		};

		const instance = autocannon(options, (err, res) => (err ? reject(err) : resolve(res)));
		instance.on('response', (_client, _status, _bytes, responseTime) => recordLatency(histogram, responseTime));
	});

	// Which kind of failure a round had: the gate only sees their sum.
	if (result.errors + result.timeouts + result.non2xx > 0) {
		process.stdout.write(
			`${s.name} at ${app}: ${result.errors} error(s), ${result.timeouts} timeout(s), ${result.non2xx} non-2xx\n`,
		);
	}

	return {
		p95: percentile(histogram, 95),
		// One decimal: at a few req/s (GET /fields without cache) a whole request is more than the 10% tolerance.
		rps: Math.round(result.requests.average * 10) / 10,
		errors: result.errors + result.timeouts + result.non2xx,
	};
}

const seeded = await seed();
const counts = `${seeded.counts.collections} collections, ${seeded.counts.fields} fields, ${seeded.counts.relations} relations`;
process.stdout.write(`seed: ${seeded.seconds} s, ${counts}\n`);
const verdicts: Verdict[] = [];

try {
	for (const s of scenarios(seeded)) {
		await measure(seeded, s, 'directus', WARMUP);
		await measure(seeded, s, 'backoffice', WARMUP);

		const verdict = await confirmed(async () => {
			const throughput = { directus: [] as Round[], backoffice: [] as Round[] };

			for (let i = 0; i < ROUNDS; i++) {
				throughput.directus.push(await measure(seeded, s, 'directus', DURATION));
				throughput.backoffice.push(await measure(seeded, s, 'backoffice', DURATION));
			}

			const rate = Math.max(1, Math.round(RATE_SHARE * median(throughput.directus.map((r) => r.rps))));
			const latency = { directus: [] as Round[], backoffice: [] as Round[] };

			for (let i = 0; i < ROUNDS; i++) {
				latency.directus.push(await measure(seeded, s, 'directus', DURATION, rate));
				latency.backoffice.push(await measure(seeded, s, 'backoffice', DURATION, rate));
			}

			const combine = (t: Round[], l: Round[]) =>
				t.map((r, i) => ({ rps: r.rps, p95: l[i]!.p95, errors: r.errors + l[i]!.errors }));
			const mode = s.method === 'GET' ? (s.fresh ? ', no-store' : ', cached') : '';

			return compare(
				`${s.method} ${s.name} (${s.user}${mode}, p95 at ${rate} req/s)`,
				combine(throughput.directus, latency.directus),
				combine(throughput.backoffice, latency.backoffice),
			);
		});
		verdicts.push(verdict);
	}
} finally {
	await cleanup(seeded);
	await redis.quit();
}

const report = table(verdicts);
process.stdout.write(`${report}\n`);
if (process.env['GITHUB_STEP_SUMMARY'])
	appendFileSync(
		process.env['GITHUB_STEP_SUMMARY'],
		`## Benchmark data model\n\nSeed: ${seeded.seconds} s, ${counts}.\n\n${report}\n`,
	);

process.exit(gatePasses(verdicts) ? 0 : 1);
