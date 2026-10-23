// Backoffice: behaviour of the ported FlowManager beyond the two DR tests of flows.test.ts (feature 009, tasks
// T015, T024, T026; spec FR-010 to FR-024, contracts/flows-api.md). The flow tree, redaction and option rendering are
// the real ported helpers; the database, bus, emitter, services and operations are mocks.
import type { FlowRaw, OperationRaw } from '@backoffice/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
	env: {} as Record<string, any>,
	flows: [] as any[],
	busHandler: null as null | ((message: any) => void),
	policies: [] as string[],
	permissions: [] as any[],
	readKeys: [] as any[],
}));

const logger = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), trace: vi.fn() }));
const bus = vi.hoisted(() => ({ subscribe: vi.fn(), publish: vi.fn() }));
const emitter = vi.hoisted(() => ({ onAction: vi.fn(), onFilter: vi.fn(), offAction: vi.fn(), offFilter: vi.fn() }));
const db = vi.hoisted(() => ({ name: 'database' }));
const activity = vi.hoisted(() => ({ createOne: vi.fn(async (_data: any) => 7) }));
const revisions = vi.hoisted(() => ({ createOne: vi.fn(async (_data: any) => 8) }));
const jobs = vi.hoisted(() => [] as { id: string; cron: string; cb: () => Promise<void>; stop: any }[]);
const readMany = vi.hoisted(() => vi.fn());

vi.mock('@backoffice/env', () => ({ useEnv: () => state.env }));
vi.mock('./logger/index.js', () => ({ useLogger: () => logger }));
vi.mock('./bus/index.js', () => ({ useBus: () => bus }));
vi.mock('./database/index.js', () => ({ default: () => db }));
vi.mock('./emitter.js', () => ({ default: emitter }));
vi.mock('./schema/get-database-schema.js', () => ({
	getSchema: vi.fn(async () => ({ collections: {}, relations: [] })),
}));

vi.mock('./services/flows.service.js', () => ({
	FlowsService: vi.fn(function (this: any) {
		this.readByQuery = vi.fn(async () => state.flows);
	}),
}));

vi.mock('./services/activity.service.js', () => ({
	ActivityService: vi.fn(function (this: any) {
		this.createOne = activity.createOne;
	}),
}));

vi.mock('./services/revisions.service.js', () => ({
	RevisionsService: vi.fn(function (this: any) {
		this.createOne = revisions.createOne;
	}),
}));

vi.mock('./services/index.js', () => ({ marker: 'services' }));
vi.mock('./permissions/lib/fetch-policies.js', () => ({ fetchPolicies: vi.fn(async () => state.policies) }));
vi.mock('./permissions/lib/fetch-permissions.js', () => ({ fetchPermissions: vi.fn(async () => state.permissions) }));
vi.mock('./utils/get-service.js', () => ({ getService: vi.fn(() => ({ readMany })) }));

vi.mock('./utils/schedule.js', () => ({
	validateCron: (cron: string) => cron !== 'not a cron',
	scheduleSynchronizedJob: vi.fn((id: string, cron: string, cb: () => Promise<void>) => {
		const job = { id, cron, cb, stop: vi.fn(async () => undefined) };
		jobs.push(job);
		return job;
	}),
}));

vi.mock('./operations/index.js', () => ({
	operations: [
		{ id: 'echo', handler: (options: any) => options },
		{ id: 'fail', handler: (options: any) => Promise.reject(new Error(options.message ?? 'failed')) },
		{ id: 'fail-json', handler: () => Promise.reject('{"status":404}') },
		{ id: 'fail-text', handler: () => Promise.reject('plain text') },
		{ id: 'bigint', handler: () => ({ big: BigInt(1) }) },
		{ id: 'nested-undefined', handler: () => ({ a: undefined, b: [undefined] }) },
		{ id: 'context', handler: (_options: any, context: any) => ({ hasServices: context.services.marker }) },
		{ id: 'log', handler: (options: any) => (state.env['__logged'] = options.message) },
	],
}));

