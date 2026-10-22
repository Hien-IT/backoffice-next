// Benchmark of the system routes of feature 010 against Directus 11.17.4 (spec FR-104, contracts/parity.md §8), like
// history.ts: per scenario a warm-up, then BENCH_ROUNDS rounds alternating the apps, throughput then p95 at 80% of the
// Directus req/s, compared by compare.ts (10%). Scenarios: the settings the app reads on every page, the presets of a
// user with many of them, the unread count of the bell, the insights load (dashboards with their panels), the share
// login (argon2 verify, 10 connections) and the manual sort (10 connections, not blocking: rows move under the
// load). Needs `benchmark:env-up` first.
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
import { cpuPerRequest, diagLine, snapshot } from './diag.ts';
import { flushPermissions, redis } from './redis.ts';
import { cleanup, SHARE_PASSWORD, seed, type SystemSeed } from './seed-system.ts';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
const BACKOFFICE = process.env['BACKOFFICE_URL'] ?? 'http://127.0.0.1:8156';
const ROUNDS = Number(process.env['BENCH_ROUNDS'] ?? 3);
const DURATION = Number(process.env['BENCH_DURATION'] ?? 10);
const WARMUP = 5;
const CONNECTIONS = 50;
const SLOW_CONNECTIONS = 10;

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

type App = 'directus' | 'backoffice';

interface Scenario {
	name: string;
	method: 'GET' | 'POST';
	path: (n: number) => string;
	body?: (n: number) => string;
	user: 'admin' | 'user';
	connections?: number;
	notBlocking?: string;
}

function scenarios(seeded: SystemSeed): Scenario[] {
	const row = () => seeded.rows[Math.floor(Math.random() * seeded.rows.length)]!;

	return [
		{ name: 'settings-get', method: 'GET', path: () => '/settings', user: 'admin' },
		{
			name: 'presets-list',
			method: 'GET',
			path: () => `/presets?filter[user][_eq]=${seeded.user}&limit=-1`,
			user: 'user',
		},
		{
			name: 'notifications-count',
			method: 'GET',
			path: () =>
				`/notifications?filter=${json({ _and: [{ recipient: { _eq: '$CURRENT_USER' } }, { status: { _eq: 'inbox' } }] })}&aggregate[count]=id`,
			user: 'user',
		},
		{
			name: 'dashboards-panels',
			method: 'GET',
			path: () => '/dashboards?fields[]=*&fields[]=panels.*&limit=-1',
			user: 'admin',
		},
		{
			name: 'shares-auth',
			method: 'POST',
			path: () => '/shares/auth',
			body: () => JSON.stringify({ share: seeded.share, password: SHARE_PASSWORD }),
			user: 'admin',
			connections: SLOW_CONNECTIONS,
		},
		{
			name: 'utils-sort',
			method: 'POST',
			path: () => `/utils/sort/${seeded.collection}`,
			body: () => JSON.stringify({ item: row(), to: row() }),
			user: 'admin',
			connections: SLOW_CONNECTIONS,
			notBlocking: 'contracts/parity.md §8: concurrent sorts rewrite the same rows, the timing is not comparable',
		},
	];
}

async function measure(seeded: SystemSeed, s: Scenario, app: App, duration: number, rate?: number): Promise<Round> {
	// Without it the app warmed first keeps the permissions in memory and the other reads Redis on every lookup.
	await flushPermissions();
	const before = await snapshot(app);
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

	const after = await snapshot(app);
	process.stdout.write(diagLine(`${s.name}${rate ? ` @${rate}` : ''}`, app, before, after, result.requests.total));

	return {
		p95: percentile(histogram, 95),
		rps: Math.round(result.requests.average * 10) / 10,
		errors: result.errors + result.timeouts + result.non2xx,
		cpuMs: cpuPerRequest(before, after, result.requests.total),
	};
}

const seeded = await seed();
const sizes = `${process.env['BENCH_SYSTEM_PRESETS'] ?? 200} presets, ${process.env['BENCH_SYSTEM_NOTIFICATIONS'] ?? 500} notifications, ${process.env['BENCH_SYSTEM_DASHBOARDS'] ?? 20} dashboards x ${process.env['BENCH_SYSTEM_PANELS'] ?? 10} panels, ${seeded.rows.length} sorted rows`;
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
				t.map((r, i) => ({ rps: r.rps, p95: l[i]!.p95, errors: r.errors + l[i]!.errors, cpuMs: l[i]!.cpuMs }));

			return compare(
				`${s.method} ${s.name} (${s.user}, ${s.connections ?? CONNECTIONS} connections, p95 at ${rate} req/s)`,
				combine(throughput.directus, latency.directus),
				combine(throughput.backoffice, latency.backoffice),
			);
		});
		verdicts.push(s.notBlocking ? { ...verdict, notBlocking: s.notBlocking } : verdict);
		process.stdout.write(`${table([verdicts.at(-1)!])}\n`);
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
		`## Benchmark system\n\nSeed: ${seeded.seconds} s, ${sizes}.\n\n${report}\n`,
	);

process.exit(gatePasses(verdicts) ? 0 : 1);
