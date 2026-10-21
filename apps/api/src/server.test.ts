import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { useEnv } from '@backoffice/env';
import { createTerminus, type TerminusOptions } from '@godaddy/terminus';
import getPort from 'get-port';
import { afterEach, beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import { createApp } from './app.js';
import getDatabase from './database/index.js';
import { useLogger } from './logger/index.js';

vi.mock('@backoffice/env');
vi.mock('@godaddy/terminus');
vi.mock('./app.js', () => ({ createApp: vi.fn() }));
vi.mock('./database/index.js');
vi.mock('./logger/index.js');

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
const destroy = vi.fn();
let servers: http.Server[] = [];

async function load(env: Record<string, unknown> = {}) {
	vi.mocked(useEnv).mockReturnValue({ HOST: '127.0.0.1', PORT: '0', ...env });
	return import('./server.js');
}

const terminusOptions = () => vi.mocked(createTerminus).mock.calls[0]![1] as Required<TerminusOptions>;

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(getDatabase).mockReturnValue({ destroy } as any);
	vi.mocked(createApp).mockResolvedValue({ express: (_req: any, res: any) => res.end('ok') } as any);
});

afterEach(async () => {
	await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
	servers = [];
	vi.unstubAllEnvs();
});

describe('createServer', () => {
	test('applies SERVER_* settings to the http.Server', async () => {
		const { createServer } = await load({ SERVER_KEEP_ALIVE_TIMEOUT: 1234, SERVER_HEADERS_TIMEOUT: 5678 });
		const server = await createServer();
		expect(server.keepAliveTimeout).toBe(1234);
		expect(server.headersTimeout).toBe(5678);
	});

	test.each([
		[undefined, 1000],
		[2500, 2500],
		[-1, 1000],
		[Infinity, 1000],
	])(
		'terminus timeout for SERVER_SHUTDOWN_TIMEOUT=%s is %s, on SIGINT/SIGTERM/SIGHUP, without logger',
		async (value, expected) => {
			const { createServer } = await load(value === undefined ? {} : { SERVER_SHUTDOWN_TIMEOUT: value });
			await createServer();
			expect(terminusOptions().timeout).toBe(expected);
			expect(terminusOptions().signals).toEqual(['SIGINT', 'SIGTERM', 'SIGHUP']);
			expect(terminusOptions()).not.toHaveProperty('logger');
		},
	);

	test('shutdown sequence (FR-080): offline, destroy knex, extra tasks, close Redis, bye', async () => {
		vi.stubEnv('NODE_ENV', 'production');
		const mod = await load();
		await mod.createServer();
		const order: string[] = [];
		destroy.mockImplementation(async () => order.push('knex.destroy'));
		const { onServerShutdown } = await import('./shutdown.js');
		onServerShutdown(() => order.push('metrics.stop'));
		// Same module instance as server.ts (modules are reset per test).
		const { _cache } = await import('./redis/lib/use-redis.js');
		_cache.redis = { disconnect: vi.fn(() => order.push('redis.disconnect')) } as any;

		expect(mod.SERVER_ONLINE).toBe(true);
		await terminusOptions().beforeShutdown();
		expect(mod.SERVER_ONLINE).toBe(false);
		expect(logger.info).toHaveBeenCalledWith('Shutting down...');

		await terminusOptions().onSignal();
		expect(order).toEqual(['knex.destroy', 'redis.disconnect', 'metrics.stop']);
		expect(logger.info).toHaveBeenCalledWith('Database connections destroyed');

		await terminusOptions().onShutdown();
		expect(logger.info).toHaveBeenLastCalledWith('Backoffice shut down OK. Bye bye!');
	});

	test('no shutdown messages in development; no Redis client to close', async () => {
		vi.stubEnv('NODE_ENV', 'development');
		const mod = await load();
		await mod.createServer();
		await terminusOptions().beforeShutdown();
		await terminusOptions().onSignal();
		await terminusOptions().onShutdown();
		expect(logger.info).toHaveBeenCalledExactlyOnceWith('Database connections destroyed');
	});
});

