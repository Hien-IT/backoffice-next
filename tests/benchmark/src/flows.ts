// Benchmark of the flows routes against Directus 11.17.4 (feature 009, spec FR-063, SC-006, contracts/parity.md §6),
// like history.ts: per scenario a warm-up, then BENCH_ROUNDS rounds alternating the apps, throughput then p95 at 50% of
// the Directus req/s, compared by compare.ts (10%). Scenarios: the webhook flow `webhook-sync` (public, no run log),
// the flows store of the app (GET /flows with the operations, admin), and `webhook-exec`, recorded only: a new isolate
// per run is the cost of isolated-vm at both apps (research R13). Needs `benchmark:env-up` first.
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
	RATE_SHARE,
} from './compare.ts';
import { cpuPerRequest, snapshot } from './diag.ts';
import { paced } from './paced.ts';
import { flushPermissions, redis } from './redis.ts';
import { cleanup, type FlowsSeed, seed } from './seed-flows.ts';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
const BACKOFFICE = process.env['BACKOFFICE_URL'] ?? 'http://127.0.0.1:8156';
const ROUNDS = Number(process.env['BENCH_ROUNDS'] ?? 3);
const DURATION = Number(process.env['BENCH_DURATION'] ?? 10);
const WARMUP = 5;
const CONNECTIONS = 50;

type App = 'directus' | 'backoffice';

interface Scenario {
	name: string;
	method: 'GET' | 'POST';
	path: string;
	body?: (n: number) => string;
	/** Sends the admin token (the webhooks are public). */
	admin: boolean;
	/** Recorded in the report, outside the 10% gate. */
	recordOnly?: boolean;
}

function scenarios(seeded: FlowsSeed): Scenario[] {
	return [
		{
			name: 'webhook-sync',
			method: 'POST',
			path: `/flows/trigger/${seeded.flows.sync}`,
			body: (n) => JSON.stringify({ n }),
			admin: false,
		},
		{ name: 'flows-list', method: 'GET', path: '/flows?fields[]=*&fields[]=operations.*&limit=-1', admin: true },
		{
			name: 'webhook-exec',
			method: 'POST',
			path: `/flows/trigger/${seeded.flows.exec}`,
			body: () => '{}',
			admin: false,
			recordOnly: true,
		},
	];
}

async function measure(seeded: FlowsSeed, s: Scenario, app: App, duration: number, rate?: number): Promise<Round> {
	// Without it the app warmed first keeps the permissions in memory and the other reads Redis on every lookup.
	await flushPermissions();
	const before = await snapshot(app);
	const histogram = createLatencyHistogram();
	let next = 0;

	const result = await new Promise<autocannon.Result>((resolve, reject) => {
		const options = {
			url: app === 'directus' ? DIRECTUS : BACKOFFICE,
			connections: CONNECTIONS,
			duration,
			requests: [
				{
					method: s.method,
					setupRequest: (req: any) => ({
						...req,
						path: s.path,
						...(s.body ? { body: s.body(next++) } : {}),
						headers: {
							...req.headers,
							...(s.admin ? { authorization: `Bearer ${seeded.token}` } : {}),
							'cache-control': 'no-store',
							...(s.body ? { 'content-type': 'application/json' } : {}),
						},
					}),
				},
			],
			...(rate ? { overallRate: rate } : {}),
		};

		const instance = paced(options, (err, res) => (err ? reject(err) : resolve(res)));
		instance.on('response', (_client, _status, _bytes, responseTime) => recordLatency(histogram, responseTime));
	});

	return {
		p95: percentile(histogram, 95),
		rps: Math.round(result.requests.average * 10) / 10,
		errors: result.errors + result.timeouts + result.non2xx,
		cpuMs: cpuPerRequest(before, await snapshot(app), result.requests.total),
	};
}

const seeded = await seed();
const sizes = `${process.env['BENCH_FLOWS_ITEMS'] ?? 1000} items, ${process.env['BENCH_FLOWS'] ?? 50} flows of 3 operations`;
process.stdout.write(`seed: ${seeded.seconds} s, ${sizes}\n`);
// Both apps reload the flows through the bus after the last write of the seed.
await new Promise((resolve) => setTimeout(resolve, 3000));
const verdicts: Verdict[] = [];
const recorded: Verdict[] = [];

try {
	for (const s of scenarios(seeded)) {
		await measure(seeded, s, 'directus', WARMUP);
		await measure(seeded, s, 'backoffice', WARMUP);

		const run = async () => {
			const throughput = { directus: [] as Round[], backoffice: [] as Round[] };
			const rounds = s.recordOnly ? 1 : ROUNDS;

			for (let i = 0; i < rounds; i++) {
				throughput.directus.push(await measure(seeded, s, 'directus', DURATION));
				throughput.backoffice.push(await measure(seeded, s, 'backoffice', DURATION));
			}

			const rate = Math.max(1, Math.round(RATE_SHARE * median(throughput.directus.map((r) => r.rps))));
			const latency = { directus: [] as Round[], backoffice: [] as Round[] };

			for (let i = 0; i < rounds; i++) {
				latency.directus.push(await measure(seeded, s, 'directus', DURATION, rate));
				latency.backoffice.push(await measure(seeded, s, 'backoffice', DURATION, rate));
			}

			const combine = (t: Round[], l: Round[]) =>
				t.map((r, i) => ({ rps: r.rps, p95: l[i]!.p95, errors: r.errors + l[i]!.errors, cpuMs: l[i]!.cpuMs }));

			return compare(
				`${s.method} ${s.name} (${s.admin ? 'admin' : 'public'}, ${CONNECTIONS} connections, p95 at ${rate} req/s)${s.recordOnly ? ' [recorded only]' : ''}`,
				combine(throughput.directus, latency.directus),
				combine(throughput.backoffice, latency.backoffice),
			);
		};

		const verdict = s.recordOnly ? await run() : await confirmed(run);
		(s.recordOnly ? recorded : verdicts).push(verdict);
		process.stdout.write(`${table([verdict])}\n`);
	}
} finally {
	await cleanup(seeded);
	await redis.quit();
}

const report = table([...verdicts, ...recorded]);
process.stdout.write(`${report}\n`);
if (process.env['GITHUB_STEP_SUMMARY'])
	appendFileSync(
		process.env['GITHUB_STEP_SUMMARY'],
		`## Benchmark flows\n\nSeed: ${seeded.seconds} s, ${sizes}.\n\n${report}\n`,
	);

process.exit(gatePasses(verdicts) ? 0 : 1);
