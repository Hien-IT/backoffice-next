// Benchmark of /graphql against Directus 11.17.4 (feature 011, FR-064, SC-007), on the data of items.ts
// (seed-items.ts): per scenario a warm-up, then BENCH_ROUNDS rounds alternating the apps, throughput (50 connections)
// then p95 at 80% of the Directus req/s, compared by compare.ts (10%). Scenarios: a filtered, sorted list with an m2o
// field, one item by id, an aggregate grouped by status (each as an admin and as a user whose read permission filters
// on status, fresh and from the shared response cache), the introspection of the admin (schema already cached) and a
// create mutation. Before the scenarios, the time of a first schema generation (system cache cleared) is printed only
// (R-32). Needs `benchmark:env-up` first.
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
import { ARTICLES, cleanup, type ItemsSeed, seed } from './seed-items.ts';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
const BACKOFFICE = process.env['BACKOFFICE_URL'] ?? 'http://127.0.0.1:8156';
const ROUNDS = Number(process.env['BENCH_ROUNDS'] ?? 3);
const DURATION = Number(process.env['BENCH_DURATION'] ?? 10);
const WARMUP = 5;
const CONNECTIONS = 50;
const RATE_SHARE = 0.8;

type App = 'directus' | 'backoffice';

interface Scenario {
	name: string;
	method: 'POST';
	/** The path of the n-th request of `app`. */
	path: (n: number, app: App) => string;
	body?: (n: number) => string;
	user: 'admin' | 'user';
	fresh: boolean;
}

const INTROSPECTION =
	'query { __schema { types { name kind fields(includeDeprecated: true) { name args { name type { name kind ofType { name kind } } } type { name kind ofType { name kind ofType { name kind } } } } inputFields { name type { name kind ofType { name kind } } } enumValues { name } } } }';

const gqlBody = (query: string) => JSON.stringify({ query });

function scenarios(seeded: ItemsSeed): Scenario[] {
	const list = gqlBody(
		`{ ${ARTICLES}(filter: { status: { _eq: "published" } }, sort: ["-date_created"], limit: 25) { id title category { name } } }`,
	);
	const byId = (n: number) =>
		gqlBody(`{ ${ARTICLES}_by_id(id: "${seeded.pool[n % seeded.pool.length]}") { id title status } }`);
	const aggregated = gqlBody(`{ ${ARTICLES}_aggregated(groupBy: ["status"]) { group count { id } } }`);
	const out: Scenario[] = [];

	for (const user of ['admin', 'user'] as const) {
		for (const fresh of [true, false]) {
			out.push({ name: 'list', method: 'POST', path: () => '/graphql', body: () => list, user, fresh });
			out.push({ name: 'by id', method: 'POST', path: () => '/graphql', body: byId, user, fresh });
			out.push({ name: 'aggregated', method: 'POST', path: () => '/graphql', body: () => aggregated, user, fresh });
		}
	}

	out.push({
		name: 'introspection',
		method: 'POST',
		path: () => '/graphql',
		body: () => gqlBody(INTROSPECTION),
		user: 'admin',
		fresh: true,
	});

	for (const user of ['admin', 'user'] as const) {
		out.push({
			name: 'create',
			method: 'POST',
			path: () => '/graphql',
			body: (n) =>
				gqlBody(
					`mutation { create_${ARTICLES}_item(data: { title: "bench ${n}", status: "published", category: ${(n % 100) + 1} }) { id } }`,
				),
			user,
			fresh: true,
		});
	}

	return out;
}

/** Time of one introspection right after the system cache is cleared: the schema of the admin is generated again. */
async function firstGeneration(seeded: ItemsSeed, app: App): Promise<number> {
	const base = app === 'directus' ? DIRECTUS : BACKOFFICE;
	const headers = { authorization: `Bearer ${seeded.tokens.admin}`, 'content-type': 'application/json' };
	await fetch(`${base}/utils/cache/clear?system`, { method: 'POST', headers });
	await new Promise((resolve) => setTimeout(resolve, 500));

	const started = performance.now();
	await fetch(`${base}/graphql`, {
		method: 'POST',
		headers: { ...headers, 'cache-control': 'no-store' },
		body: gqlBody(INTROSPECTION),
	});
	return Math.round(performance.now() - started);
}

async function measure(seeded: ItemsSeed, s: Scenario, app: App, duration: number, rate?: number): Promise<Round> {
	// Without it the app warmed first keeps the permissions in memory and the other reads Redis on every lookup.
	await flushPermissions();
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
					setupRequest: (req: any) => {
						const n = next++;
						return {
							...req,
							path: s.path(n, app),
							...(s.body ? { body: s.body(n) } : {}),
							headers: {
								...req.headers,
								authorization: `Bearer ${seeded.tokens[s.user]}`,
								...(s.body ? { 'content-type': 'application/json' } : {}),
								...(s.fresh ? { 'cache-control': 'no-store' } : {}),
							},
						};
					},
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

const seeded = await seed();
process.stdout.write(
	`seed: ${seeded.seconds} s, ${ARTICLES} ${(seeded.bytes / 1024 ** 3).toFixed(2)} GiB with indexes\n`,
);
const verdicts: Verdict[] = [];

for (const app of ['directus', 'backoffice'] as const) {
	process.stdout.write(`first schema generation (${app}): ${await firstGeneration(seeded, app)} ms\n`);
}

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
			const mode = s.name === 'create' || s.name === 'introspection' ? '' : s.fresh ? ', no-store' : ', cached';

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
		`## Benchmark graphql\n\nSeed: ${seeded.seconds} s, ${(seeded.bytes / 1024 ** 3).toFixed(2)} GiB.\n\n${report}\n`,
	);

process.exit(gatePasses(verdicts) ? 0 : 1);
