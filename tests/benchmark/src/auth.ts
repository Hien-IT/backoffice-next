// Benchmark of the auth routes against Directus 11.17.4 (SC-007, research R12 of spec 003), like run.ts: per endpoint a
// warm-up, then BENCH_ROUNDS rounds alternating the apps in two phases (throughput, then p95 at 80% of the Directus
// req/s), compared by compare.ts (10%, a round with errors fails). 2,000 connections. autocannon resets the request
// context each time a connection loops over `requests` (here: every request), so state lives outside it: users and
// access tokens go round-robin, refresh tokens through a pool (a request takes one, its answer gives the next).
// Requests still open when a round ends are dropped by autocannon without counting as errors (Client#destroy
// removes the error listeners first; T064). Needs `benchmark:env-up` first.
import { appendFileSync } from 'node:fs';
import autocannon from 'autocannon';
import jwt from 'jsonwebtoken';
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
import { cleanup, PASSWORD, SECRET, type Seed, seed, sessions, USERS } from './seed-auth.ts';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
const BACKOFFICE = process.env['BACKOFFICE_URL'] ?? 'http://127.0.0.1:8156';
const ROUNDS = Number(process.env['BENCH_ROUNDS'] ?? 3);
const DURATION = Number(process.env['BENCH_DURATION'] ?? 20);
const CONNECTIONS = Number(process.env['BENCH_CONNECTIONS'] ?? 2000);
const WARMUP = 5;
const RATE_SHARE = 0.8;
// A login waits for argon2 (4 threads) and LOGIN_STALL_TIME behind up to 2,000 others: never a timeout.
const TIMEOUT = 120;

interface Endpoint {
	name: string;
	/** Requests of one measured run; called right before it (refresh takes a fresh batch of sessions). */
	requests: () => Promise<autocannon.Request[]>;
}

function endpoints(seeded: Seed): Endpoint[] {
	const json = { 'content-type': 'application/json' };

	return [
		{
			name: 'POST /auth/login',
			requests: async () => {
				let next = 0;

				return [
					{
						method: 'POST',
						path: '/auth/login',
						headers: json,
						setupRequest: (req) => ({
							...req,
							body: JSON.stringify({ email: seeded.email(next++ % USERS), password: PASSWORD }),
						}),
					},
				];
			},
		},
		{
			name: 'POST /auth/refresh (json)',
			requests: async () => {
				const pool = await sessions(seeded);

				return [
					{
						method: 'POST',
						path: '/auth/refresh',
						headers: json,
						setupRequest: (req) => ({ ...req, body: JSON.stringify({ refresh_token: pool.shift() }) }),
						onResponse: (status, body) => {
							if (status === 200) pool.push(JSON.parse(body).data.refresh_token);
						},
					},
				];
			},
		},
		{
			// The authenticate step: a signed access token of a user of another provider, answered without a password
			// and without writing (the only route of feature 003 that needs a user).
			name: 'POST /users/me/tfa/generate',
			requests: async () => {
				const tokens = seeded.provider.map((id) =>
					jwt.sign({ id, role: seeded.role, app_access: true, admin_access: false }, SECRET, {
						expiresIn: '1h',
						issuer: 'directus',
					}),
				);

				let next = 0;

				return [
					{
						method: 'POST',
						path: '/users/me/tfa/generate',
						headers: json,
						body: '{}',
						setupRequest: (req) => ({
							...req,
							headers: { ...req.headers, authorization: `Bearer ${tokens[next++ % tokens.length]}` },
						}),
					},
				];
			},
		},
	];
}

async function measure(baseUrl: string, endpoint: Endpoint, duration: number, overallRate?: number): Promise<Round> {
	const histogram = createLatencyHistogram();
	const requests = await endpoint.requests();

	const result = await new Promise<autocannon.Result>((resolve, reject) => {
		const options = {
			url: baseUrl,
			connections: CONNECTIONS,
			duration,
			timeout: TIMEOUT,
			requests,
			...(overallRate ? { overallRate } : {}),
		};

		const instance = autocannon(options, (err, res) => (err ? reject(err) : resolve(res)));
		instance.on('response', (_client, _status, _bytes, responseTime) => recordLatency(histogram, responseTime));
	});

	const round = {
		p95: percentile(histogram, 95),
		rps: Math.round(result.requests.average),
		errors: result.errors + result.timeouts + result.non2xx,
	};

	// Progress in the job log: which app and phase, and what failed (status codes, connection errors, timeouts).
	const app = baseUrl === DIRECTUS ? 'Directus' : 'Backoffice';
	const codes = Object.entries(result.statusCodeStats ?? {})
		.map(([code, { count }]) => `${code}:${count}`)
		.join(' ');

	process.stdout.write(
		`${endpoint.name} ${app} ${overallRate ? `@${overallRate} req/s` : 'throughput'} ${duration}s: ` +
			`${round.rps} req/s, p95 ${round.p95} ms, errors ${result.errors}, timeouts ${result.timeouts}, ${codes}\n`,
	);

	return round;
}

const combine = (throughput: Round[], latency: Round[]): Round[] =>
	throughput.map((t, i) => ({ rps: t.rps, p95: latency[i]!.p95, errors: t.errors + latency[i]!.errors }));

const seeded = await seed();
const verdicts: Verdict[] = [];

try {
	for (const endpoint of endpoints(seeded)) {
		await measure(DIRECTUS, endpoint, WARMUP);
		await measure(BACKOFFICE, endpoint, WARMUP);

		const throughput = { directus: [] as Round[], backoffice: [] as Round[] };

		for (let i = 0; i < ROUNDS; i++) {
			throughput.directus.push(await measure(DIRECTUS, endpoint, DURATION));
			throughput.backoffice.push(await measure(BACKOFFICE, endpoint, DURATION));
		}

		const rate = Math.max(1, Math.round(RATE_SHARE * median(throughput.directus.map((r) => r.rps))));
		const latency = { directus: [] as Round[], backoffice: [] as Round[] };

		for (let i = 0; i < ROUNDS; i++) {
			latency.directus.push(await measure(DIRECTUS, endpoint, DURATION, rate));
			latency.backoffice.push(await measure(BACKOFFICE, endpoint, DURATION, rate));
		}

		verdicts.push(
			compare(
				`${endpoint.name} (p95 at ${rate} req/s)`,
				combine(throughput.directus, latency.directus),
				combine(throughput.backoffice, latency.backoffice),
			),
		);
	}
} finally {
	const report = table(verdicts);
	process.stdout.write(`${report}\n`);
	if (process.env['GITHUB_STEP_SUMMARY'])
		appendFileSync(process.env['GITHUB_STEP_SUMMARY'], `## Benchmark auth (${CONNECTIONS} connections)\n\n${report}\n`);

	// A failed cleanup (an app down) must not hide the results above.
	await cleanup(seeded).catch((err) => process.stderr.write(`cleanup failed: ${err}\n`));
}

process.exit(verdicts.length === endpoints(seeded).length && gatePasses(verdicts) ? 0 : 1);
