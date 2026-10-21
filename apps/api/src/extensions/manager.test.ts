// Backoffice (spec 020, T021): Directus has no test for extensions/manager.ts. Covers the lifecycle: settings looked up
// by (source, folder), reload dedupe, the rejected reload (R-64), EXTENSIONS_MUST_LOAD, the bus subscription and the
// chokidar watcher debounce.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Extension } from '@backoffice/types';
import chokidar from 'chokidar';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import emitter from '../emitter.js';
import { getExtensionsSettings } from './lib/get-extensions-settings.js';
import { getExtensions } from './lib/get-extensions.js';
import { syncExtensions } from './lib/sync/sync.js';
import { ExtensionManager } from './manager.js';

const { env, bus, flowManager, logger, jobs } = vi.hoisted(() => ({
	env: {} as Record<string, unknown>,
	bus: { publish: vi.fn(), subscribe: vi.fn() },
	flowManager: { addOperation: vi.fn(), removeOperation: vi.fn() },
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
	jobs: [] as { name: string; cron: string; stop: () => void }[],
}));

vi.mock('@backoffice/env', () => ({ useEnv: () => env }));
vi.mock('../logger/index.js', () => ({ useLogger: () => logger }));
vi.mock('../utils/schedule.js', () => ({
	validateCron: (cron: string) => cron !== 'bad',
	scheduleSynchronizedJob: vi.fn((name: string, cron: string) => {
		const job = { name, cron, stop: vi.fn() };
		jobs.push(job);
		return job;
	}),
}));

vi.mock('../bus/index.js', () => ({ useBus: () => bus }));
vi.mock('../database/index.js', () => ({ default: vi.fn(() => 'knex') }));
vi.mock('../schema/get-database-schema.js', () => ({ getSchema: vi.fn(async () => ({})) }));
vi.mock('../flows.js', () => ({ getFlowManager: () => flowManager }));
vi.mock('../operations/index.js', () => ({ operations: [] }));
vi.mock('../services/index.js', () => ({ ItemsService: class {} }));
vi.mock('./services.js', () => ({ extraServices: async () => ({}) }));
vi.mock('./lib/get-extensions.js', () => ({ getExtensions: vi.fn() }));
vi.mock('./lib/get-extensions-settings.js', () => ({ getExtensionsSettings: vi.fn() }));
vi.mock('./lib/installation/index.js', () => ({ getInstallationManager: () => ({}) }));
vi.mock('./lib/sync/sync.js', () => ({ syncExtensions: vi.fn(), clearOwnSyncLock: vi.fn() }));

vi.mock('rollup', () => ({ rollup: vi.fn(async () => ({ write: async () => ({ output: [] }), close: vi.fn() })) }));
vi.mock('rolldown', () => ({ rolldown: vi.fn() }));

const watcherHandlers = vi.hoisted(() => ({}) as Record<string, () => void>);

vi.mock('chokidar', () => {
	const watcher = {
		on: vi.fn((event: string, handler: () => void) => {
			watcherHandlers[event] = handler;
			return watcher;
		}),
		add: vi.fn(),
		unwatch: vi.fn(),
		close: vi.fn(),
	};

	return { default: { watch: vi.fn(() => watcher) }, FSWatcher: class {} };
});

let dir: string;

const hook = (folder: string): Extension =>
	({ type: 'hook', name: folder, path: dir, entrypoint: 'hook.mjs', local: true, version: '1.0.0' }) as Extension;

const fired = vi.fn();

