// Ported from directus/api/src/server.ts (without WebSocket controllers, telemetry, AI telemetry and the
// emitter hooks `response`, `server.start`, `server.stop`: out of scope or feature 009).
import * as http from 'http';
import * as https from 'https';
import type { ListenOptions } from 'net';
import { useEnv } from '@backoffice/env';
import { getNodeEnv } from '@backoffice/utils/node';
import type { TerminusOptions } from '@godaddy/terminus';
import { createTerminus } from '@godaddy/terminus';
import { createApp } from './app.js';
import getDatabase from './database/index.js';
import { useLogger } from './logger/index.js';
import { _cache as redisCache } from './redis/lib/use-redis.js';
import { getAddress } from './utils/get-address.js';
import { getConfigFromEnv } from './utils/get-config-from-env.js';

export let SERVER_ONLINE = true;

/** Extra resources to close on shutdown (rate limiter and cache clients, metrics job), Principle VII. */
const shutdownTasks: (() => unknown)[] = [];

export function onServerShutdown(task: () => unknown): void {
	shutdownTasks.push(task);
}

export async function createServer(): Promise<http.Server> {
	const env = useEnv();
	const logger = useLogger();

	const { express } = await createApp();
	const server = http.createServer(express);

	Object.assign(server, getConfigFromEnv('SERVER_'));

	const terminusOptions: TerminusOptions = {
		timeout:
			(env['SERVER_SHUTDOWN_TIMEOUT'] as number) >= 0 && (env['SERVER_SHUTDOWN_TIMEOUT'] as number) < Infinity
				? (env['SERVER_SHUTDOWN_TIMEOUT'] as number)
				: 1000,
		signals: ['SIGINT', 'SIGTERM', 'SIGHUP'],
		beforeShutdown,
		onSignal,
		onShutdown,
	};

	// Like Directus, no `logger` option: an error during shutdown exits with code 1 without a log line.
	createTerminus(server, terminusOptions);

	return server;

	async function beforeShutdown() {
		if (getNodeEnv() !== 'development') {
			logger.info('Shutting down...');
		}

		SERVER_ONLINE = false;
	}

	async function onSignal() {
		const database = getDatabase();
		await database.destroy();

		logger.info('Database connections destroyed');

		// Backoffice: also stop the metrics job and close Redis connections before exiting (Principle VII).
		for (const task of shutdownTasks) await task();
		await redisCache.redis?.quit();
	}

	async function onShutdown() {
		if (getNodeEnv() !== 'development') {
			logger.info('Backoffice shut down OK. Bye bye!');
		}
	}
}

export async function startServer(): Promise<http.Server> {
	const env = useEnv();
	const logger = useLogger();

	const server = await createServer();

	const host = env['HOST'] as string;
	const path = env['UNIX_SOCKET_PATH'] as string | undefined;
	const port = env['PORT'] as string;

	let listenOptions: ListenOptions;

	if (path) {
		listenOptions = { path };
	} else {
		listenOptions = {
			host,
			port: parseInt(port),
		};
	}

	server
		.listen(listenOptions, () => {
			const protocol = server instanceof https.Server ? 'https' : 'http';

			logger.info(
				`Server started at ${listenOptions.port ? `${protocol}://${getAddress(server)}` : getAddress(server)}`,
			);

			process.send?.('ready');
		})
		.once('error', (err: any) => {
			if (err?.code === 'EADDRINUSE') {
				logger.error(`${listenOptions.port ? `Port ${listenOptions.port}` : getAddress(server)} is already in use`);
				process.exit(1);
			} else {
				throw err;
			}
		});

	return server;
}
