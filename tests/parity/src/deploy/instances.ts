// Feature 019 (contracts/tests.md): the instances of deploy/compose (project bo-deploy) that the acceptance suite
// calls directly, and the docker compose command the suite and its global setup share.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// DEPLOY_PROJECT: another project name, to run the suite on a machine that keeps a bo-deploy environment.
export const PROJECT = process.env['DEPLOY_PROJECT'] ?? 'bo-deploy';
export const TAG = process.env['BACKOFFICE_TAG'] ?? 'local';
export const API_IMAGE = `hiennd23/backoffice-api:${TAG}`;
export const WEB_IMAGE = `hiennd23/backoffice-web:${TAG}`;
export const DIRECTUS_IMAGE = 'directus/directus:11.17.4';
export const COMPOSE_DIR = fileURLToPath(new URL('../../../../deploy/compose/', import.meta.url));
export const ENV_FILE = process.env['DEPLOY_ENV_FILE'] ?? `${COMPOSE_DIR}.env.deploy-test`;
export const REPLICAS = Number(process.env['BACKOFFICE_REPLICAS'] ?? 3);
export const SEPARATE = process.env['DEPLOY_MODE'] === 'separate-domain';
/** Spec 021 (US5): docker-compose.standalone.yml, no Directus. */
export const STANDALONE = process.env['DEPLOY_MODE'] === 'standalone';

export const lbUrl = 'http://127.0.0.1:8090';
/**
 * The instance the cases set up and check data through: Directus; in the standalone mode (no Directus, spec 021 FR-103)
 * the load balancer, whose pool holds the BE replicas only.
 */
export const directusUrl = STANDALONE ? lbUrl : 'http://127.0.0.1:8095';
/** Backoffice domain of the separate-domain mode. */
export const boLbUrl = 'http://127.0.0.1:8091';

/** Arguments of `docker compose` for this project, mode and env file. */
export function composeArgs(
	args: string[],
	separate = SEPARATE,
	envFile = ENV_FILE,
	standalone = STANDALONE,
): string[] {
	const files = [
		'-f',
		'docker-compose.yml',
		...(separate ? ['-f', 'docker-compose.separate-domain.yml'] : []),
		...(standalone ? ['-f', 'docker-compose.standalone.yml'] : []),
	];
	return ['compose', '-p', PROJECT, '--env-file', envFile, ...files, ...args];
}

export function compose(...args: string[]): string {
	return execFileSync('docker', composeArgs(args), {
		cwd: COMPOSE_DIR,
		encoding: 'utf8',
		env: { ...process.env, DEPLOY_ENV_FILE: ENV_FILE },
	});
}

/** Container name of replica `index` (1-based) of a service. */
export const containerName = (service: string, index = 1) => `${PROJECT}-${service}-${index}`;

/** Base URL of BE replica `index` (1-based), through its published random port. */
export function replicaUrl(index: number): string {
	const [, port] = compose('port', '--index', String(index), 'backoffice-api', '8055').trim().split(':');
	return `http://127.0.0.1:${port}`;
}

/** The BE replicas, then Directus (not in the standalone mode): the instances of the load balancer pool. */
export function instanceUrls(replicas = REPLICAS, standalone = STANDALONE): string[] {
	const replicaUrls = Array.from({ length: replicas }, (_, i) => replicaUrl(i + 1));
	return standalone ? replicaUrls : [...replicaUrls, directusUrl];
}

/** Values of the env file shared by Directus and the BE (KEY=VALUE lines). */
export function sharedEnv(file = ENV_FILE): Record<string, string> {
	return parseEnv(readFileSync(file, 'utf8'));
}

export function parseEnv(text: string): Record<string, string> {
	const env: Record<string, string> = {};
	for (const line of text.split('\n')) {
		const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
		if (match) env[match[1]!] = match[2]!;
	}
	return env;
}

/**
 * fetch with one retry when the server closed a pooled keep-alive socket as the request went out (undici
 * UND_ERR_SOCKET, "other side closed"): nothing reached the app, so sending again is safe (CI run 39368507371).
 */