const flowRaw = (overrides: Partial<FlowRaw>, operations: Partial<OperationRaw>[] = []): FlowRaw =>
	({
		id: 'f1',
		name: 'Flow',
		icon: null,
		color: null,
		description: null,
		status: 'active',
		trigger: 'webhook',
		options: {},
		accountability: 'all',
		date_created: 'now',
		user_created: 'u',
		operation: operations[0]?.id ?? null,
		operations: operations.map((operation, index) => ({
			key: `op${index}`,
			name: null,
			type: 'echo',
			position_x: 1,
			position_y: 1,
			options: {},
			resolve: null,
			reject: null,
			flow: overrides.id ?? 'f1',
			date_created: 'now',
			user_created: 'u',
			...operation,
		})),
		...overrides,
	}) as FlowRaw;

const accountability = {
	user: 'u1',
	role: 'r1',
	roles: ['r1'],
	admin: true,
	app: true,
	ip: '10.0.0.1',
	userAgent: 'ua',
	origin: 'o',
};

let getFlowManager: typeof import('./flows.js').getFlowManager;
let ForbiddenError: typeof import('@backoffice/errors').ForbiddenError;

async function loaded(flows: FlowRaw[], env: Record<string, any> = {}) {
	state.flows = flows;
	state.env = env;
	const manager = getFlowManager();
	await manager.initialize();
	return manager;
}

