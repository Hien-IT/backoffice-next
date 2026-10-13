// Feature 008 (T031): the /comments controller (port of directus/api/src/controllers/comments.ts, which Directus does
// not unit test) through the real app pipeline on SQLite, with CommentsService mocked.
import * as env from '@backoffice/env';
import { ForbiddenError } from '@backoffice/errors';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ADMIN, createDataModelDb, SECRET, startApp, token } from '../../test/data-model-app.js';
import type { App } from '../app.js';
import { clearSystemCache } from '../cache.js';

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

vi.mock('../services/comments.service.js', () => ({
	CommentsService: vi.fn(function (this: unknown, options: unknown) {
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
	service.readOne.mockImplementation(async (key: string) => ({ id: key }));
	service.readMany.mockImplementation(async (keys: string[]) => keys.map((id) => ({ id })));
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

test('POST one item or an array, 204 when the new item cannot be read', async () => {
	service.createOne.mockResolvedValue('f1');
	service.createMany.mockResolvedValue(['f2', 'f3']);
	const request = await agent();

	const one = await request.post('/comments').set('Authorization', admin()).send({ name: 'A' });
	expect(one.status).toBe(200);
	expect(one.body).toEqual({ data: { id: 'f1' } });

	const many = await request
		.post('/comments')
		.set('Authorization', admin())
		.send([{ name: 'B' }, { name: 'C' }]);
	expect(many.body).toEqual({ data: [{ id: 'f2' }, { id: 'f3' }] });

	service.readOne.mockRejectedValue(new ForbiddenError());
	expect((await request.post('/comments').set('Authorization', admin()).send({ name: 'D' })).status).toBe(204);
});

test('GET, SEARCH and GET /:pk', async () => {
	service.readByQuery.mockResolvedValue([{ id: 'x' }]);
	const request = await agent();

	expect((await request.get('/comments').set('Authorization', admin())).body.data).toEqual([{ id: 'x' }]);

	await request
		.search('/comments')
		.set('Authorization', admin())
		.send({ keys: ['a'] });
	expect(service.readMany).toHaveBeenCalledWith(['a'], expect.anything());

	expect((await request.get('/comments/abc').set('Authorization', admin())).body).toEqual({ data: { id: 'abc' } });
});

test('PATCH batch and one, DELETE batch and one', async () => {
	service.updateBatch.mockResolvedValue(['a']);
	service.updateOne.mockResolvedValue('b');
	const request = await agent();

	await request
		.patch('/comments')
		.set('Authorization', admin())
		.send([{ id: 'a', name: 'x' }]);
	expect(service.updateBatch).toHaveBeenCalledWith([{ id: 'a', name: 'x' }]);

	const one = await request.patch('/comments/b').set('Authorization', admin()).send({ name: 'y' });
	expect(service.updateOne).toHaveBeenCalledWith('b', { name: 'y' });
	expect(one.body).toEqual({ data: { id: 'b' } });

	expect(
		(
			await request
				.delete('/comments')
				.set('Authorization', admin())
				.send({ keys: ['c'] })
		).status,
	).toBe(204);
	expect(service.deleteMany).toHaveBeenCalledWith(['c']);

	expect((await request.delete('/comments/d').set('Authorization', admin())).status).toBe(204);
	expect(service.deleteOne).toHaveBeenCalledWith('d');

	expect((await request.patch('/comments').set('Authorization', admin()).send({ data: {} })).status).toBe(400);
});

test('PATCH answers the rows as read, without turning an empty read into null', async () => {
	service.updateMany.mockResolvedValue(['a']);
	service.readMany.mockResolvedValue(undefined);
	const request = await agent();

	const res = await request
		.patch('/comments')
		.set('Authorization', admin())
		.send({ keys: ['a'], data: { comment: 'x' } });
	expect(res.status).toBe(200);
	expect(service.updateMany).toHaveBeenCalledWith(['a'], { comment: 'x' });
});
