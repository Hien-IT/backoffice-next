import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import type { Express } from 'express';
import { AppModule } from './app.module.js';
import { type ExpressAppOptions, createExpressApp } from './app-pipeline.js';
import { ErrorHandlerFilter } from './errors/error-handler.filter.js';
import { NestLoggerService } from './logger/nest-logger.service.js';

export interface App {
	nest: NestExpressApplication;
	express: Express;
}

/** Builds the Express pipeline, mounts the Nest routes on it and initialises Nest (no listen). */
export async function createApp(options: ExpressAppOptions = {}): Promise<App> {
	const express = createExpressApp(options);

	const nest = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(express), {
		bodyParser: false,
		logger: new NestLoggerService(),
	});

	nest.useGlobalFilters(new ErrorHandlerFilter());

	await nest.init();

	return { nest, express };
}