async function send(input: URL, init: RequestInit): Promise<Response> {
	try {
		return await fetch(input, init);
	} catch (error) {
		if ((error as { cause?: { code?: string } }).cause?.code !== 'UND_ERR_SOCKET') throw error;
		return fetch(input, init);
	}
}

/** Access token of the admin of the shared env file, issued by `url`. */
export async function adminToken(url: string): Promise<string> {
	const env = sharedEnv();
	const res = await send(new URL('/auth/login', url), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: env['ADMIN_EMAIL'], password: env['ADMIN_PASSWORD'] }),
	});
	if (!res.ok) throw new Error(`login at ${url} failed: ${res.status} ${await res.text()}`);
	return ((await res.json()) as { data: { access_token: string } }).data.access_token;
}

export const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8' }).trim();

/** Starts a throwaway container with `env`, publishes `port` on a random local port and returns its id and URL. */
export function runContainer(image: string, env: string[], port: number, extra: string[] = []) {
	const id = docker(
		'run',
		'-d',
		'--platform',
		'linux/amd64',
		'-p',
		`127.0.0.1::${port}`,
		...env.flatMap((e) => ['-e', e]),
		...extra,
		image,
	);
	const [, hostPort] = docker('port', id, String(port)).split('\n')[0]!.split(':');
	return { id, url: `http://127.0.0.1:${hostPort}` };
}

/** Polls `url` until it answers 2xx, or throws after `timeoutMs`. */
export async function waitFor(url: string, timeoutMs = 300_000): Promise<void> {
	const end = Date.now() + timeoutMs;
	for (;;) {
		const ok = await fetch(url)
			.then((r) => r.ok)
			.catch(() => false);
		if (ok) return;
		if (Date.now() > end) throw new Error(`${url} did not answer in ${timeoutMs} ms`);
		await new Promise((r) => setTimeout(r, 1000));
	}
}

/** A Directus 11.17.4 on SQLite with extra env, to read what Directus itself answers (CSP of /admin...). */
export function runDirectus(env: string[]) {
	return runContainer(
		DIRECTUS_IMAGE,
		[
			'SECRET=deploy-test',
			'DB_CLIENT=sqlite3',
			'DB_FILENAME=/tmp/data.db',
			'ADMIN_EMAIL=admin@example.com',
			'ADMIN_PASSWORD=deploy-test',
			'PUBLIC_URL=http://localhost',
			'WEBSOCKETS_ENABLED=false',
			...env,
		],
		8055,
	);
}

export interface ApiResponse {
	status: number;
	headers: Headers;
	body: any;
}

/** A JSON request to an instance; never throws on 4xx/5xx (the cases check the status). */
export async function api(
	url: string,
	method: string,
	path: string,
	opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiResponse> {
	const res = await send(new URL(path, url), {
		method,
		redirect: 'manual',
		headers: {
			...(opts.body === undefined ? {} : { 'content-type': 'application/json' }),
			...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
			...opts.headers,
		},
		...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
	});
	const text = await res.text();
	let body: any = text;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		// not JSON
	}
	return { status: res.status, headers: res.headers, body };
}

/** Lines of the load balancer access log (`$remote_addr "$request" $status $upstream_addr $upstream_status`). */
export function lbLog(since?: string): string[] {
	return compose('logs', '--no-log-prefix', '--no-color', ...(since ? ['--since', since] : []), 'lb')
		.split('\n')
		.filter((l) => l.includes('"'));
}

/** IP of a container in the compose network. */
export function containerIp(name: string): string {
	return docker('inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', name);
}

/** Runs SQL in the shared Postgres (one value per line). */
export function psql(sql: string): string[] {
	const env = sharedEnv();
	return compose('exec', '-T', 'postgres', 'psql', '-U', env['DB_USER']!, '-d', env['DB_DATABASE']!, '-Atc', sql)
		.trim()
		.split('\n')
		.filter(Boolean);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
