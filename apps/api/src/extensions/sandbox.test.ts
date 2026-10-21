// Backoffice (spec 020, T080): Directus has no test for its API extension sandbox. Sandboxed extensions run through the
// manager in a real isolated-vm isolate: the log, sleep and request scopes with the error messages of
// lib/sandbox/sdk/generators, imports other than directus:api refused, process.env with NODE_ENV only, the timeout,
// and the isolate disposed on unload. The out-of-memory abort (process.abort) is covered by the parity sandbox file.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Extension } from '@backoffice/types';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { getExtensionsSettings } from './lib/get-extensions-settings.js';
import { getExtensions } from './lib/get-extensions.js';
import { ExtensionManager } from './manager.js';

const { env, logger } = vi.hoisted(() => ({
	env: {} as Record<string, unknown>,
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@backoffice/env', () => ({ useEnv: () => env }));
vi.mock('../logger/index.js', () => ({ useLogger: () => logger }));
vi.mock('../bus/index.js', () => ({ useBus: () => ({ publish: vi.fn(), subscribe: vi.fn() }) }));
vi.mock('../database/index.js', () => ({ default: vi.fn(() => ({})) }));
vi.mock('../schema/get-database-schema.js', () => ({ getSchema: vi.fn(async () => ({})) }));
vi.mock('../flows.js', () => ({ getFlowManager: () => ({ addOperation: vi.fn(), removeOperation: vi.fn() }) }));
vi.mock('../operations/index.js', () => ({ operations: [] }));
vi.mock('../services/index.js', () => ({}));
vi.mock('./services.js', () => ({ extraServices: async () => ({}) }));
vi.mock('./lib/get-extensions.js', () => ({ getExtensions: vi.fn() }));
vi.mock('./lib/get-extensions-settings.js', () => ({ getExtensionsSettings: vi.fn() }));
vi.mock('./lib/installation/index.js', () => ({ getInstallationManager: () => ({}) }));
vi.mock('./lib/sync/sync.js', () => ({ syncExtensions: vi.fn(), clearOwnSyncLock: vi.fn() }));
vi.mock('rollup', () => ({ rollup: vi.fn(async () => ({ write: async () => ({ output: [] }), close: vi.fn() })) }));
vi.mock('rolldown', () => ({ rolldown: vi.fn() }));

let dir: string;
let upstream: Server;
let origin: string;

const ENDPOINT = `import { log, request, sleep } from 'directus:api';
export default (router) => {
	router.get('/', async () => { log('sandbox: hello'); await sleep(1); return { status: 200, body: { ok: true } }; });
	router.get('/env', () => ({ status: 200, body: { env: Object.keys(process.env) } }));
	router.get('/fetch', async () => {
		const response = await request(ORIGIN + '/hello');
		return { status: 200, body: { status: response.status, data: response.data } };
	});
	const failing = (fn) => async () => {
		try { await fn(); return { status: 200, body: { error: null } }; }
		catch (error) { return { status: 200, body: { error: String(error.message) } }; }
	};
	router.get('/outside', failing(() => request('http://example.invalid/')));
	router.get('/post', failing(() => request(ORIGIN + '/hello', { method: 'POST' })));
	router.get('/slow', () => { const end = Date.now() + 2000; while (Date.now() < end) {} return { status: 200, body: {} }; });
};`;

const sandboxed = (name: string, scopes: Record<string, unknown>): Extension =>
	({
		type: 'endpoint',
		name,
		path: dir,
		entrypoint: `${name}.mjs`,
		local: true,
		version: '1.0.0',
		sandbox: { enabled: true, requestedScopes: scopes },
	}) as unknown as Extension;

async function load(...extensions: Extension[]) {
	vi.mocked(getExtensions).mockResolvedValue({
		local: new Map(extensions.map((ext) => [ext.name, ext])),
		registry: new Map(),
		module: new Map(),
	});

	vi.mocked(getExtensionsSettings).mockResolvedValue(
		extensions.map((ext, i) => ({ id: String(i), source: 'local', folder: ext.name, enabled: true, bundle: null })),
	);

	const manager = new ExtensionManager();
	await manager.initialize({ watch: false });
	return { manager, http: request(express().use(manager.getEndpointRouter())) };
}

beforeAll(async () => {
	upstream = createServer((_req, res) => res.end('hello from upstream')).listen(0, '127.0.0.1');
	await new Promise((resolve) => upstream.once('listening', resolve));
	origin = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;

	dir = await mkdtemp(join(tmpdir(), 'bo-ext-sandbox-'));
	await writeFile(join(dir, 'box.mjs'), ENDPOINT.replaceAll('ORIGIN', JSON.stringify(origin)));
	await writeFile(join(dir, 'noscope.mjs'), ENDPOINT.replaceAll('ORIGIN', JSON.stringify(origin)));
	await writeFile(join(dir, 'pending.mjs'), 'for (;;) {}\nexport default () => {};');
	await writeFile(
		join(dir, 'imports.mjs'),
		`import fs from 'node:fs';\nexport default (router) => router.get('/', () => ({ status: 200, body: fs }));`,
	);
});

afterAll(async () => {
	upstream.close();
	await rm(dir, { recursive: true, force: true });
});

beforeEach(() => {
	vi.clearAllMocks();
	Object.assign(env, {
		TEMP_PATH: tmpdir(),
		EXTENSIONS_SANDBOX_MEMORY: 100,
		EXTENSIONS_SANDBOX_TIMEOUT: 1000,
		IMPORT_IP_DENY_LIST: [],
	});
});

test('routes run in the isolate with the log, sleep and request scopes; process.env has NODE_ENV only', async () => {
	const { manager, http } = await load(
		sandboxed('box', { log: {}, sleep: {}, request: { urls: [`${origin}/*`], methods: ['GET'] } }),
	);

	await http.get('/box').expect(200, { ok: true });
	expect(logger.info).toHaveBeenCalledWith('sandbox: hello');

	await http.get('/box/env').expect(200, { env: ['NODE_ENV'] });
	await http.get('/box/fetch').expect(200, { status: 200, data: 'hello from upstream' });

	await http.get('/box/outside').expect(200, { error: 'No permission to request "http://example.invalid/"' });
	await http.get('/box/post').expect(200, { error: 'No permission to use request method "POST"' });

	await manager.unload();
	await http.get('/box').expect(404);
});

test('a scope that was not requested is refused with the message of Directus', async () => {
	const { manager, http } = await load(sandboxed('noscope', {}));

	await http.get('/noscope/outside').expect(200, { error: 'No permission to access "request"' });
	await http.get('/noscope').expect(500);
	expect(logger.info).not.toHaveBeenCalledWith('sandbox: hello');

	await manager.unload();
});

// A handler busy past EXTENSIONS_SANDBOX_TIMEOUT is not tested here: isolated-vm 5.0.3 on Node 22 reports "Script failed
// to terminate" and the manager aborts the process, like Directus (same code and library; spec 020 notes, T081).
test('a module that runs past EXTENSIONS_SANDBOX_TIMEOUT while it loads is not registered', async () => {
	env['EXTENSIONS_SANDBOX_TIMEOUT'] = 100;
	const { manager, http } = await load(sandboxed('pending', {}));

	expect(logger.warn).toHaveBeenCalledWith('Couldn\'t register endpoint "pending"');
	await http.get('/pending').expect(404);

	await manager.unload();
});

test('a URL in scope whose IP is in IMPORT_IP_DENY_LIST is refused', async () => {
	env['IMPORT_IP_DENY_LIST'] = ['127.0.0.1'];
	const { _cache } = await import('../request/index.js');
	_cache.axiosInstance = null;

	const { manager, http } = await load(sandboxed('box', { request: { urls: [`${origin}/*`], methods: ['GET'] } }));

	const res = await http.get('/box/fetch');
	expect(res.status).toBe(500);

	await manager.unload();
	env['IMPORT_IP_DENY_LIST'] = [];
	_cache.axiosInstance = null;
});

test('imports other than directus:api are refused when the extension loads', async () => {
	const { manager, http } = await load(sandboxed('imports', {}));

	expect(logger.warn).toHaveBeenCalledWith('Couldn\'t register endpoint "imports"');
	expect(logger.warn).toHaveBeenCalledWith(
		expect.objectContaining({ message: 'Imports other than "directus:api" are prohibited in API extension sandboxes' }),
	);
	await http.get('/imports').expect(404);

	await manager.unload();
});