beforeAll(async () => {
	Object.assign(env, { TEMP_PATH: tmpdir(), EXTENSIONS_PATH: './extensions' });
	dir = await mkdtemp(join(tmpdir(), 'bo-ext-manager-'));
	(globalThis as any).__boManagerHook = fired;

	await writeFile(
		join(dir, 'register-hook.mjs'),
		`export default ({ filter, action, init, schedule, embed }, context) => {
			globalThis.__boManagerContext = context;
			filter('bo.manager.filter', (payload) => ({ ...payload, ext: true }));
			init('bo.manager.init', () => globalThis.__boManagerHook('init'));
			schedule('* * * * *', () => globalThis.__boManagerHook('tick'));
			schedule('*/5 * * * *', () => {});
			schedule('bad', () => {});
			embed('head', '<meta name="bo">');
			embed('body', () => '<script></script>');
			embed('body', '   ');
		};`,
	);

	await writeFile(
		join(dir, 'endpoint.mjs'),
		`export default (router, context) => {
			router.get('/', (req, res) => res.json({ query: req.query, services: typeof context.services }));
		};`,
	);

	await writeFile(join(dir, 'operation.mjs'), `export default { id: 'bo-manager-op', handler: () => 'op' };`);

	await writeFile(
		join(dir, 'bundle.mjs'),
		`export default {
			hooks: [{ name: 'bundle-hook', config: ({ action }) => action('bo.manager.bundle', () => globalThis.__boManagerHook('bundle')) }],
			endpoints: [{ name: 'bundle-endpoint', config: { id: 'bundle-endpoint', handler: (router) => router.get('/', (_req, res) => res.send('b')) } }],
			operations: [{ name: 'bundle-op', config: { id: 'bundle-op', handler: () => 'b' } }],
		};`,
	);

	await writeFile(
		join(dir, 'hook.mjs'),
		'export default ({ action }) => { action("bo.manager.test", (meta) => globalThis.__boManagerHook(meta)); };',
	);
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

beforeEach(() => {
	vi.clearAllMocks();
	jobs.length = 0;
	delete env['EXTENSIONS_MUST_LOAD'];
	delete env['EXTENSIONS_LOCATION'];

	vi.mocked(getExtensions).mockResolvedValue({
		local: new Map([['enabled-hook', hook('enabled-hook')]]),
		registry: new Map([['other-source', hook('other-source')]]),
		module: new Map(),
	});

	vi.mocked(getExtensionsSettings).mockResolvedValue([
		{ id: '1', source: 'local', folder: 'enabled-hook', enabled: true, bundle: null },
		// same folder name under another source: must not enable the registry extension
		{ id: '2', source: 'local', folder: 'other-source', enabled: true, bundle: null },
		{ id: '3', source: 'registry', folder: 'other-source', enabled: false, bundle: null },
	]);
});

describe('load', () => {
	test('registers the enabled extensions only, matched by source and folder', async () => {
		const manager = new ExtensionManager();

		await manager.initialize({ watch: false });

		emitter.emitAction('bo.manager.test', { n: 1 });

		await vi.waitFor(() => expect(fired).toHaveBeenCalledTimes(1));
		expect(manager.extensions.map((e) => e.name)).toEqual(['enabled-hook', 'other-source']);

		await manager.unload();

		emitter.emitAction('bo.manager.test', { n: 2 });
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(fired).toHaveBeenCalledTimes(1);
	});

	test('syncs first when EXTENSIONS_LOCATION is set and subscribes to the bus once', async () => {
		env['EXTENSIONS_LOCATION'] = 's3';
		const manager = new ExtensionManager();

		await manager.initialize({ watch: false });
		await manager.initialize({ watch: false });

		expect(syncExtensions).toHaveBeenCalledWith({ forceSync: true });
		expect(bus.subscribe).toHaveBeenCalledTimes(1);
		expect(bus.subscribe).toHaveBeenCalledWith('extensions.reload', expect.any(Function));

		await manager.unload();
	});

	test('clears its own sync lock first; a failed sync exits the process (T060)', async () => {
		env['EXTENSIONS_LOCATION'] = 's3';
		const { clearOwnSyncLock } = await import('./lib/sync/sync.js');
		vi.mocked(syncExtensions).mockRejectedValueOnce(new Error('s3 down'));

		const exit = vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
			throw new Error(`exit ${code}`);
		}) as never);

		await expect(new ExtensionManager().initialize({ watch: false })).rejects.toThrow('exit 1');
		expect(clearOwnSyncLock).toHaveBeenCalledBefore(vi.mocked(syncExtensions));
		expect(logger.error).toHaveBeenCalledWith('Failed to sync extensions');

		exit.mockRestore();
	});

	test('EXTENSIONS_MUST_LOAD exits on a load error, otherwise the error is a warning', async () => {
		vi.mocked(getExtensionsSettings).mockRejectedValue(new Error('db down'));

		await expect(new ExtensionManager().initialize({ watch: false })).resolves.toBeUndefined();

		env['EXTENSIONS_MUST_LOAD'] = 'true';

		const exit = vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
			throw new Error(`exit ${code}`);
		}) as never);

		await expect(new ExtensionManager().initialize({ watch: false })).rejects.toThrow('exit 1');

		exit.mockRestore();
	});
});

