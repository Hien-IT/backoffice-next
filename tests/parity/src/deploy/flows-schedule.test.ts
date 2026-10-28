// Feature 019, US5 (FR-062): a schedule flow runs once per tick over 3 BE replicas + Directus (spec 021: no Directus
// in the standalone mode) (shared clock and lock in
// Redis, SYNCHRONIZATION_STORE=redis), and keeps running each tick when the instance of a tick is stopped.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	adminToken,
	api,
	compose,
	containerName,
	directusUrl,
	docker,
	REPLICAS,
	sleep,
	STANDALONE,
} from './instances.js';

const TICK = 2000;
const TICKS = 10;
const PREFIX = `deploy-flow-${randomUUID().slice(0, 8)}-`;
let admin: string;
let flowId: string;

const containers = () => [
	...Array.from({ length: REPLICAS }, (_, i) => containerName('backoffice-api', i + 1)),
	...(STANDALONE ? [] : [containerName('directus')]),
];

/** Log lines of the flow's log operation, per container (the instance that ran each tick). */
function executions(): Record<string, number> {
	return Object.fromEntries(containers().map((c) => [c, docker('logs', c).split(PREFIX).length - 1]));
}

async function runs(): Promise<number> {
	// A filter that never repeats: the run rows are written by the job, which does not purge the shared response cache
	// (CACHE_ENABLED), so the same query would keep its cached count.
	const fresh = `filter[id][_neq]=${-(Date.now() % 1e9)}`; // an integer id: stay within int4
	const path = `/activity?filter[action][_eq]=run&filter[item][_eq]=${flowId}&${fresh}&limit=-1&fields=id`;
	return (await api(directusUrl, 'GET', path, { token: admin })).body.data.length;
}

/** Activates the flow, counts the runs of TICKS ticks from its first run, deactivates it. */
async function window(during?: () => Promise<void>) {
	const before = { runs: await runs(), logs: executions() };
	await api(directusUrl, 'PATCH', `/flows/${flowId}`, { token: admin, body: { status: 'active' } });
	const end = Date.now() + 30_000;
	while ((await runs()) === before.runs && Date.now() < end) await sleep(100);
	const start = Date.now();
	await during?.();
	// Not before the TICKS-th tick (a duplicate run still shows as one too many), then as soon as the TICKS-th run is
	// read: the deactivation then has up to a whole tick to reach every instance (CI 39797665422 saw an 11th run when it
	// was sent half a tick after the TICKS-th tick). Half a tick later at most: a tick lost with a stopped instance.
	const deadline = start + (TICKS - 1) * TICK + TICK / 2;
	await sleep(start + (TICKS - 1) * TICK - Date.now());
	while ((await runs()) - before.runs < TICKS && Date.now() < deadline) await sleep(100);
	await api(directusUrl, 'PATCH', `/flows/${flowId}`, { token: admin, body: { status: 'inactive' } });
	await sleep(TICK);
	const logs = executions();
	const total = Object.entries(logs).reduce((sum, [c, n]) => sum + n - (before.logs[c] ?? 0), 0);
	return { runs: (await runs()) - before.runs, logs: total };
}

beforeAll(async () => {
	admin = await adminToken(directusUrl);
	flowId = randomUUID();
	await api(directusUrl, 'POST', '/flows', {
		token: admin,
		body: {
			id: flowId,
			name: 'deploy schedule',
			status: 'inactive',
			trigger: 'schedule',
			options: { cron: '*/2 * * * * *' },
			accountability: 'all',
		},
	});
	const op = randomUUID();
	await api(directusUrl, 'POST', '/operations', {
		token: admin,
		body: {
			id: op,
			key: 'log',
			name: 'log',
			type: 'log',
			options: { message: `${PREFIX}tick` },
			position_x: 1,
			position_y: 1,
			flow: flowId,
		},
	});
	await api(directusUrl, 'PATCH', `/flows/${flowId}`, { token: admin, body: { operation: op } });
});

afterAll(async () => {
	if (flowId) await api(directusUrl, 'DELETE', `/flows/${flowId}`, { token: admin });
});

describe('schedule flow over the pool', () => {
	it(`runs once per tick over ${TICKS} ticks`, async () => {
		const result = await window();
		expect(result.runs).toBe(TICKS);
		expect(result.logs).toBe(TICKS);
	}, 90_000);

	it('keeps one run per tick when a BE replica stops on SIGTERM', async () => {
		const victim = containerName('backoffice-api', 2);
		try {
			const result = await window(async () => {
				await sleep(3 * TICK);
				docker('kill', '-s', 'TERM', victim);
			});
			// The stopped replica may have held the tick it stopped in; the next ticks run elsewhere.
			expect(result.runs).toBeGreaterThanOrEqual(TICKS - 1);
			expect(result.runs).toBeLessThanOrEqual(TICKS);
			expect(result.logs).toBe(result.runs);
		} finally {
			compose('up', '-d', '--wait', 'backoffice-api');
		}
	}, 120_000);
});
