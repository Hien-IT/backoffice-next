// Backoffice (feature 011, T017): Directus has no test for controllers/graphql.ts. The routing part mounts the controller
// on a bare Nest app: `/graphql/system` and every path under it are the system scope, `/graphql` and every other path
// under it (including `/graphql/systemx`) the items scope, as Directus' `router.use` (research R12.4); every method but
// GET and POST is a 405 from parseGraphQL (R12.1); a GET mutation is a 405; a response with errors is not cached.
import { useEnv } from '@backoffice/env';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { ErrorHandlerFilter } from '../errors/error-handler.filter.js';
import { GraphQLService } from '../services/graphql/index.js';
import { GraphqlController } from './graphql.controller.js';

vi.mock('@backoffice/env', () => ({ useEnv: vi.fn(() => ({})) }));
vi.mock('../logger/index.js', () => ({
	useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));
// Only a DI token here: the real module loads the schema generator (bus, cache) at import time.
vi.mock('../services/graphql/index.js', () => ({ GraphQLService: class {} }));
// The error handler opens the database for the request.error hook.
vi.mock('../database/index.js', () => ({ default: vi.fn(() => ({})), getDatabase: vi.fn(() => ({})) }));

const execute = vi.fn();
const factory = vi.fn((_options: unknown) => ({ execute }) as any);

@Module({ controllers: [GraphqlController], providers: [{ provide: GraphQLService, useValue: factory }] })
class TestModule {}

let app: NestExpressApplication;
let server: ReturnType<typeof express>;

beforeAll(async () => {
	server = express();
	// The schema, accountability and sanitized query of the request are set by the pipeline; here by a stub in front of
	// Nest.
	server.use((req, _res, next) => {
		(req as any).schema = { collections: {}, relations: [] };
		(req as any).accountability = { role: null, admin: false };
		(req as any).sanitizedQuery = {};
		next();
	});

	app = await NestFactory.create<NestExpressApplication>(TestModule, new ExpressAdapter(server), { logger: false });
	// The error filter of the app (app.ts): Directus' error handler writes the 405 and 400 of parseGraphQL.
	app.useGlobalFilters(new ErrorHandlerFilter());
	await app.init();
});

afterAll(async () => {
	await app.close();
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useEnv).mockReturnValue({ GRAPHQL_QUERY_TOKEN_LIMIT: 5000 });
	execute.mockResolvedValue({ data: { server_ping: 'pong' } });
});

const scopeOf = () => factory.mock.calls[0]![0] as { scope: string };

describe('routing', () => {
	test.each([
		['/graphql/system', 'system'],
		['/graphql/system/anything', 'system'],
		['/graphql/system/a/b', 'system'],
		['/graphql', 'items'],
		['/graphql/', 'items'],
		['/graphql/anything', 'items'],
		['/graphql/systemx', 'items'],
	])('POST %s → scope %s', async (path, scope) => {
		const response = await request(server).post(path).send({ query: '{ server_ping }' });

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ data: { server_ping: 'pong' } });
		expect(scopeOf().scope).toBe(scope);
		expect(factory).toHaveBeenCalledWith(
			expect.objectContaining({ scope, schema: { collections: {}, relations: [] } }),
		);
	});

	test('GET with the document in the query string', async () => {
		const response = await request(server).get('/graphql/system').query({ query: '{ server_ping }' });

		expect(response.status).toBe(200);
		expect(execute).toHaveBeenCalledWith(expect.objectContaining({ query: '{ server_ping }', variables: {} }));
	});

	test.each(['put', 'patch', 'delete', 'options', 'head'])('%s → 405 Allow: GET, POST', async (method) => {
		const response = await (request(server) as any)[method]('/graphql');

		expect(response.status).toBe(405);
		expect(response.headers['allow']).toBe('GET, POST');
		expect(execute).not.toHaveBeenCalled();
	});

	test('a mutation over GET → 405 Allow: POST', async () => {
		const response = await request(server).get('/graphql').query({ query: 'mutation { x }' });

		expect(response.status).toBe(405);
		expect(response.headers['allow']).toBe('POST');
	});

	test('no query → 400 INVALID_PAYLOAD', async () => {
		const response = await request(server).post('/graphql').send({});

		expect(response.status).toBe(400);
		expect(response.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');
	});
});

describe('response', () => {
	test('the result of execute is the payload; errors disable the response cache (locals.cache false)', async () => {
		execute.mockResolvedValue({ data: null, errors: [{ message: 'nope', extensions: { code: 'FORBIDDEN' } }] });
		const response = await request(server).post('/graphql').send({ query: '{ x }' });

		expect(response.status).toBe(200);
		expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
		expect(response.headers['cache-control']).toBe('no-cache');
	});

	test('the GraphQL params of parseGraphQL reach execute with the per-request context', async () => {
		await request(server)
			.post('/graphql')
			.send({ query: 'query A { x }', variables: { a: 1 }, operationName: 'A' });

		const params = execute.mock.calls[0]![0];
		expect(params.operationName).toBe('A');
		expect(params.variables).toEqual({ a: 1 });
		expect(params.contextValue.cache).toBeInstanceOf(Map);
		expect(params.contextValue.req).toBeDefined();
	});
});