beforeEach(async () => {
	vi.resetModules();
	jobs.length = 0;
	state.policies = [];
	state.permissions = [];
	bus.subscribe.mockImplementation((_channel: string, handler: (message: any) => void) => {
		state.busHandler = handler;
	});
	bus.publish.mockImplementation(async (_channel: string, message: any) => state.busHandler?.(message));
	({ getFlowManager } = await import('./flows.js'));
	({ ForbiddenError } = await import('@backoffice/errors'));
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('load', () => {
	test('reads the active flows with their operations and registers the built-in operations first', async () => {
		const { FlowsService } = await import('./services/flows.service.js');
		const manager = await loaded([flowRaw({ trigger: 'webhook' }, [{ id: 'o1', type: 'context' }])]);

		const service = vi.mocked(FlowsService).mock.instances[0] as any;
		expect(service.readByQuery).toHaveBeenCalledWith({
			filter: { status: { _eq: 'active' } },
			fields: ['*', 'operations.*'],
			limit: -1,
		});

		const { result } = await manager.runWebhookFlow('GET-f1', {}, { accountability: undefined, schema: {} as any });
		expect(result).toEqual({ hasServices: 'services' });
	});

	test('event names: items.* scope × collections, system collections without the prefix, other scopes as is', async () => {
		await loaded([
			flowRaw({
				id: 'e1',
				trigger: 'event',
				options: { type: 'filter', scope: ['items.create', 'auth.login'], collections: ['articles', 'directus_users'] },
			}),
			flowRaw({ id: 'e2', trigger: 'event', options: { type: 'action', scope: 'items.update' } }),
		]);

		expect(emitter.onFilter.mock.calls.map(([event]) => event)).toEqual([
			'articles.items.create',
			'users.create',
			'auth.login',
		]);

		expect(emitter.onAction).not.toHaveBeenCalled();
	});

	test('schedule: valid cron registers a synchronized job named after the flow; an invalid one only warns', async () => {
		await loaded([
			flowRaw({ id: 's1', trigger: 'schedule', options: { cron: '*/2 * * * * *' } }),
			flowRaw({ id: 's2', trigger: 'schedule', options: { cron: 'not a cron' } }),
		]);

		expect(jobs.map(({ id, cron }) => [id, cron])).toEqual([['s1', '*/2 * * * * *']]);
		expect(logger.warn).toHaveBeenCalledWith("Couldn't register cron trigger. Provided cron is invalid: not a cron");
	});

	test.each([
		['memory store with a scheduled flow', 'memory', true, true],
		['redis store with a scheduled flow', 'redis', true, false],
		['memory store without scheduled flows', undefined, false, false],
	])('%s → warning %s', async (_label, store, scheduled, warned) => {
		const flows = scheduled ? [flowRaw({ trigger: 'schedule', options: { cron: '* * * * *' } })] : [];
		await loaded(flows, store ? { SYNCHRONIZATION_STORE: store } : {});

		const message = 'Backoffice: SYNCHRONIZATION_STORE is not redis; scheduled flows run on every instance';
		expect(logger.warn.mock.calls.filter(([line]) => line === message)).toHaveLength(warned ? 1 : 0);
	});

	test('a scheduled run without data logs its error and keeps the job', async () => {
		await loaded([flowRaw({ trigger: 'schedule', options: { cron: '* * * * *' } }, [{ id: 'o1', type: 'echo' }])]);
		activity.createOne.mockRejectedValueOnce(new Error('db down'));

		await jobs[0]!.cb();

		expect(logger.error).toHaveBeenCalledWith(new Error('db down'));
		expect(jobs[0]!.stop).not.toHaveBeenCalled();
	});
});

describe('event handlers', () => {
	test('filter: runs in the transaction of the request, returns the `return` value, throws $last on reject', async () => {
		await loaded([
			flowRaw({ id: 'ok', trigger: 'event', options: { type: 'filter', scope: 'auth.login', return: '$last' } }, [
				{ id: 'o1', type: 'echo', options: { title: 'changed {{ $trigger.payload.title }}' } },
			]),
			flowRaw({ id: 'no', trigger: 'event', options: { type: 'filter', scope: 'auth.jwt' } }, [
				{ id: 'o2', type: 'fail', options: { message: 'blocked' } },
			]),
		]);

		const handler = (event: string) => emitter.onFilter.mock.calls.find(([name]) => name === event)![1];
		const trx = { name: 'trx' };

		await expect(
			handler('auth.login')({ title: 'a' }, { event: 'auth.login' }, { database: trx, schema: {} }),
		).resolves.toEqual({ title: 'changed a' });

		expect(activity.createOne).toHaveBeenCalledTimes(1);
		const { ActivityService } = await import('./services/activity.service.js');
		expect(vi.mocked(ActivityService).mock.calls[0]![0]).toMatchObject({ knex: trx });

		await expect(handler('auth.jwt')({}, {}, { database: trx, schema: {} })).rejects.toMatchObject({
			message: 'blocked',
		});
	});

	test('action: gets the meta, uses the default database and swallows nothing itself', async () => {
		await loaded([
			flowRaw({ trigger: 'event', options: { type: 'action', scope: 'items.update', collections: ['articles'] } }, [
				{ id: 'o1', type: 'echo', options: { keys: '{{ $trigger.keys }}' } },
			]),
		]);

		const [event, handler] = emitter.onAction.mock.calls[0]!;
		expect(event).toBe('articles.items.update');

		await handler({ event, keys: [1], collection: 'articles' }, { accountability });
		const { ActivityService } = await import('./services/activity.service.js');
		expect(vi.mocked(ActivityService).mock.calls[0]![0]).toMatchObject({ knex: db });
		expect(revisions.createOne.mock.calls[0]![0].data.steps[0].options).toEqual({ keys: [1] });
	});
});

describe('runWebhookFlow', () => {
	const context = { accountability: undefined, schema: {} as any };

	test('no handler for the method and flow → ForbiddenError and a warning', async () => {
		await loaded([flowRaw({ trigger: 'webhook', options: { method: 'POST' } })]);

		await expect(getFlowManager().runWebhookFlow('GET-f1', {}, context)).rejects.toBeInstanceOf(ForbiddenError);
		expect(logger.warn).toHaveBeenCalledWith(`Couldn't find webhook or manual triggered flow with id "GET-f1"`);
	});

	test('webhook: GET by default, $last by default, cacheEnabled only turns off for GET', async () => {
		await loaded([
			flowRaw({ id: 'g', trigger: 'webhook', options: { cacheEnabled: false } }, [
				{ id: 'o1', type: 'echo', options: { body: '{{ $trigger.body }}' } },
			]),
			flowRaw({ id: 'p', trigger: 'webhook', options: { method: 'POST', cacheEnabled: false } }),
		]);

		await expect(getFlowManager().runWebhookFlow('GET-g', { body: { a: 1 } }, context)).resolves.toEqual({
			result: { body: { a: 1 } },
			cacheEnabled: false,
		});

		await expect(getFlowManager().runWebhookFlow('POST-p', { body: 'x' }, context)).resolves.toEqual({
			result: { body: 'x' },
			cacheEnabled: true,
		});
	});

	test('return $all, a path, and async (undefined result, the flow still runs)', async () => {
		await loaded(
			[
				flowRaw({ id: 'all', trigger: 'webhook', options: { return: '$all' } }, [
					{ id: 'o1', type: 'echo', options: { a: 1 } },
				]),
				flowRaw({ id: 'path', trigger: 'webhook', options: { return: '$trigger.query.x' } }),
				flowRaw({ id: 'async', trigger: 'webhook', options: { async: true, error_on_reject: true } }, [
					{ id: 'o3', type: 'fail' },
				]),
			],
			{ FLOWS_ENV_ALLOW_LIST: 'PUBLIC_URL', PUBLIC_URL: 'http://x', SECRET: 'hidden' },
		);

		const { result } = await getFlowManager().runWebhookFlow('GET-all', { query: {} }, context);
		expect(result).toEqual({
			$trigger: { query: {} },
			$last: { a: 1 },
			$accountability: null,
			$env: { PUBLIC_URL: 'http://x' },
			op0: { a: 1 },
		});

		await expect(getFlowManager().runWebhookFlow('GET-path', { query: { x: 'y' } }, context)).resolves.toMatchObject({
			result: 'y',
		});
		await expect(getFlowManager().runWebhookFlow('GET-async', {}, context)).resolves.toEqual({
			result: undefined,
			cacheEnabled: true,
		});
		await vi.waitFor(() => expect(activity.createOne).toHaveBeenCalledTimes(3));
	});

	test('error_on_reject throws $last for synchronous webhooks only', async () => {
		await loaded([
			flowRaw({ id: 'e', trigger: 'webhook', options: { error_on_reject: true } }, [
				{ id: 'o1', type: 'fail', options: { message: 'nope' } },
			]),
			flowRaw({ id: 'n', trigger: 'webhook' }, [{ id: 'o2', type: 'fail', options: { message: 'nope' } }]),
		]);

		await expect(getFlowManager().runWebhookFlow('GET-e', {}, context)).rejects.toMatchObject({ message: 'nope' });
		const { result } = await getFlowManager().runWebhookFlow('GET-n', {}, context);
		expect(result).toBeInstanceOf(Error);
		expect((result as Error).stack).toBeUndefined();
	});
});

describe('manual trigger', () => {
	const manual = (options: Record<string, any>) =>
		flowRaw({ id: 'm', trigger: 'manual', options: { collections: ['articles'], ...options } }, [
			{ id: 'o1', type: 'echo', options: { keys: '{{ $trigger.body.keys }}' } },
		]);

	const schema = { collections: { articles: { primary: 'id' } } } as any;
	const run = (body: any, acc: any = accountability) =>
		getFlowManager().runWebhookFlow('POST-m', { body }, { accountability: acc, schema });

	test.each([
		['no collection', {}, {}, 'Manual trigger requires "collection" to be specified in the payload'],
		[
			'no collections configured',
			{ collections: [] },
			{ collection: 'articles' },
			'There is no collections configured for this manual trigger',
		],
		[
			'collection not enabled',
			{},
			{ collection: 'other', keys: [1] },
			'Specified collection must be one of: articles.',
		],
		['keys missing', {}, { collection: 'articles' }, 'Manual trigger requires "keys" to be specified in the payload'],
		[
			'keys empty',
			{},
			{ collection: 'articles', keys: [] },
			'Manual trigger requires at least one key to be specified in the payload',
		],
	])('%s → 403 and a warning', async (_label, options, body, warning) => {
		await loaded([manual(options)]);

		await expect(run(body)).rejects.toBeInstanceOf(ForbiddenError);
		expect(logger.warn).toHaveBeenCalledWith(warning);
	});

	test('not authenticated → 403', async () => {
		await loaded([manual({})]);

		await expect(run({ collection: 'articles', keys: [1] }, null)).rejects.toBeInstanceOf(ForbiddenError);
		expect(logger.warn).toHaveBeenCalledWith('Manual flows are only triggerable when authenticated');
	});

	test('admin runs; return is forced to $last; requireSelection false needs no keys', async () => {
		await loaded([manual({ return: '$all', requireSelection: false })]);

		// A missing value inside a mustache renders as the string "undefined", as in DR (micromustache).
		await expect(run({ collection: 'articles' })).resolves.toEqual({ result: { keys: 'undefined' } });
	});

	test('non-admin needs read permission on the collection and every key, compared as strings', async () => {
		await loaded([manual({})]);
		const user = { ...accountability, admin: false };

		await expect(run({ collection: 'articles', keys: [1] }, user)).rejects.toBeInstanceOf(ForbiddenError);
		expect(logger.warn).toHaveBeenCalledWith('Triggering articles is not allowed');

		state.permissions = [{ action: 'read' }];
		readMany.mockResolvedValueOnce([{ id: 1 }]);
		await expect(run({ collection: 'articles', keys: [1, '2'] }, user)).rejects.toBeInstanceOf(ForbiddenError);
		expect(logger.warn).toHaveBeenCalledWith('Triggering keys 1,2 is not allowed');

		readMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
		await expect(run({ collection: 'articles', keys: ['1', 2] }, user)).resolves.toEqual({
			result: { keys: ['1', 2] },
		});
		expect(readMany).toHaveBeenLastCalledWith(['1', 2], { fields: ['id'] }, { emitEvents: false });
	});
});

describe('run log', () => {
	const context = { accountability, schema: {} as any };

	test('accountability all: one run activity and a revision with the steps and the redacted data', async () => {
		await loaded(
			[
				flowRaw({ trigger: 'webhook', options: { method: 'POST' } }, [
					{ id: 'o1', key: 'first', type: 'echo', options: { secret: '{{ $trigger.body.token }}' }, resolve: 'o2' },
					{ id: 'o2', key: 'second', type: 'fail', options: { message: 'bad' } },
				]),
			],
			{ FLOWS_ENV_ALLOW_LIST: ['API_KEY'], API_KEY: 'k-123' },
		);

		await getFlowManager().runWebhookFlow(
			'POST-f1',
			{ headers: { authorization: 'Bearer t' }, body: { token: 'k-123', payload: { password: 'p' } } },
			context,
		);

		expect(activity.createOne).toHaveBeenCalledWith({
			action: 'run',
			user: 'u1',
			collection: 'directus_flows',
			ip: '10.0.0.1',
			user_agent: 'ua',
			origin: 'o',
			item: 'f1',
		});

		const revision = revisions.createOne.mock.calls[0]![0] as any;
		expect(revision).toMatchObject({ activity: 7, collection: 'directus_flows', item: 'f1' });

		expect(revision.data.steps).toEqual([
			{ operation: 'o1', key: 'first', status: 'resolve', options: { secret: '--redacted:API_KEY--' } },
			{ operation: 'o2', key: 'second', status: 'reject', options: { message: 'bad' } },
		]);

		expect(revision.data.data.$trigger.headers.authorization).toBe('--redacted--');
		expect(revision.data.data.$trigger.body.token).toBe('--redacted:API_KEY--');
		expect(revision.data.data.second).toMatchObject({ name: 'Error', message: 'bad' });
	});

	test.each([
		['activity', 1, 0],
		[null, 0, 0],
	])('accountability %s → %s activity, %s revision', async (flowAccountability, activities, revisionRows) => {
		await loaded([flowRaw({ trigger: 'webhook', accountability: flowAccountability as any })]);

		await getFlowManager().runWebhookFlow('GET-f1', {}, context);

		expect(activity.createOne).toHaveBeenCalledTimes(activities);
		expect(revisions.createOne).toHaveBeenCalledTimes(revisionRows);
	});
});

describe('executeOperation', () => {
	const run = async (operations: Partial<OperationRaw>[], options: Record<string, any> = { return: '$all' }) => {
		await loaded([flowRaw({ trigger: 'webhook', options }, operations)]);
		return (
			await getFlowManager().runWebhookFlow(
				'GET-f1',
				{ payload: { password: 'p' } },
				{ accountability: undefined, schema: {} as any },
			)
		).result as any;
	};

	test('an unknown type warns and ends the chain with status unknown', async () => {
		const all = await run([
			{ id: 'o1', type: 'from-an-extension', resolve: 'o2' },
			{ id: 'o2', type: 'echo' },
		]);

		expect(logger.warn).toHaveBeenCalledWith(`Couldn't find operation from-an-extension`);
		expect(all.op0).toBeNull();
		expect(all).not.toHaveProperty('op1');
		expect(revisions.createOne.mock.calls[0]![0].data.steps).toEqual([
			{ operation: 'o1', key: 'op0', status: 'unknown', options: null },
		]);
	});

	test('nested undefined becomes null; an unserializable result takes the reject branch', async () => {
		const all = await run([
			{ id: 'o1', type: 'nested-undefined', resolve: 'o2' },
			{ id: 'o2', type: 'bigint', reject: 'o3' },
			{ id: 'o3', type: 'echo', options: { after: 'reject' } },
		]);

		expect(all.op0).toEqual({ a: null, b: [null] });
		expect(all.op1).toBeInstanceOf(TypeError);
		expect(all.op2).toEqual({ after: 'reject' });
	});

	test('a rejected JSON string is parsed, a plain string is kept', async () => {
		const all = await run([
			{ id: 'o1', type: 'fail-json', reject: 'o2' },
			{ id: 'o2', type: 'fail-text' },
		]);

		expect(all.op0).toEqual({ status: 404 });
		expect(all.op1).toBe('plain text');
	});

	test('the log operation renders its options from redacted data', async () => {
		await run([{ id: 'o1', type: 'log', options: { message: '{{ $trigger.payload.password }}' } }]);

		expect(state.env['__logged']).toBe('--redacted--');
	});
});

describe('reload and operation flows', () => {
	test('reload publishes on the flows channel; the subscriber unloads and loads again', async () => {
		const manager = await loaded([
			flowRaw({ id: 'e', trigger: 'event', options: { type: 'action', scope: 'auth.login' } }),
			flowRaw({ id: 's', trigger: 'schedule', options: { cron: '* * * * *' } }),
		]);

		state.flows = [];
		await manager.reload();
		await (manager as any).reloadQueue.onIdle();

		expect(bus.publish).toHaveBeenCalledWith('flows', { type: 'reload' });
		expect(emitter.offAction).toHaveBeenCalledWith('auth.login', expect.any(Function));
		expect(jobs[0]!.stop).toHaveBeenCalled();
		expect(manager.getFlow('e')).toBeUndefined();
	});

	test('a reload message before the first load only warns', async () => {
		state.env = {};
		const manager = getFlowManager();

		state.busHandler!({ type: 'reload' });
		await (manager as any).reloadQueue.onIdle();

		expect(logger.warn).toHaveBeenCalledWith('Flows have to be loaded before they can be reloaded');
	});

	test('runOperationFlow: unknown id → null and a warning; an operation flow returns its `return`', async () => {
		await loaded([
			flowRaw({ id: 'op', trigger: 'operation', options: { return: '$last' } }, [
				{ id: 'o1', type: 'echo', options: { v: '{{ $trigger }}' } },
			]),
		]);

		await expect(getFlowManager().runOperationFlow('missing', {}, {})).resolves.toBeNull();
		expect(logger.warn).toHaveBeenCalledWith(`Couldn't find operation triggered flow with id "missing"`);
		await expect(getFlowManager().runOperationFlow('op', 3, {})).resolves.toEqual({ v: 3 });
	});

	test('unload is public (app.ts stops the cron jobs on SIGTERM)', async () => {
		const manager = await loaded([flowRaw({ trigger: 'schedule', options: { cron: '* * * * *' } })]);

		await manager.unload();

		expect(jobs[0]!.stop).toHaveBeenCalled();
	});
});
