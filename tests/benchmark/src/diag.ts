// Diagnostics of a measured round (R11 reds of spec 020, owner 2026-10-22): CPU time of the app container and Redis GET
// calls, per request. They tell a port that spends more per request from one that only waits longer at saturation (same
// work, worse queueing) or reads Redis more (permissions cache kept in Redis only). Printed, never part of the verdict.
import { execFileSync } from 'node:child_process';
import { redis } from './redis.ts';

export type DiagApp = 'directus' | 'backoffice';

const CONTAINERS: Record<DiagApp, string> = {
	directus: process.env['BENCH_DIRECTUS_CONTAINER'] ?? 'benchmark-directus-1',
	backoffice: process.env['BENCH_BACKOFFICE_CONTAINER'] ?? 'benchmark-backoffice-api-1',
};

export interface Snapshot {
	/** CPU time of the container in microseconds (cgroup v2 `usage_usec`, v1 `cpuacct.usage` / 1000); null if unread. */
	cpuUsec: number | null;
	/** Redis `get` calls since the server started. */
	redisGets: number;
}

function cpuUsec(app: DiagApp): number | null {
	try {
		const out = execFileSync(
			'docker',
			[
				'exec',
				CONTAINERS[app],
				'sh',
				'-c',
				'cat /sys/fs/cgroup/cpu.stat 2>/dev/null || echo "usage_ns $(cat /sys/fs/cgroup/cpuacct/cpuacct.usage)"',
			],
			{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
		);
		const v2 = /usage_usec (\d+)/.exec(out);
		if (v2) return Number(v2[1]);
		const v1 = /usage_ns (\d+)/.exec(out);
		return v1 ? Math.round(Number(v1[1]) / 1000) : null;
	} catch {
		return null;
	}
}

async function redisGets(): Promise<number> {
	const stats = await redis.info('commandstats');
	const match = /cmdstat_get:calls=(\d+)/.exec(stats);
	return match ? Number(match[1]) : 0;
}

export async function snapshot(app: DiagApp): Promise<Snapshot> {
	return { cpuUsec: cpuUsec(app), redisGets: await redisGets() };
}

/** One line per round: `diag <label> <app> requests=… cpu_ms_per_req=… redis_get_per_req=…`. */
export function diagLine(label: string, app: DiagApp, before: Snapshot, after: Snapshot, requests: number): string {
	const per = (value: number) => (requests > 0 ? (value / requests).toFixed(3) : 'n/a');
	const cpu = before.cpuUsec !== null && after.cpuUsec !== null ? per((after.cpuUsec - before.cpuUsec) / 1000) : 'n/a';
	return `diag ${label} ${app} requests=${requests} cpu_ms_per_req=${cpu} redis_get_per_req=${per(after.redisGets - before.redisGets)}\n`;
}

/** CPU ms per request of a round (the Round `cpuMs`), null when the container CPU could not be read. */
export function cpuPerRequest(before: Snapshot, after: Snapshot, requests: number): number | null {
	if (before.cpuUsec === null || after.cpuUsec === null || requests <= 0) return null;
	return (after.cpuUsec - before.cpuUsec) / 1000 / requests;
}
