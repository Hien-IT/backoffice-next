import { Module, type OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Express } from 'express';
import emitter from '../emitter.js';
import { getExtensionManager } from './index.js';

/**
 * Mounts the endpoint extensions router like directus/api/src/app.ts:378-380. Nest calls onModuleInit after it
 * registered the controller routes and before its not-found handler, so system routes win over an endpoint with the
 * same path and unknown paths still reach the 404 (spec 020, research R3).
 */
@Module({})
export class ExtensionsModule implements OnModuleInit {
	constructor(private readonly adapterHost: HttpAdapterHost) {}

	async onModuleInit(): Promise<void> {
		const app = this.adapterHost.httpAdapter.getInstance<Express>();

		await emitter.emitInit('routes.custom.before', { app });
		app.use(getExtensionManager().getEndpointRouter());
		await emitter.emitInit('routes.custom.after', { app });
	}
}
