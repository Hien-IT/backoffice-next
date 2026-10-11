// Redis helpers for the feature 002 parity tests (specs/002-schema-overview-cache/contracts/redis.md).
// The test process talks to the Redis of the environment through its host port, like the apps do inside Docker.
import { execFileSync, spawn } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { Redis } from 'ioredis';
import { compose } from './docker.js';

const REDIS_URL = process.env['PARITY_REDIS_URL'] ?? 'redis://127.0.0.1:6108';

let client: Redis | undefined;

/** Shared client of the test process. */
export function redis(): Redis {
	if (!client) {
		client = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
		// Some tests stop the Redis server on purpose (redisDown): reconnection errors are expected there.
		client.on('error', () => undefined);
	}

	return client;
}

/** A new connection, for SUBSCRIBE or MONITOR (a connection in those modes cannot run other commands). */
export function newConnection(): Redis {
	return new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
}

export async function closeRedis(): Promise<void> {
	await client?.quit();
	client = undefined;
}

/**
 * Deletes the response cache both apps share (Keyv namespace CACHE_NAMESPACE, store Redis in the parity env). With
 * CACHE_ENABLED=true both answer GET requests from it (feature 005), which would hide schema changes that are
 * announced without an auto purge (schemaChanged alone does not purge a Redis response cache).
 */
export async function clearResponseCache(cacheNs = 'system-cache'): Promise<void> {
	const r = redis();

	for await (const keys of r.scanStream({ match: `sets:namespace:${cacheNs}:*`, count: 500 })) {
		if ((keys as string[]).length > 0) await r.unlink(...(keys as string[]));
	}
}

/** Decodes a value written by @directus/memory or @backoffice/memory: gzip when it starts with the gzip header. */
export function decodeMessage(buf: Buffer): unknown {
	if (buf.length === 0) return undefined;
	const data = buf.length >= 19 && buf[0] === 0x1f && buf[1] === 0x8b && buf[2] === 0x08 ? gunzipSync(buf) : buf;
	return JSON.parse(data.toString('utf8'));
}

export type Namespaces = { busNs?: string; permNs?: string; cacheNs?: string };

/**
 * Clears what both apps share in Redis, so the next request of one app computes its own values instead of reading
 * those the other app wrote: permissions cache (Redis keys and, through `multi-cache`, the local layer of every
 * process) and the in-memory schema of every process (`schemaChanged`).
 */
export async function flushSharedCaches({
	busNs = 'directus:bus',
	permNs = 'permissions',
	cacheNs = 'system-cache',
}: Namespaces = {}) {
	const r = redis();
	await r.publish(`${permNs}:multi-cache`, JSON.stringify({ type: 'clear', origin: 'parity-test' }));

	// Permissions cache, and the shared response cache (CACHE_ENABLED=true in the parity env, feature 005): a cached
	// OAS response would skip the permission reads.
	for (const match of [`${permNs}:*`, `sets:namespace:${cacheNs}:*`]) {
		for await (const keys of r.scanStream({ match, count: 500 })) {
			if ((keys as string[]).length > 0) await r.unlink(...(keys as string[]));
		}
	}

	await r.publish(`${busNs}:schemaChanged`, '{}');
	await new Promise((resolve) => setTimeout(resolve, 200));
}

export type TracedCommand = { client: string; command: string; key: string };

/** Commands with a key or channel as first argument that the apps send (MONITOR shows all of them). */
const KEYED =
	/^(get|getbuffer|set|setex|psetex|del|unlink|exists|incrby|incr|keys|scan|publish|subscribe|unsubscribe|evalsha|eval|pexpire|expire)$/;

/**
 * Parses one MONITOR line, e.g. `1700000000.123456 [0 172.18.0.5:41234] "INCRBY" "directus:lock:x" "1"`.
 * Returns undefined for lines that are not commands.
 */
export function parseMonitorLine(line: string): TracedCommand | undefined {
	const match = /^\d+\.\d+ \[\d+ ([^\]]+)\] (.*)$/.exec(line.trim());
	if (!match) return undefined;

	const address = match[1]!;
	const args = [...match[2]!.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]!);
	const command = args[0]?.toLowerCase();
	if (!command) return undefined;

	// EVALSHA/EVAL: the key follows the script and the number of keys. UNLINK/DEL: every key, sorted, since the
	// order of a batch depends on SCAN or KEYS (split them with `expandKeys`). SCAN: the MATCH pattern, not the cursor.
	const matchAt = args.findIndex((a) => a.toLowerCase() === 'match');
	const key =
		command === 'evalsha' || command === 'eval'
			? (args[3] ?? '')
			: command === 'unlink' || command === 'del'
				? args.slice(1).sort().join(' ')
				: command === 'scan'
					? matchAt > 0
						? (args[matchAt + 1] ?? '')
						: ''
					: (args[1] ?? '');
	const client = address.startsWith('unix:') ? address : address.slice(0, address.lastIndexOf(':'));

	return { client, command, key: KEYED.test(command) ? key : '' };
}

/** One `<command> <key>` per key: UNLINK and DEL carry several keys. */
export function expandKeys({ command, key }: TracedCommand): string[] {
	return command === 'unlink' || command === 'del'
		? key.split(' ').map((k) => `${command} ${k}`)
		: [`${command} ${key}`];
}

/**
 * Runs `fn` while `redis-cli MONITOR` in the redis container records every command; returns them parsed. Not ioredis'
 * monitor(): with bus traffic it can take a MONITOR line for a reply and throw "Command queue state error" from its
 * socket handler (CI, feature 005).
 */
export async function traceRedis(fn: () => Promise<unknown>): Promise<TracedCommand[]> {
	const child = spawn('docker', ['exec', compose('ps', '-q', 'redis').trim(), 'redis-cli', 'monitor']);
	const lines: TracedCommand[] = [];
	let rest = '';

	await new Promise<void>((resolve, reject) => {
		child.stdout.setEncoding('utf8');

		child.stdout.on('data', (chunk: string) => {
			const parts = (rest + chunk).split('\n');
			rest = parts.pop()!;

			for (const line of parts) {
				// redis-cli prints OK once MONITOR runs.
				if (line.trim() === 'OK') resolve();
				const parsed = parseMonitorLine(line);
				if (parsed) lines.push(parsed);
			}
		});

		child.on('error', reject);
		child.on('exit', (code) => reject(new Error(`redis-cli monitor exited with ${code}`)));
	});

	try {
		await fn();
		// MONITOR output trails the commands slightly.
		await new Promise((resolve) => setTimeout(resolve, 300));
	} finally {
		child.kill();
	}

	return lines;
}

/** IP address of a service container of the running parity environment. */
export function containerAddress(service: string): string {
	const id = compose('ps', '-q', service).trim();

	return execFileSync('docker', ['inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', id], {
		encoding: 'utf8',
	}).trim();
}
