// Feature 009, US2 (spec FR-011, FR-062, SC-004, R-23; research R11, R12; contracts/parity.md §2): the scheduled flow of
// the Directus blackbox schedule-hook.test.ts on the `flows-schedule` pair, which this file alone starts and stops (it
// shares the database). Both apps share the clock in Redis (SYNCHRONIZATION_STORE=redis, own namespace), so each tick
// of `*/2 * * * * *` runs once in total. As in the Directus test, counting starts at the first run.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { awaitDirectusConnection } from '../await-connection.js';
import { profilePorts } from '../config.js';
import { appRequest } from '../directus-api.js';
import { compose, logs, profileStop, profileUp } from '../docker.js';
import { runRows, seedFlow, sleep, until } from './helpers.js';

const SERVICES = { directus: 'directus-flows-schedule', backoffice: 'backoffice-api-flows-schedule' } as const;
const PAIR = `http://127.0.0.1:${profilePorts['flows-schedule'].directus}`;
const PAIR_BACKOFFICE = `http://127.0.0.1:${profilePorts['flows-schedule'].backoffice}`;
const PREFIX = 'flow-executed-on-';
const TICK = 2000;
const TICKS = 10;

let flowId: string;
/** The app of the pair that takes the writes (the other one may be stopped). */
let writer = PAIR;

const patch = (data: Record<string, unknown>) => appRequest('directus', 'PATCH', `/flows/${flowId}`, data, writer);

/** `flow-executed-on-<app>` lines of both containers of the pair, by app. */
function executions(): Record<'directus' | 'backoffice', number> {
	const count = (service: string) => logs(service).split(PREFIX).length - 1;
	return { directus: count(SERVICES.directus), backoffice: count(SERVICES.backoffice) };
}

/** Activates the flow, waits for its first run, lets `TICKS` ticks pass from there, deactivates it. */
async function window(during?: (start: number) => Promise<void>) {
	const before = executions();
	const lastRun = Number((await runRows(flowId)).at(-1)?.['id'] ?? 0);

	await patch({ status: 'active' });
	expect(await until(async () => (await runRows(flowId, lastRun)).length > 0, 10_000, 50)).toBe(true);
	const start = Date.now();

	await during?.(start);
	await sleep(start + (TICKS - 1) * TICK + TICK / 2 - Date.now());
	await patch({ status: 'inactive' });
	await sleep(TICK);

	const after = executions();
	return {
		runs: (await runRows(flowId, lastRun)).length,
		directus: after.directus - before.directus,
		backoffice: after.backoffice - before.backoffice,
	};
}

beforeAll(async () => {
	profileUp('flows-schedule');
	await awaitDirectusConnection(PAIR, 60, 1000);
	await awaitDirectusConnection(PAIR_BACKOFFICE, 60, 1000);

	// Port of directus/tests/blackbox/tests/common/flows/schedule-hook.seed.ts, through the pair, inactive at first.
	({ id: flowId } = await seedFlow(
		{
			name: 'Schedule Hook Test',
			status: 'inactive',
			trigger: 'schedule',
			options: { cron: '*/2 * * * * *' },
			operations: [
				{ key: 'log_to_console', type: 'log', options: { message: `${PREFIX}{{ $env.FLOWS_SCHEDULE_HOOK_NAME }}` } },
			],
		},
		'directus',
		PAIR,
	));
}, 300_000);

afterAll(async () => {
	if (flowId) await appRequest('directus', 'DELETE', `/flows/${flowId}`, undefined, PAIR).catch(() => undefined);
	profileStop('flows-schedule');
	await closeHostDb();
}, 300_000);

describe('both apps share the clock', () => {
	it.each([1, 2, 3])(
		'round %i: each tick runs once, in total over both apps (SC-004)',
		async () => {
			const result = await window();

			expect(result.runs).toBe(TICKS);
			expect(result.directus + result.backoffice).toBe(TICKS);
		},
		60_000,
	);

	it.each([
		['directus', 'backoffice'],
		['backoffice', 'directus'],
	] as const)(
		'with %s stopped, %s runs every tick',
		async (stopped, running) => {
			compose('stop', SERVICES[stopped]);
			writer = running === 'directus' ? PAIR : PAIR_BACKOFFICE;

			try {
				const result = await window();
				expect(result.runs).toBe(TICKS);
				expect(result[running]).toBe(TICKS);
			} finally {
				writer = PAIR;
				compose('up', '-d', '--wait', SERVICES[stopped]);
				await awaitDirectusConnection(stopped === 'directus' ? PAIR : PAIR_BACKOFFICE, 60, 1000);
			}
		},
		120_000,
	);

	it('an invalid cron only warns at both apps and never runs', async () => {
		await patch({ options: { cron: 'not a cron' }, status: 'active' });
		const lastRun = Number((await runRows(flowId)).at(-1)?.['id'] ?? 0);
		await sleep(3 * TICK);

		expect(await runRows(flowId, lastRun)).toHaveLength(0);
		const warning = "Couldn't register cron trigger. Provided cron is invalid: not a cron";
		expect(logs(SERVICES.directus)).toContain(warning);
		expect(logs(SERVICES.backoffice)).toContain(warning);

		await patch({ options: { cron: '*/2 * * * * *' }, status: 'inactive' });
	}, 60_000);

	it('R-23: a reload right before a tick resets the clock; the window runs 10 or 11 times', async () => {
		const result = await window(async (start) => {
			// Just before the fifth tick after the first run.
			await sleep(start + 4 * TICK - 50 - Date.now());
			await patch({ name: 'Schedule Hook Test (renamed)' });
		});

		expect([TICKS, TICKS + 1]).toContain(result.runs);
		process.stdout.write(`R-23 window: ${JSON.stringify(result)}\n`);
	}, 60_000);
});