describe('startServer', () => {
	// startServer calls process.send?.('ready') like Directus (PM2); keep it off Vitest's IPC channel.
	const send = process.send;

	beforeEach(() => {
		(process as { send?: unknown }).send = undefined;
	});

	afterEach(() => {
		(process as { send?: unknown }).send = send;
	});

	test('listens on HOST/PORT and logs the address', async () => {
		const port = await getPort();
		const { startServer } = await load({ PORT: String(port) });
		servers.push(await startServer());
		await vi.waitFor(() => expect(logger.info).toHaveBeenCalledWith(`Server started at http://127.0.0.1:${port}`));
	});

	// Spec 020 (FR-048, T065): createApp loads the extensions (sync included) before the port opens, so a pod is only
	// ready, and only receives traffic, once its extensions are loaded.
	test('the port opens only after createApp (extension loading) resolved', async () => {
		const port = await getPort();
		let resolveApp!: (value: unknown) => void;
		vi.mocked(createApp).mockReturnValue(new Promise((resolve) => (resolveApp = resolve)) as any);

		const { startServer } = await load({ PORT: String(port) });
		const started = startServer();

		await new Promise((resolve) => setTimeout(resolve, 50));
		await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow();

		resolveApp({ express: (_req: any, res: any) => res.end('ok') });
		servers.push(await started);
		await vi.waitFor(async () => expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toBe('ok'));
	});

	test('listens on UNIX_SOCKET_PATH', async () => {
		const path = `/tmp/bo-${process.pid}-${Date.now()}.sock`;
		const { startServer } = await load({ UNIX_SOCKET_PATH: path });
		const server = await startServer();
		servers.push(server);
		await vi.waitFor(() => expect(logger.info).toHaveBeenCalledWith(`Server started at ${path}`));
	});

	test('EADDRINUSE → "Port <port> is already in use" and exit 1', async () => {
		const blocker = http.createServer();
		servers.push(blocker);
		await new Promise<void>((r) => blocker.listen(0, '127.0.0.1', r));
		const { port } = blocker.address() as AddressInfo;

		const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
		const { startServer } = await load({ PORT: String(port) });
		await startServer();

		await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith(`Port ${port} is already in use`));
		expect(exit).toHaveBeenCalledWith(1);
		exit.mockRestore();
	});
});

// Feature 009: the `response`, `server.start` and `server.stop` actions of Directus' server.ts (event flows).
describe('server events', () => {
	test('response: one action per finished request with the request and response info', async () => {
		const { default: emitter } = await import('./emitter.js');
		const emitAction = vi.spyOn(emitter, 'emitAction');
		const { createServer } = await load();
		const server = await createServer();
		servers.push(server);
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const { port } = server.address() as AddressInfo;

		await fetch(`http://127.0.0.1:${port}/items/x?limit=1`, { headers: { 'user-agent': 'parity' } });
		await vi.waitFor(() => expect(emitAction).toHaveBeenCalledWith('response', expect.anything(), expect.anything()));

		const [, info] = emitAction.mock.calls.find(([event]) => event === 'response')!;
		expect(info).toMatchObject({
			finished: true,
			request: { method: 'GET', path: '/items/x', query: { limit: '1' }, protocol: 'http' },
			response: { status: 200 },
		});
	});

	test('server.start after listen, server.stop on shutdown', async () => {
		// startServer calls process.send?.('ready'); keep it off Vitest's IPC channel (see startServer above).
		const send = process.send;
		(process as { send?: unknown }).send = undefined;
		onTestFinished(() => {
			(process as { send?: unknown }).send = send;
		});

		const { default: emitter } = await import('./emitter.js');
		const emitAction = vi.spyOn(emitter, 'emitAction');
		const mod = await load({ PORT: String(await getPort()) });
		const server = await mod.startServer();
		servers.push(server);

		await vi.waitFor(() => expect(emitAction).toHaveBeenCalledWith('server.start', { server }, expect.anything()));

		await terminusOptions().onShutdown();
		expect(emitAction).toHaveBeenCalledWith('server.stop', { server }, expect.anything());
	});
});