describe('reload', () => {
	test('a reload queued behind a waiting one is dropped', async () => {
		const manager = new ExtensionManager();
		await manager.initialize({ watch: false });
		vi.mocked(getExtensions).mockClear();

		await Promise.all([manager.reload(), manager.reload(), manager.reload()]);

		expect(getExtensions).toHaveBeenCalledTimes(2);

		await manager.unload();
	});

	test('a reload that throws rejects and readers do not hang (R-64)', async () => {
		const manager = new ExtensionManager();
		await manager.initialize({ watch: false });

		env['EXTENSIONS_MUST_LOAD'] = 'true';
		vi.mocked(getExtensionsSettings).mockRejectedValue(new Error('db down'));

		const exit = vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
			throw new Error(`exit ${code}`);
		}) as never);

		await expect(manager.reload()).rejects.toThrow('exit 1');
		await expect(manager.isReloading()).rejects.toThrow('exit 1');

		exit.mockRestore();
	});

	test('a reload message from another process reloads, our own is ignored', async () => {
		const manager = new ExtensionManager();
		await manager.initialize({ watch: false });

		const [, onMessage] = bus.subscribe.mock.calls[0]!;
		const reload = vi.spyOn(manager, 'reload');

		onMessage({ origin: (manager as any).processId });
		expect(reload).not.toHaveBeenCalled();

		onMessage({ origin: 'other', partialSync: '.registry/x', forceSync: false });
		expect(reload).toHaveBeenCalledWith({ partialSync: '.registry/x', forceSync: false });

		await manager.isReloading();
		await manager.unload();
	});
});

describe('watcher', () => {
	test('add, change and unlink reload after 500, 650 and 2000 ms', async () => {
		const manager = new ExtensionManager();
		await manager.initialize({ watch: true });
		const reload = vi.spyOn(manager, 'reload').mockResolvedValue(undefined);

		vi.useFakeTimers();

		for (const [event, wait] of [
			['add', 500],
			['change', 650],
			['unlink', 2000],
		] as const) {
			reload.mockClear();
			watcherHandlers[event]!();
			vi.advanceTimersByTime(wait - 1);
			expect(reload).not.toHaveBeenCalled();
			vi.advanceTimersByTime(1);
			expect(reload).toHaveBeenCalledTimes(1);
		}

		vi.useRealTimers();
		await manager.unload();
	});

	test('no watcher when watch is off', async () => {
		await new ExtensionManager().initialize({ watch: false });

		expect(chokidar.watch).not.toHaveBeenCalled();
	});
});

