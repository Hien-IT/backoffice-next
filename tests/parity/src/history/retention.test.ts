// Feature 008, US5 (spec FR-050 to FR-053, SC-005, contracts/parity.md §1): the retention job of each app on the
// `retention` pair, which this file alone starts and stops (it shares the database and deletes history older than
// 2 s every 10 s). History is written through the main pair, so no host write is needed (SQLite on Linux CI). The
// lock key `schedule--data-retention` is watched with redis-cli MONITOR to count which process ran each tick.
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { awaitDirectusConnection } from '../await-connection.js';
import { profilePorts } from '../config.js';
import { appRequest } from '../directus-api.js';
import { compose, profileStop, profileUp } from '../docker.js';
import { cleanup } from '../permissions/fixtures.js';
import { historyCollection } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const POSTS = `parity_ret_posts_${run}`;
const SERVICES = { directus: 'directus-retention', backoffice: 'backoffice-api-retention' } as const;
const TICK = 10_000;

/** IP of the container of a service in the compose network. */
function addressOf(service: string): string {
	const id = compose('ps', '-q', service).trim();
	return execFileSync('docker', ['inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', id], {
		encoding: 'utf8',
	}).trim();
}

/** The clients that set the retention lock during `seconds`, grouped by tick of the 10 s schedule. */
function lockSetters(seconds: number): Map<number, Set<string>> {
	const out = compose('exec', '-T', 'redis', 'sh', '-c', `timeout ${seconds} redis-cli monitor || true`);
	const ticks = new Map<number, Set<string>>();

	for (const line of out.split('\n')) {
		const match = line.match(/^(\d+)\.\d+ \[\d+ ([\d.]+):\d+\] "set" "[^"]*schedule--data-retention"/i);
		if (!match) continue;
		const tick = Math.floor((Number(match[1]) * 1000) / TICK);
		if (!ticks.has(tick)) ticks.set(tick, new Set());
		ticks.get(tick)!.add(match[2]!);
	}

	return ticks;
}

/** One item written, changed and kept through the main pair: its activity and revision ids. */
async function history(): Promise<{ activity: number[]; revisions: number[] }> {
	const item = (await appRequest('directus', 'POST', `/items/${POSTS}`, { title: 'old soon' })).data.id;
	await appRequest('backoffice', 'PATCH', `/items/${POSTS}/${item}`, { title: 'older soon' });
	const activity = (await hostDb()('directus_activity').where({ collection: POSTS, item }).select('id')).map((r) =>
		Number(r['id']),
	);
	const revisions = (await hostDb()('directus_revisions').whereIn('activity', activity).select('id')).map((r) =>
		Number(r['id']),
	);
	return { activity, revisions };
}

async function left(ids: { activity: number[]; revisions: number[] }) {
	const activity = await hostDb()('directus_activity').whereIn('id', ids.activity).count({ n: '*' });
	const revisions = await hostDb()('directus_revisions').whereIn('id', ids.revisions).count({ n: '*' });
	return { activity: Number(activity[0]!['n']), revisions: Number(revisions[0]!['n']) };
}

async function up(service: string, port: number) {
	compose('up', '-d', '--wait', service);
	await awaitDirectusConnection(`http://127.0.0.1:${port}`, 60, 1000);
}

beforeAll(async () => {
	await historyCollection(POSTS);
	profileUp('retention');
	await awaitDirectusConnection(`http://127.0.0.1:${profilePorts.retention.directus}`, 60, 1000);
	await awaitDirectusConnection(`http://127.0.0.1:${profilePorts.retention.backoffice}`, 60, 1000);
}, 300_000);

afterAll(async () => {
	profileStop('retention');
	await cleanup();
	await closeHostDb();
}, 300_000);

describe('the retention job (US5)', () => {
	it.each([
		['backoffice', 'directus'],
		['directus', 'backoffice'],
	] as const)(
		'only %s runs: the history of both apps older than the timeframes is gone after a tick',
		async (runs, stopped) => {
			compose('stop', SERVICES[stopped]);

			try {
				const ids = await history();
				expect(ids.activity.length).toBeGreaterThan(0);

				const setters = lockSetters((2 * TICK) / 1000 + 3);
				expect(await left(ids)).toEqual({ activity: 0, revisions: 0 });
				expect([...new Set([...setters.values()].flatMap((s) => [...s]))]).toEqual([addressOf(SERVICES[runs])]);
			} finally {
				await up(SERVICES[stopped], profilePorts.retention[stopped]);
			}
		},
		120_000,
	);

	it('both run: one process takes the lock in each of 10 ticks, and the old history is gone (SC-005)', async () => {
		const ids = await history();
		const setters = lockSetters((10 * TICK) / 1000 + 3);

		expect(setters.size).toBeGreaterThanOrEqual(10);
		for (const [tick, clients] of setters) expect([...clients], `tick ${tick}`).toHaveLength(1);
		expect(await left(ids)).toEqual({ activity: 0, revisions: 0 });
	}, 180_000);
});
