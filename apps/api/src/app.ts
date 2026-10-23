import 'reflect-metadata';
import { useEnv } from '@backoffice/env';
import { toBoolean } from '@backoffice/utils';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import type { Express } from 'express';
import { AppModule } from './app.module.js';
import { type ExpressAppOptions, createExpressApp } from './app-pipeline.js';
import { subscribeSchemaChanged } from './cache.js';
import emitter from './emitter.js';
import { ErrorHandlerFilter } from './errors/error-handler.filter.js';
import { getExtensionManager } from './extensions/index.js';
import { getFlowManager } from './flows.js';
import { NestLoggerService } from './logger/nest-logger.service.js';
import { onServerShutdown } from './shutdown.js';
import metricsSchedule from './schedules/metrics.js';
import retentionSchedule from './schedules/retention.js';
import tusSchedule from './schedules/tus.js';
import { registerWebSocketEvents } from './websocket/controllers/hooks.js';

export interface App {
	nest: NestExpressApplication;
	express: Express;
}

/** Builds the Express pipeline, mounts the Nest routes on it and initialises Nest (no listen). */
export async function createApp(options: ExpressAppOptions = {}): Promise<App> {
	// DR subscribes when its cache module loads; Backoffice does it here, before any request (feature 002)
	subscribeSchemaChanged();

	// DR initializes the flows after the auth providers (end of runStartupChecks here) and before express()
	// (app.ts:128-131), so event flows see the first request (feature 009, research R2).
	const extensionManager = getExtensionManager();
	const flowManager = getFlowManager();

	await extensionManager.initialize();
	await flowManager.initialize();
	// Backoffice: stop the extensions and the cron jobs of scheduled flows with the other shutdown tasks; DR
	// relies on pm2.
	onServerShutdown(() => extensionManager.unload());
	onServerShutdown(() => flowManager.unload());

	const express = await createExpressApp(options);

	const nest = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(), new ExpressAdapter(express), {
		bodyParser: false,
		logger: new NestLoggerService(),
	});

	nest.useGlobalFilters(new ErrorHandlerFilter());

	await nest.init();

	await emitter.emitInit('routes.after', { app: express });

	await startSchedules();

	await emitter.emitInit('app.after', { app: express });

	registerWebSocketBridge();

	return { nest, express };
}

/**
 * The scheduled jobs, in the order of the end of DR' createApp (retention, telemetry, tus, metrics, project;
 * telemetry and project are out of scope). Each job stops with the shutdown tasks.
 */
export async function startSchedules(): Promise<void> {
	await retentionSchedule();
	await tusSchedule();
	await metricsSchedule();
}

/**
 * DR registers the websocket.event bus bridge when it creates its REST (websocket/controllers/rest.ts:18) or
 * GraphQL (graphql.ts:26) WebSocket controller, in createServer (server.ts:104). Backoffice opens no WebSocket
 * (Principle XI, spec FR-033) but publishes the same messages under the same condition, so the DR instances that
 * hold the clients push the changes made here (feature 005, D-30).
 */
export function registerWebSocketBridge(): void {
	const env = useEnv();

	if (
		toBoolean(env['WEBSOCKETS_ENABLED']) &&
		(toBoolean(env['WEBSOCKETS_REST_ENABLED']) || toBoolean(env['WEBSOCKETS_GRAPHQL_ENABLED']))
	) {
		registerWebSocketEvents();
	}
}