describe('registration (T030-T032)', () => {
	const only = async (
		extensions: Extension[],
		settings: { folder: string; bundle?: string | null; enabled?: boolean; id?: string }[],
	) => {
		vi.mocked(getExtensions).mockResolvedValue({
			local: new Map(extensions.map((ext) => [ext.name, ext])),
			registry: new Map(),
			module: new Map(),
		});

		vi.mocked(getExtensionsSettings).mockResolvedValue(
			settings.map((row, i) => ({
				id: row.id ?? String(i),
				source: 'local',
				folder: row.folder,
				enabled: row.enabled ?? true,
				bundle: row.bundle ?? null,
			})),
		);

		const manager = new ExtensionManager();
		await manager.initialize({ watch: false });
		return manager;
	};

	test('a hook gets the five register functions and the context of Directus', async () => {
		const ext = { ...hook('ctx-hook'), entrypoint: 'register-hook.mjs' } as Extension;
		const manager = await only([ext], [{ folder: 'ctx-hook' }]);

		const context = (globalThis as any).__boManagerContext;
		expect(Object.keys(context).sort()).toEqual(['database', 'emitter', 'env', 'getSchema', 'logger', 'services']);
		expect(context.database).toBe('knex');
		expect(context.emitter).not.toBe(emitter);
		expect(context.services).toHaveProperty('ItemsService');

		await expect(emitter.emitFilter('bo.manager.filter', { a: 1 }, {})).resolves.toEqual({ a: 1, ext: true });

		await emitter.emitInit('bo.manager.init', {});
		expect(fired).toHaveBeenCalledWith('init');

		// schedule: one synchronized job per valid cron, named <extension>:<index> like Directus
		expect(jobs.map((job) => [job.name, job.cron])).toEqual([
			['ctx-hook:0', '* * * * *'],
			['ctx-hook:1', '*/5 * * * *'],
		]);

		expect(logger.warn).toHaveBeenCalledWith("Couldn't register cron hook. Provided cron is invalid: bad");
		expect(logger.warn).toHaveBeenCalledWith("Couldn't register embed hook. Provided code is empty!");

		expect(manager.getEmbeds().head).toContain('<meta name="bo">');
		expect(manager.getEmbeds().body).toContain('<script></script>');

		await manager.unload();

		// R-61: the init listener is removed by event
		fired.mockClear();
		await emitter.emitInit('bo.manager.init', {});
		expect(fired).not.toHaveBeenCalled();
		await expect(emitter.emitFilter('bo.manager.filter', { a: 1 }, {})).resolves.toEqual({ a: 1 });
		for (const job of jobs) expect(job.stop).toHaveBeenCalled();
		expect(manager.getEmbeds().head).not.toContain('<meta name="bo">');
	});

	test('an endpoint is mounted under the folder name, gets the context, and is removed on unload', async () => {
		const ext = { ...hook('bo-endpoint'), type: 'endpoint', entrypoint: 'endpoint.mjs' } as Extension;
		const manager = await only([ext], [{ folder: 'bo-endpoint' }]);
		const app = express().use(manager.getEndpointRouter());

		await request(app).get('/bo-endpoint').expect(200, { query: {}, services: 'object' });

		await manager.unload();

		await request(app).get('/bo-endpoint').expect(404);
	});

	test('an operation is added to the flow manager and removed on unload', async () => {
		const ext = {
			...hook('bo-operation'),
			type: 'operation',
			entrypoint: { app: 'none.js', api: 'operation.mjs' },
		} as unknown as Extension;

		const manager = await only([ext], [{ folder: 'bo-operation' }]);

		expect(flowManager.addOperation).toHaveBeenCalledWith('bo-manager-op', expect.any(Function));

		await manager.unload();

		expect(flowManager.removeOperation).toHaveBeenCalledWith('bo-manager-op');
	});

	test('a bundle registers its enabled entries only, looked up by (source, entry name, bundle id)', async () => {
		const ext = {
			...hook('bo-bundle'),
			type: 'bundle',
			entrypoint: { app: 'none.js', api: 'bundle.mjs' },
			entries: [],
		} as unknown as Extension;

		const manager = await only(
			[ext],
			[
				{ id: 'b1', folder: 'bo-bundle' },
				{ folder: 'bundle-hook', bundle: 'b1' },
				{ folder: 'bundle-endpoint', bundle: 'b1', enabled: false },
				// same entry name under another bundle id: ignored
				{ folder: 'bundle-op', bundle: 'other' },
			],
		);

		emitter.emitAction('bo.manager.bundle', {});
		await vi.waitFor(() => expect(fired).toHaveBeenCalledWith('bundle'));

		await request(express().use(manager.getEndpointRouter())).get('/bundle-endpoint').expect(404);
		expect(flowManager.addOperation).not.toHaveBeenCalledWith('bundle-op', expect.anything());

		await manager.unload();
	});
});

describe('filter order (T039, R-62)', () => {
	test('extension filters run before the flow filters at startup, after them once reloaded', async () => {
		const ext = { ...hook('order-hook'), entrypoint: 'register-hook.mjs' } as Extension;

		vi.mocked(getExtensions).mockResolvedValue({
			local: new Map([['order-hook', ext]]),
			registry: new Map(),
			module: new Map(),
		});
		vi.mocked(getExtensionsSettings).mockResolvedValue([
			{ id: '1', source: 'local', folder: 'order-hook', enabled: true, bundle: null },
		]);

		const manager = new ExtensionManager();
		await manager.initialize({ watch: false });

		// The flow manager registers its event flows after the extensions (app.ts); a flow filter sees the extension's output.
		const flow = vi.fn((payload: Record<string, unknown>) => ({ ...payload, flowSawExt: payload['ext'] === true }));
		emitter.onFilter('bo.manager.filter', flow);

		await expect(emitter.emitFilter('bo.manager.filter', {}, {})).resolves.toEqual({ ext: true, flowSawExt: true });

		// Backoffice: same as Directus (R-62): a reload registers the extension again, after the flow filter.
		await manager.reload();
		await expect(emitter.emitFilter('bo.manager.filter', {}, {})).resolves.toEqual({ ext: true, flowSawExt: false });

		emitter.offFilter('bo.manager.filter', flow);
		await manager.unload();
	});
});
