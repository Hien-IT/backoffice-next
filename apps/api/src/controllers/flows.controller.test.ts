// Feature 009 (T021): the /flows controller (port of directus/api/src/controllers/flows.ts, which DR does not
// unit test) through the real app pipeline on SQLite, with FlowsService and the FlowManager mocked.
import * as env from '@backoffice/env';
import { ForbiddenError } from '@backoffice/errors';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ADMIN, createDataModelDb, SECRET, startApp, token } from '../../test/data-model-app.js';
import type { App } from '../app.js';
import { clearSystemCache } from '../cache.js';
import { getFlowManager } from '../flows.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

const service = vi.hoisted(() => ({
	createOne: vi.fn(),
	createMany: vi.fn(),
	readOne: vi.fn(),
	readMany: vi.fn(),
	readByQuery: vi.fn(),
	updateBatch: vi.fn(),
	updateMany: vi.fn(),
	updateByQuery: vi.fn(),
	updateOne: vi.fn(),
	deleteMany: vi.fn(),
	deleteByQuery: vi.fn(),
	deleteOne: vi.fn(),
}));

vi.mock('../flows.js', async () => (await import('../test-utils/flows.js')).mockFlowManager());

vi.mock('@backoffice/env', async (importOriginal) => {
	const actual = await importOriginal<typeof env>();
	return { ...actual, useEnv: vi.fn(actual.useEnv) };
});

vi.mock('../database/index.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../database/index.js')>();
	return { ...original, default: () => state.db, getDatabase: () => state.db, getDatabaseClient: () => 'sqlite' };
});

vi.mock('../schema/get-database-schema.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../schema/get-database-schema.js')>();
	return { ...original, getSchema: () => original.getDatabaseSchema(state.db, createInspector(state.db)) };
});

vi.mock('../services/flows.service.js', () => ({
	FlowsService: vi.fn(function (this: unknown, options: unknown) {
		return Object.assign(Object.create(service), { options });
	}),
}));

vi.mock('../logger/index.js', () => {
	const logger = { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn(), fatal: vi.fn(), trace: vi.fn() };
	return {
		useLogger: () => logger,
		createExpressLogger: () => (_req: unknown, _res: unknown, next: () => void) => next(),
	};
});

const defaults = (await vi.importActual<typeof env>('@backoffice/env')).useEnv();
const admin = () => token(ADMIN);
const runWebhookFlow = vi.mocked(getFlowManager().runWebhookFlow);
const FLOW = '3f1c2d4e-0000-4000-8000-00000000000a';
let app: App;

async function agent() {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET });
	const started = await startApp();
	app = started.app;
	return started.agent;
}

