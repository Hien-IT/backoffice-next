import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getDbsToTest } from './get-dbs-to-test.js';

const cwd = fileURLToPath(new URL('..', import.meta.url));

/** `docker compose` on the running parity environment of TEST_DB (project parity-<vendor>). */
export function compose(...args: string[]): string {
	const [vendor] = getDbsToTest();
	// Every profile is enabled so that commands naming profile services (stop/start of the pairs) reach them.
	const profiles = [
		vendor!,
		'ratelimit',
		'cors-hsts',
		'pressure',
		'metrics',
		'multi',
		'cache-config',
		'sso',
		'user-limits',
		'app',
		// Feature 005 (research R5): the cache pairs, their Redis (redis-cache) and the WebSocket pair.
		'cache-mem',
		'cache-mem-purge',
		'cache-redis',
		'cache-redis-purge',
		'websocket',
		// Feature 006 (research R7): the blackbox pair and the nodes of schema-cache.test.ts and of the timezone files.
		'blackbox',
		'schema-cache',
		'schema-cache-nomsg',
		'tz-asia',
		'tz-america',
	].flatMap((p) => ['--profile', p]);

	return execFileSync(
		'docker',
		['compose', '-p', `parity-${vendor}`, '-f', 'docker-compose.yml', ...profiles, ...args],
		{
			cwd,
			env: { ...process.env, TEST_DB: vendor },
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			// `logs` of a long-running environment passes the 1 MB default (ENOBUFS).
			maxBuffer: 256 * 1024 * 1024,
		},
	);
}

/** Container logs of a service (stdout + stderr). */
export function logs(service: string): string {
	return compose('logs', '--no-color', '--no-log-prefix', service);
}

/** Exit code of a stopped service container. */
export function exitCode(service: string): number {
	const id = compose('ps', '-a', '-q', service).trim();
	return Number(execFileSync('docker', ['inspect', '-f', '{{.State.ExitCode}}', id], { encoding: 'utf8' }).trim());
}

/**
 * Stops the Redis server inside the running container (`redis`, or `redis-cache` of the cache-redis pair): clients get
 * ECONNREFUSED (see docker-compose.yml).
 */
export function redisDown(service = 'redis'): void {
	compose('exec', '-T', service, 'sh', '-c', 'touch /tmp/down; redis-cli shutdown nosave || true');
}

/** Starts the Redis server again and waits until it answers PING. */
export async function redisUp(service = 'redis'): Promise<void> {
	compose('exec', '-T', service, 'rm', '-f', '/tmp/down');

	for (let i = 0; i < 50; i++) {
		try {
			if (compose('exec', '-T', service, 'redis-cli', 'ping').includes('PONG')) return;
		} catch {
			// not up yet
		}
		await new Promise((r) => setTimeout(r, 200));
	}

	throw new Error('Redis did not come back');
}
