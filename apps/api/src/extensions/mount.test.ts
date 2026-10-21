// Backoffice (spec 020, T022): the endpoint router is mounted after the controller routes and before Nest's 404, with
// the routes.custom.before/after init events around it like directus/api/src/app.ts:378-380.
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import express, { Router } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import emitter from '../emitter.js';
import { ExtensionsModule } from './extensions.module.js';

const endpointRouter = Router();

vi.mock('./index.js', () => ({ getExtensionManager: () => ({ getEndpointApp: () => endpointRouter }) }));
vi.mock('../emitter.js', () => ({ default: { emitInit: vi.fn() } }));

@Controller('server')
class PingController {
	@Get('ping')
	ping() {
		return 'pong';
	}
}

@Module({ imports: [ExtensionsModule], controllers: [PingController] })
class TestModule {}

let app: NestExpressApplication;
const demo = Router().get('/', (_req, res) => void res.send('demo'));

beforeAll(async () => {
	endpointRouter.use(
		'/server',
		Router().get('/ping', (_req, res) => void res.send('extension')),
	);
	endpointRouter.use('/demo', demo);

	app = await NestFactory.create<NestExpressApplication>(TestModule, new ExpressAdapter(express()), { logger: false });
	await app.init();
});

afterAll(async () => {
	await app.close();
});

test('emits the init events around the mount', () => {
	expect(vi.mocked(emitter.emitInit).mock.calls.map(([event]) => event)).toEqual([
		'routes.custom.before',
		'routes.custom.after',
	]);
});

test('a system route wins over an endpoint with the same path', async () => {
	await request(app.getHttpServer()).get('/server/ping').expect(200, 'pong');
});

test('an endpoint is reachable, then 404 once its layer is removed', async () => {
	await request(app.getHttpServer()).get('/demo').expect(200, 'demo');

	endpointRouter.stack = endpointRouter.stack.filter((layer) => layer.handle !== demo);

	await request(app.getHttpServer()).get('/demo').expect(404);
});