beforeEach(async () => {
	state.db = await createDataModelDb();
	for (const fn of Object.values(service)) fn.mockReset();
	runWebhookFlow.mockReset();
	service.readOne.mockImplementation(async (key: string) => ({ id: key }));
	service.readMany.mockImplementation(async (keys: string[]) => keys.map((id) => ({ id })));
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

test('GET and POST /trigger/:pk run the webhook flow with the request data and return the raw result', async () => {
	runWebhookFlow.mockResolvedValue({ result: { hello: 'A' }, cacheEnabled: true });
	const request = await agent();

	const get = await request.get(`/flows/trigger/${FLOW}?x=1`).set('User-Agent', 'parity');
	expect(get.status).toBe(200);
	expect(get.body).toEqual({ hello: 'A' });

	const [key, data, context] = runWebhookFlow.mock.calls[0]!;
	expect(key).toBe(`GET-${FLOW}`);
	expect(data).toMatchObject({ path: `/trigger/${FLOW}`, query: { x: '1' }, method: 'GET' });
	expect((data as any).headers['user-agent']).toBe('parity');
	expect(context).toMatchObject({ accountability: expect.objectContaining({ user: null }) });

	const post = await request.post(`/flows/trigger/${FLOW}`).send({ name: 'A' });
	expect(post.status).toBe(200);
	expect(runWebhookFlow.mock.calls[1]![0]).toBe(`POST-${FLOW}`);
	expect(runWebhookFlow.mock.calls[1]![1]).toMatchObject({ body: { name: 'A' }, method: 'POST' });
});

test.each([[undefined], [null], [0], ['']])('a falsy result (%s) answers 204', async (result) => {
	runWebhookFlow.mockResolvedValue({ result, cacheEnabled: true });
	const request = await agent();

	expect((await request.get(`/flows/trigger/${FLOW}`)).status).toBe(204);
});

test('cacheEnabled false turns the response cache off for this response', async () => {
	runWebhookFlow.mockResolvedValue({ result: 'x', cacheEnabled: false });
	const request = await agent();

	const res = await request.get(`/flows/trigger/${FLOW}`);
	expect(res.body).toBe('x');
	expect(res.headers['cache-control']).toBe('no-cache');
});

test('a key that is not a uuid is a 404 route; an upper case uuid reaches the flow manager as is', async () => {
	runWebhookFlow.mockRejectedValue(new ForbiddenError());
	const request = await agent();

	const notUuid = await request.get('/flows/trigger/not-a-uuid');
	expect(notUuid.status).toBe(404);
	expect(notUuid.body.errors[0]).toMatchObject({
		message: "Route /flows/trigger/not-a-uuid doesn't exist.",
		extensions: { code: 'ROUTE_NOT_FOUND' },
	});
	expect(runWebhookFlow).not.toHaveBeenCalled();

	const upper = await request.get(`/flows/trigger/${FLOW.toUpperCase()}`);
	expect(upper.status).toBe(403);
	expect(runWebhookFlow.mock.calls[0]![0]).toBe(`GET-${FLOW.toUpperCase()}`);
});

test('OPTIONS /flows/trigger/:pk answers GET, HEAD, POST', async () => {
	const request = await agent();

	expect((await request.options(`/flows/trigger/${FLOW}`)).headers['allow']).toBe('GET,HEAD,POST');
});

test('POST one item or an array, 204 when the new item cannot be read', async () => {
	service.createOne.mockResolvedValue('f1');
	service.createMany.mockResolvedValue(['f2', 'f3']);
	const request = await agent();

	const one = await request.post('/flows').set('Authorization', admin()).send({ name: 'A' });
	expect(one.status).toBe(200);
	expect(one.body).toEqual({ data: { id: 'f1' } });

	const many = await request
		.post('/flows')
		.set('Authorization', admin())
		.send([{ name: 'B' }, { name: 'C' }]);
	expect(many.body).toEqual({ data: [{ id: 'f2' }, { id: 'f3' }] });

	service.readOne.mockRejectedValue(new ForbiddenError());
	expect((await request.post('/flows').set('Authorization', admin()).send({ name: 'D' })).status).toBe(204);
});

test('GET and SEARCH read by query only (no keys branch), GET /:pk reads one', async () => {
	service.readByQuery.mockResolvedValue([{ id: 'x' }]);
	const request = await agent();

	expect((await request.get('/flows').set('Authorization', admin())).body.data).toEqual([{ id: 'x' }]);

	await request
		.search('/flows')
		.set('Authorization', admin())
		.send({ query: { limit: 1 } });
	expect(service.readByQuery).toHaveBeenCalledTimes(2);
	expect(service.readMany).not.toHaveBeenCalled();

	expect((await request.get('/flows/abc').set('Authorization', admin())).body).toEqual({ data: { id: 'abc' } });
});

test('PATCH batch, keys and one; DELETE array, keys and one (no batch validation on DELETE, as in Directus)', async () => {
	service.updateBatch.mockResolvedValue(['a']);
	service.updateMany.mockResolvedValue(['k']);
	service.updateOne.mockResolvedValue('b');
	const request = await agent();

	await request
		.patch('/flows')
		.set('Authorization', admin())
		.send([{ id: 'a', name: 'x' }]);
	expect(service.updateBatch).toHaveBeenCalledWith([{ id: 'a', name: 'x' }]);

	await request
		.patch('/flows')
		.set('Authorization', admin())
		.send({ keys: ['k'], data: { status: 'inactive' } });
	expect(service.updateMany).toHaveBeenCalledWith(['k'], { status: 'inactive' });

	const one = await request.patch('/flows/b').set('Authorization', admin()).send({ name: 'y' });
	expect(one.body).toEqual({ data: { id: 'b' } });

	expect((await request.delete('/flows').set('Authorization', admin()).send(['c'])).status).toBe(204);
	expect(service.deleteMany).toHaveBeenCalledWith(['c']);

	await request
		.delete('/flows')
		.set('Authorization', admin())
		.send({ keys: ['d'] });
	expect(service.deleteMany).toHaveBeenLastCalledWith(['d']);

	expect((await request.delete('/flows/e').set('Authorization', admin())).status).toBe(204);
	expect(service.deleteOne).toHaveBeenCalledWith('e');
});
