import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { useEnv } from '@backoffice/env';
import { createTerminus, type TerminusOptions } from '@godaddy/terminus';
import getPort from 'get-port';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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
		mod.onServerShutdown(() => order.push('metrics.stop'));
		// Same module instance as server.ts (modules are reset per test).
		const { _cache } = await import('./redis/lib/use-redis.js');
		_cache.redis = { quit: vi.fn(async () => order.push('redis.quit')) } as any;

		expect(mod.SERVER_ONLINE).toBe(true);
		await terminusOptions().beforeShutdown();
		expect(mod.SERVER_ONLINE).toBe(false);
		expect(logger.info).toHaveBeenCalledWith('Shutting down...');

		await terminusOptions().onSignal();
		expect(order).toEqual(['knex.destroy', 'metrics.stop', 'redis.quit']);
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
