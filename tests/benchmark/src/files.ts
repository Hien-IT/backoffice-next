// Benchmark of /files and /assets against Directus 11.17.4 (feature 007, SC-006, contracts/parity.md §6), like items.ts:
// per scenario a warm-up, then BENCH_ROUNDS rounds alternating the apps, throughput then p95 at 80% of the Directus
// req/s, compared by compare.ts (10%). Scenarios: the original of 200 jpeg images of about 1 MB in turn (20 connections), their
// system-medium-cover made at seed, new transformations (20 widths of 10 images; the derived assets are deleted before
// every run, and 10 connections stay under ASSETS_TRANSFORM_MAX_CONCURRENT), the list of 50 files as an admin and as a
// user who reads half of them, and multipart uploads of 10 KB (removed after every run). Needs `benchmark:env-up` first.
import { appendFileSync } from 'node:fs';
import autocannon from 'autocannon';
import {
	compare,
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
import { cleanup, deleteDerived, deleteFiles, type FilesSeed, multipart, seed } from './seed-files.ts';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
const BACKOFFICE = process.env['BACKOFFICE_URL'] ?? 'http://127.0.0.1:8156';
const ROUNDS = Number(process.env['BENCH_ROUNDS'] ?? 3);
const DURATION = Number(process.env['BENCH_DURATION'] ?? 10);
const WARMUP = 5;
const CONNECTIONS = 50;
const TRANSFORM_CONNECTIONS = 10;
const RAW_CONNECTIONS = 20;
const RATE_SHARE = 0.8;
const WIDTHS = Array.from({ length: 20 }, (_, i) => 120 + i * 37);

type App = 'directus' | 'backoffice';

interface Scenario {
	name: string;
	method: 'GET' | 'POST';
	path: (n: number) => string;
	body?: { data: Buffer; contentType: string };
	user: 'admin' | 'user';
	connections?: number;
	/** Runs before every measured run (and after the last one). */
	reset?: () => Promise<void>;
}

function scenarios(seeded: FilesSeed): Scenario[] {
	const image = (n: number) => seeded.images[n % seeded.images.length];
	const transformed = seeded.images.slice(0, 10);
	const upload = multipart(`${seeded.tag}-upload.bin`, Buffer.alloc(10 * 1024, 7), 'application/octet-stream');

	return [
		// 20 connections: 50 streams of 1 MB images saturate a GitHub runner, and both apps then lose requests (benchmark
		// run 38383218274, 2026-10-13: errors at Directus and at the new app). The derived and list scenarios keep 50.
		{
			name: 'asset-raw',
			method: 'GET',
			path: (n) => `/assets/${image(n)}`,
			user: 'admin',
			connections: RAW_CONNECTIONS,
		},
		{
			name: 'asset-derived',
			method: 'GET',
			path: (n) => `/assets/${image(n)}?key=system-medium-cover`,
			user: 'admin',
		},
		{
			name: 'asset-transform',
			method: 'GET',
			path: (n) =>
				`/assets/${transformed[n % transformed.length]}?width=${WIDTHS[Math.floor(n / transformed.length) % WIDTHS.length]}`,
			user: 'admin',
			connections: TRANSFORM_CONNECTIONS,
			reset: async () => deleteDerived(),
		},
		...(['admin', 'user'] as const).map(
			(user): Scenario => ({ name: 'files-list', method: 'GET', path: () => '/files?limit=50', user }),
		),
		{
			name: 'files-upload',
			method: 'POST',
			path: () => '/files',
			body: { data: upload.body, contentType: upload.contentType },
			user: 'admin',
			reset: () => deleteFiles(seeded.tag, `${seeded.tag}-upload.bin`),
		},
	];
}

async function measure(seeded: FilesSeed, s: Scenario, app: App, duration: number, rate?: number): Promise<Round> {
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
						...(s.body ? { body: s.body.data } : {}),
						headers: {
							...req.headers,
							authorization: `Bearer ${seeded.tokens[s.user]}`,
							'cache-control': 'no-store',
							...(s.body ? { 'content-type': s.body.contentType } : {}),
						},
					}),
				},
			],
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
		rps: Math.round(result.requests.average),
		errors: result.errors + result.timeouts + result.non2xx,
	};
}

const seeded = await seed();
const sizes = `${seeded.images.length} images of ${Math.round(seeded.imageBytes / 1024)} KB`;
process.stdout.write(`seed: ${seeded.seconds} s, ${sizes}\n`);
const verdicts: Verdict[] = [];

try {
	for (const s of scenarios(seeded)) {
		await measure(seeded, s, 'directus', WARMUP);
		await measure(seeded, s, 'backoffice', WARMUP);

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

		await s.reset?.();

		const combine = (t: Round[], l: Round[]) =>
			t.map((r, i) => ({ rps: r.rps, p95: l[i]!.p95, errors: r.errors + l[i]!.errors }));

		const verdict = compare(
			`${s.method} ${s.name} (${s.user}, ${s.connections ?? CONNECTIONS} connections, p95 at ${rate} req/s)`,
			combine(throughput.directus, latency.directus),
			combine(throughput.backoffice, latency.backoffice),
		);
		verdicts.push(verdict);
		// Each row as soon as it is known: a later scenario that fails still leaves these.
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
		`## Benchmark files\n\nSeed: ${seeded.seconds} s, ${sizes}.\n\n${report}\n`,
	);

process.exit(gatePasses(verdicts) ? 0 : 1);
