// Ported from directus/api/src/server.ts (without WebSocket controllers, telemetry and AI telemetry: out of scope).
import * as http from 'http';
import * as https from 'https';
import type { ListenOptions } from 'net';
import url from 'url';
import { useEnv } from '@backoffice/env';
import { getNodeEnv } from '@backoffice/utils/node';
import type { TerminusOptions } from '@godaddy/terminus';
import { createTerminus } from '@godaddy/terminus';
import type { Request } from 'express';
import { once } from 'lodash-es';
import qs from 'qs';
import { createApp } from './app.js';
import getDatabase from './database/index.js';
import emitter from './emitter.js';
import { useLogger } from './logger/index.js';
import { _cache as redisCache } from './redis/lib/use-redis.js';
import { runShutdownTasks } from './shutdown.js';
import { getAddress } from './utils/get-address.js';
import { getConfigFromEnv } from './utils/get-config-from-env.js';
import { getIPFromReq } from './utils/get-ip-from-req.js';

export let SERVER_ONLINE = true;

export async function createServer(): Promise<http.Server> {
	const env = useEnv();
	const logger = useLogger();

	const { express } = await createApp();
	const server = http.createServer(express);

	Object.assign(server, getConfigFromEnv('SERVER_'));

	server.on('request', function (req: http.IncomingMessage & Request, res: http.ServerResponse) {
		const startTime = process.hrtime();

		const complete = once(function (finished: boolean) {
			const elapsedTime = process.hrtime(startTime);
			const elapsedNanoseconds = elapsedTime[0] * 1e9 + elapsedTime[1];
			const elapsedMilliseconds = elapsedNanoseconds / 1e6;

			const previousIn = (req.socket as any)._metrics?.in || 0;
			const previousOut = (req.socket as any)._metrics?.out || 0;

			const metrics = {
				in: req.socket.bytesRead - previousIn,
				out: req.socket.bytesWritten - previousOut,
			};

			(req.socket as any)._metrics = {
				in: req.socket.bytesRead,
				out: req.socket.bytesWritten,
			};

			// Compatibility when supporting serving with certificates
			const protocol = server instanceof https.Server ? 'https' : 'http';

			// Rely on url.parse for path extraction
			// Doesn't break on illegal URLs
			const urlInfo = url.parse(req.originalUrl || req.url);

			const info = {
				finished,
				request: {
					aborted: req.aborted,
					completed: req.complete,
					method: req.method,
					url: urlInfo.href,
					path: urlInfo.pathname,
					protocol,
					host: req.headers.host,
					size: metrics.in,
					query: urlInfo.query ? qs.parse(urlInfo.query) : {},
					headers: req.headers,
				},
				response: {
					status: res.statusCode,
					size: metrics.out,
					headers: res.getHeaders(),
				},
				ip: getIPFromReq(req),
				duration: elapsedMilliseconds.toFixed(),
			};

			emitter.emitAction('response', info, {
				database: getDatabase(),
				schema: req.schema,
				accountability: req.accountability ?? null,
			});
		});

		res.once('finish', complete.bind(null, true));
		res.once('close', complete.bind(null, false));
	});

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
		redisCache.redis?.disconnect();
		await runShutdownTasks();
	}

	async function onShutdown() {
		emitter.emitAction(
			'server.stop',
			{ server },
			{
				database: getDatabase(),
				schema: null,
				accountability: null,
			},
		);

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

			emitter.emitAction(
				'server.start',
				{ server },
				{
					database: getDatabase(),
					schema: null,
					accountability: null,
				},
			);
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
