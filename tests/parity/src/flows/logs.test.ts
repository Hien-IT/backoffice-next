// Feature 009 (T042; spec US6, FR-023, FR-062, SC-003, R7): the run log of a flow (one directus_activity row with
// action `run`, one directus_revisions row with the steps and the redacted data) written by each app for the same
// trigger, compared row by row; the Logs sidebar of the Directus app reads them back through /revisions.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, type ScenarioContext, scenario } from '../auth/scenario.js';
import { admin, call } from '../files/helpers.js';
import type { HistoryRows } from '../history/history-effects.js';
import { BROWSER, cleanupFlows, comparable, flowEffects, same, seedFlow, type SeededFlow } from './helpers.js';

const seeded: string[] = [];
const SECRET = 'parity-env-secret';

async function flow(def: Parameters<typeof seedFlow>[0]): Promise<SeededFlow> {
	const result = await seedFlow(def);
	seeded.push(result.id);
	return result;
}

const webhook = (accountability: 'all' | 'activity' | null) =>
	flow({
		trigger: 'webhook',
		options: { method: 'POST' },
		accountability,
		operations: [
			{ key: 'echo', type: 'transform', options: { json: '{{ $trigger.body }}' }, resolve: 'boom' },
			{ key: 'boom', type: 'throw-error', options: { code: 'PARITY', status: '418', message: 'teapot' } },
		],
	});

/** One trigger of the scenario and the run log rows it wrote, in their comparable form and raw. */
async function run(ctx: ScenarioContext, seededFlow: SeededFlow, headers: Record<string, string>, body: unknown) {
	const { result, rows } = await flowEffects(() =>
		call(ctx, {
			method: 'POST',
			path: `/flows/trigger/${seededFlow.id}`,
			headers: { ...BROWSER, ...headers },
			body: body as any,
		}),
	);

	return { status: result.status, rows, log: comparable(rows, seededFlow.ids) };
}

const revisionData = (rows: HistoryRows) => {
	const data = rows.revisions[0]?.['data'];
	return typeof data === 'string' ? JSON.parse(data) : data;
};

let all: SeededFlow;

beforeAll(async () => {
	all = await webhook('all');
}, 60_000);

afterAll(async () => {
	await cleanupFlows(seeded);
});

describe('accountability all', () => {
	test('one run activity and one revision per app, the same; secrets and the $env value redacted', async () => {
		const body = { password: 'p', token: 't', note: `the env value ${SECRET} inside a string`, keep: 'visible' };

		const transcripts = await scenario(urls(), async (ctx) => {
			const result = await run(ctx, all, { ...(await admin()), cookie: 'directus_session_token=x' }, { payload: body });
			const data = revisionData(result.rows);

			return {
				status: result.status,
				log: result.log,
				trigger: data.data.$trigger.body,
				authorization: data.data.$trigger.headers.authorization,
				cookie: data.data.$trigger.headers.cookie,
				boom: data.data.boom,
				steps: data.steps.map((s: any) => ({ key: s.key, status: s.status })),
			};
		});

		assertSameTranscripts(transcripts, 'run log');
		const d = transcripts.directus;

		expect(d.status).toBe(200);
		expect((d.log as any).activity).toHaveLength(1);
		expect((d.log as any).activity[0]).toMatchObject({ action: 'run', collection: 'directus_flows', item: '<flow>' });
		expect((d.log as any).revisions).toHaveLength(1);
		expect(d.authorization).toBe('--redacted--');
		expect(d.cookie).toBe('--redacted--');

		expect(d.trigger).toEqual({
			payload: {
				password: '--redacted--',
				token: '--redacted--',
				note: 'the env value --redacted:PARITY_FLOWS_ENV_TEST-- inside a string',
				keep: 'visible',
			},
		});

		// R7: the error of the rejected step as Directus' replacer writes it (stack deleted by executeOperation).
		expect(d.boom).toEqual({ name: 'DirectusError', message: 'teapot' });
		expect(d.steps).toEqual([
			{ key: 'echo', status: 'resolve' },
			{ key: 'boom', status: 'reject' },
		]);
	});

	test('a public trigger logs no user', async () => {
		const transcripts = await scenario(urls(), async (ctx) => (await run(ctx, all, {}, {})).log);

		assertSameTranscripts(transcripts, 'public run log');
		expect((transcripts.directus as any).activity[0].user).toBeNull();
	});
});

describe('other accountability settings', () => {
	test.each([
		['activity', 1, 0],
		[null, 0, 0],
	] as const)('accountability %s: %i activity row, %i revision', async (accountability, activities, revisions) => {
		const seededFlow = await webhook(accountability);
		const transcripts = await scenario(urls(), async (ctx) => (await run(ctx, seededFlow, {}, {})).log);

		assertSameTranscripts(transcripts, `accountability ${accountability}`);
		expect((transcripts.directus as any).activity).toHaveLength(activities);
		expect((transcripts.directus as any).revisions).toHaveLength(revisions);
	});
});

test('the flow of a trigger operation logs under its own id, before the flow that called it', async () => {
	const target = await flow({
		trigger: 'operation',
		options: { return: '$last' },
		operations: [{ key: 'inner', type: 'transform', options: { json: { inner: true } } }],
	});

	const outer = await flow({
		trigger: 'webhook',
		options: { method: 'POST' },
		operations: [{ key: 'call', type: 'trigger', options: { flow: target.id, payload: { n: 1 } } }],
	});

	const transcripts = await scenario(urls(), async (ctx) => {
		const { rows } = await flowEffects(() =>
			call(ctx, { method: 'POST', path: `/flows/trigger/${outer.id}`, body: {} }),
		);
		return comparable(rows, { ...target.ids, ...outer.ids, target: target.id, outer: outer.id });
	});

	assertSameTranscripts(transcripts, 'nested run log');
	expect((transcripts.directus as any).activity.map((a: any) => a.item)).toEqual(['<target>', '<outer>']);
});

test('the Logs sidebar of the Directus app: the queries of use-revisions.ts', async () => {
	const headers = await admin();
	const filter = encodeURIComponent(
		JSON.stringify({
			_and: [
				{ collection: { _eq: 'directus_flows' } },
				{ item: { _eq: all.id } },
				{ version: { _null: true } },
				{ activity: { action: { _eq: 'run' } } },
			],
		}),
	);

	const fields =
		'id,collection,item,activity.action,activity.timestamp,activity.user.id,activity.user.email,activity.ip,activity.user_agent,activity.origin,data,delta';

	await same({ path: `/revisions?filter=${filter}&sort=-id&limit=10&page=1&fields=${fields}`, headers });
	await same({ path: `/revisions?filter=${filter}&aggregate[count]=id`, headers });
});
