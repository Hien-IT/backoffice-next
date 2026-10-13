// Benchmark of the history routes against Directus 11.17.4 (feature 008, spec FR-063, SC-006, contracts/parity.md §6),
// like files.ts: per scenario a warm-up, then BENCH_ROUNDS rounds alternating the apps, throughput then p95 at 80% of
// the Directus req/s, compared by compare.ts (10%). Scenarios: the page and the count the revisions sidebar asks for
// (items in turn), the activity list as an admin and as a user with the app minimal permissions, saves into versions in
// turn (10 connections), and items read through their `draft` version. Needs `benchmark:env-up` first.
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
import { cleanup, type HistorySeed, seed } from './seed-history.ts';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
const BACKOFFICE = process.env['BACKOFFICE_URL'] ?? 'http://127.0.0.1:8156';
const ROUNDS = Number(process.env['BENCH_ROUNDS'] ?? 3);
const DURATION = Number(process.env['BENCH_DURATION'] ?? 10);
const WARMUP = 5;
const CONNECTIONS = 50;
const SAVE_CONNECTIONS = 10;
const RATE_SHARE = 0.8;
const SIDEBAR = [
	'id',
	'collection',
	'item',
	'activity.action',
	'activity.timestamp',
	'activity.user.id',
	'activity.user.email',
	'activity.user.first_name',
	'activity.user.last_name',
	'activity.ip',
	'activity.user_agent',
	'activity.origin',
].join(',');

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

type App = 'directus' | 'backoffice';

interface Scenario {
	name: string;
	method: 'GET' | 'POST';
	path: (n: number) => string;
	body?: (n: number) => string;
	user: 'admin' | 'user';
	connections?: number;
	reset?: () => Promise<void>;
}

function scenarios(seeded: HistorySeed): Scenario[] {
	const item = (n: number) => seeded.items[n % seeded.items.length]!;
	const filter = (n: number) =>
		json({
			_and: [
				{ collection: { _eq: seeded.collection } },
				{ item: { _eq: String(item(n)) } },
				{ version: { _null: true } },
			],
		});

	return [
		{
			name: 'revisions-sidebar',
			method: 'GET',
			path: (n) => `/revisions?filter=${filter(n)}&sort=-id&limit=10&page=1&fields=${SIDEBAR}`,
			user: 'admin',
		},
		{
			name: 'revisions-count',
			method: 'GET',
			path: (n) => `/revisions?filter=${filter(n)}&aggregate[count]=id`,
			user: 'admin',
		},
		...(['admin', 'user'] as const).map(
			(user): Scenario => ({
				name: 'activity-list',
				method: 'GET',
				path: () => '/activity?sort=-timestamp&limit=50&fields=id,action,collection,item,timestamp,user.email',
				user,
			}),
		),
		{
			name: 'version-save',
			method: 'POST',
			path: (n) => `/versions/${seeded.versions[n % seeded.versions.length]}/save`,
			body: (n) => JSON.stringify({ title: `saved ${n}` }),
			user: 'admin',
			connections: SAVE_CONNECTIONS,
		},
		{
			name: 'item-version-read',
			method: 'GET',
			path: (n) => `/items/${seeded.collection}/${item(n)}?version=draft`,
			user: 'admin',
		},
	];
}

async function measure(seeded: HistorySeed, s: Scenario, app: App, duration: number, rate?: number): Promise<Round> {
	await s.reset?.();
	// Without it the app warmed first keeps the permissions in memory and the other reads Redis on every lookup.
	await flushPermissions();
	const histogram = createLatencyHistogram();
	let next = 0;

	const result = await new Promise<autocannon.Result>((resolve, reject) => {
		const options = {
			url: app === 'directus' ? DIRECTUS : BACKOFFICE,
			connections: s.connections ?? CONNECTIONS,
			duration,
			requests: [
				{
					method: s.method,
					setupRequest: (req: any) => ({
						...req,
						path: s.path(next++),
						...(s.body ? { body: s.body(next - 1) } : {}),
						headers: {
							...req.headers,
							authorization: `Bearer ${seeded.tokens[s.user]}`,
							'cache-control': 'no-store',
							...(s.body ? { 'content-type': 'application/json' } : {}),
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
		rps: Math.round(result.requests.average),
		errors: result.errors + result.timeouts + result.non2xx,
	};
}

const seeded = await seed();
const sizes = `${seeded.items.length} items, ${seeded.items.length * Number(process.env['BENCH_HISTORY_REVISIONS'] ?? 20)} revisions, ${seeded.versions.length} versions`;
process.stdout.write(`seed: ${seeded.seconds} s, ${sizes}\n`);
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

			return compare(
				`${s.method} ${s.name} (${s.user}, ${s.connections ?? CONNECTIONS} connections, p95 at ${rate} req/s)`,
				combine(throughput.directus, latency.directus),
				combine(throughput.backoffice, latency.backoffice),
			);
		});
		verdicts.push(verdict);
		process.stdout.write(`${table([verdict])}\n`);
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
		`## Benchmark history\n\nSeed: ${seeded.seconds} s, ${sizes}.\n\n${report}\n`,
	);

process.exit(gatePasses(verdicts) ? 0 : 1);
