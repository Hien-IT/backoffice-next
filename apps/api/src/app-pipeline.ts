// Ported from directus/api/src/app.ts (the Express middleware chain, in the same order; research R5).
// `authenticate` and `sanitizeQuery` run on every route like Directus (feature 004). Not ported here: the response cache (005), requestCounter (telemetry),
// extensions, WebSocket, AI/MCP, deployment webhooks and SERVE_APP (D-08, D-17).
import { useEnv } from '@backoffice/env';
import { ServiceUnavailableError } from '@backoffice/errors';
import { handlePressure } from '@backoffice/pressure';
import cookieParser from 'cookie-parser';
import express, { type Express, type RequestHandler } from 'express';
import { contentSecurityPolicy, crossOriginOpenerPolicy, hsts } from 'helmet';
import { merge } from 'lodash-es';
import qs from 'qs';
import emitter from './emitter.js';
import { createExpressLogger } from './logger/index.js';
import checkCacheMiddleware from './middleware/cache.js';
import cors from './middleware/cors.js';
import extractToken from './middleware/extract-token.js';
import authenticate from './middleware/authenticate.js';
import { createJsonBody } from './middleware/json-body.js';
import { createRouterOptions } from './middleware/router-options.js';
import sanitizeQuery from './middleware/sanitize-query.js';
import schema from './middleware/schema.js';
import rateLimiterGlobal from './middleware/rate-limiter-global.js';
import rateLimiter from './middleware/rate-limiter-ip.js';
import { getConfigFromEnv } from './utils/get-config-from-env.js';

export interface ExpressAppOptions {
	/** Rate limiters mounted between `/robots.txt` and `/server/ping`; default: global then IP, when enabled. */
	rateLimiters?: RequestHandler[];
	/** Middleware mounted after the accountability step, right before the Nest routes. */
	beforeRoutes?: RequestHandler[];
}

export async function createExpressApp(options: ExpressAppOptions = {}): Promise<Express> {
	const env = useEnv();

	const app = express();

	app.disable('x-powered-by');
	app.set('trust proxy', env['IP_TRUST_PROXY']);

	app.set('query parser', (str: string) =>
		qs.parse(str, {
			depth: Number(env['QUERYSTRING_MAX_PARSE_DEPTH']),
			arrayLimit: Number(env['QUERYSTRING_ARRAY_LIMIT']),
		}),
	);

	if (env['PRESSURE_LIMITER_ENABLED']) {
		const sampleInterval = Number(env['PRESSURE_LIMITER_SAMPLE_INTERVAL']);

		if (Number.isNaN(sampleInterval) === true || Number.isFinite(sampleInterval) === false) {
			throw new Error(`Invalid value for PRESSURE_LIMITER_SAMPLE_INTERVAL environment variable`);
		}

		app.use(
			handlePressure({
				sampleInterval,
				maxEventLoopUtilization: env['PRESSURE_LIMITER_MAX_EVENT_LOOP_UTILIZATION'] as number,
				maxEventLoopDelay: env['PRESSURE_LIMITER_MAX_EVENT_LOOP_DELAY'] as number,
				maxMemoryRss: env['PRESSURE_LIMITER_MAX_MEMORY_RSS'] as number,
				maxMemoryHeapUsed: env['PRESSURE_LIMITER_MAX_MEMORY_HEAP_USED'] as number,
				error: new ServiceUnavailableError({ service: 'api', reason: 'Under pressure' }),
				retryAfter: env['PRESSURE_LIMITER_RETRY_AFTER'] as string,
			}),
		);
	}

	app.use(
		contentSecurityPolicy(
			merge(
				{
					useDefaults: true,
					directives: {
						// Unsafe-eval is required for app extensions
						scriptSrc: ["'self'", "'unsafe-eval'"],

						// Even though this is recommended to have enabled, it breaks most local
						// installations. Making this opt-in rather than opt-out is a little more
						// friendly. Ref #10806
						upgradeInsecureRequests: null,

						// These are required for MapLibre
						workerSrc: ["'self'", 'blob:'],
						childSrc: ["'self'", 'blob:'],
						imgSrc: [
							"'self'",
							'data:',
							'blob:',
							'https://raw.githubusercontent.com',
							'https://avatars.githubusercontent.com',
						],
						mediaSrc: ["'self'"],
						connectSrc: ["'self'", 'https://*', 'wss://*'],
					},
				},
				getConfigFromEnv('CONTENT_SECURITY_POLICY_'),
			),
		),
	);

	if (env['CROSS_ORIGIN_OPENER_POLICY_ENABLED']) {
		app.use(
			crossOriginOpenerPolicy({
				policy: (env['CROSS_ORIGIN_OPENER_POLICY'] ?? 'same-origin-allow-popups') as
					| 'same-origin'
					| 'same-origin-allow-popups'
					| 'unsafe-none',
			}),
		);
	}

	if (env['HSTS_ENABLED']) {
		app.use(hsts(getConfigFromEnv('HSTS_', { omitPrefix: 'HSTS_ENABLED' })));
	}

	await emitter.emitInit('app.before', { app });

	await emitter.emitInit('middlewares.before', { app });

	app.use(createExpressLogger());

	app.use((_req, res, next) => {
		res.setHeader('X-Powered-By', 'Backoffice');
		next();
	});

	if (env['CORS_ENABLED'] === true) {
		app.use(cors);
	}

	app.use(createJsonBody());

	app.use(cookieParser());

	app.use(extractToken);

	app.get('/', (_req, res, next) => {
		if (env['ROOT_REDIRECT']) {
			res.redirect(env['ROOT_REDIRECT'] as string);
		} else {
			next();
		}
	});

	app.get('/robots.txt', (_, res) => {
		res.set('Content-Type', 'text/plain');
		res.status(200);
		res.send(env['ROBOTS_TXT']);
	});

	// use the rate limiter - all routes for now
	const rateLimiters = options.rateLimiters ?? [
		...(env['RATE_LIMITER_GLOBAL_ENABLED'] === true ? [rateLimiterGlobal] : []),
		...(env['RATE_LIMITER_ENABLED'] === true ? [rateLimiter] : []),
	];

	for (const limiter of rateLimiters) app.use(limiter);

	app.get('/server/ping', (_req, res) => res.send('pong'));

	app.use(authenticate);

	app.use(schema);

	app.use(sanitizeQuery);

	app.use(checkCacheMiddleware);

	for (const middleware of options.beforeRoutes ?? []) app.use(middleware);

	await emitter.emitInit('middlewares.after', { app });

	await emitter.emitInit('routes.before', { app });

	app.use(createRouterOptions());

	// Nest mounts its routes, its 404 handler and the error filter after this point (main.ts).
	return app;
}
