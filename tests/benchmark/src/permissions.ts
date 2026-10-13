// Benchmark of permission-heavy reads against Directus 11.17.4 (SC-006, research R14 of spec 004), like run.ts: per
// endpoint a warm-up, then BENCH_ROUNDS rounds alternating the apps, throughput (50 connections) then p95 at 80% of
// the Directus req/s, compared by compare.ts (10%). Requests carry the static tokens of 2,000 seeded users in turn,
// and the permissions cache is emptied before every round so the recomputation is measured too. The reference is
// Directus of the main pair; every request sends Cache-Control: no-store so neither app answers from the shared
// response cache (feature 005, research R10). Needs `benchmark:env-up` first.
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
import { cleanup, type Seed, seed } from './seed-permissions.ts';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
const BACKOFFICE = process.env['BACKOFFICE_URL'] ?? 'http://127.0.0.1:8156';
const ROUNDS = Number(process.env['BENCH_ROUNDS'] ?? 5);
const DURATION = Number(process.env['BENCH_DURATION'] ?? 20);
const WARMUP = 5;
const CONNECTIONS = 50;
const RATE_SHARE = 0.8;
const ENDPOINTS = ['/users/me', '/permissions/me', '/users?filter[status][_eq]=active&limit=25'];

async function measure(seeded: Seed, baseUrl: string, path: string, duration: number, rate?: number): Promise<Round> {
	const histogram = createLatencyHistogram();
	let next = 0;

	const result = await new Promise<autocannon.Result>((resolve, reject) => {
		const options = {
			url: baseUrl,
			connections: CONNECTIONS,
			duration,
			requests: [
				{
					method: 'GET' as const,
					path,
					setupRequest: (req: any) => ({
						...req,
						headers: {
							...req.headers,
							'cache-control': 'no-store',
							authorization: `Bearer ${seeded.tokens[next++ % seeded.tokens.length]}`,
						},
					}),
				},
			],
			...(rate ? { overallRate: rate } : {}),
		};

		const instance = autocannon(options, (err, res) => (err ? reject(err) : resolve(res)));
		instance.on('response', (_client, _status, _bytes, responseTime) => recordLatency(histogram, responseTime));
	});

	return {
		p95: percentile(histogram, 95),
		// One decimal: at a few req/s (GET /fields without cache) a whole request is more than the 10% tolerance.
		rps: Math.round(result.requests.average * 10) / 10,
		errors: result.errors + result.timeouts + result.non2xx,
	};
}

async function round(seeded: Seed, baseUrl: string, path: string, rate?: number): Promise<Round> {
	await flushPermissions();
	return measure(seeded, baseUrl, path, DURATION, rate);
}

const seeded = await seed();
const verdicts: Verdict[] = [];

try {
	for (const path of ENDPOINTS) {
		await measure(seeded, DIRECTUS, path, WARMUP);
		await measure(seeded, BACKOFFICE, path, WARMUP);

		const verdict = await confirmed(async () => {
			const throughput = { directus: [] as Round[], backoffice: [] as Round[] };

			for (let i = 0; i < ROUNDS; i++) {
				throughput.directus.push(await round(seeded, DIRECTUS, path));
				throughput.backoffice.push(await round(seeded, BACKOFFICE, path));
			}

			const rate = Math.max(1, Math.round(RATE_SHARE * median(throughput.directus.map((r) => r.rps))));
			const latency = { directus: [] as Round[], backoffice: [] as Round[] };

			for (let i = 0; i < ROUNDS; i++) {
				latency.directus.push(await round(seeded, DIRECTUS, path, rate));
				latency.backoffice.push(await round(seeded, BACKOFFICE, path, rate));
			}

			const combine = (t: Round[], l: Round[]) =>
				t.map((r, i) => ({ rps: r.rps, p95: l[i]!.p95, errors: r.errors + l[i]!.errors }));
			return compare(
				`GET ${path} (p95 at ${rate} req/s)`,
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
	appendFileSync(process.env['GITHUB_STEP_SUMMARY'], `## Benchmark permissions\n\n${report}\n`);

process.exit(gatePasses(verdicts) ? 0 : 1);
