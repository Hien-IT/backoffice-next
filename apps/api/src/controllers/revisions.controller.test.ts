// Feature 008 (T019): the /revisions controller (port of directus/api/src/controllers/revisions.ts, which Directus
// does not unit test) through the real app pipeline on SQLite, with RevisionsService mocked.
import * as env from '@backoffice/env';
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

vi.mock('../services/revisions.service.js', () => ({
	RevisionsService: vi.fn(function (this: unknown, options: unknown) {
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

test('GET and SEARCH read by query with meta; GET validates like SEARCH', async () => {
	service.readByQuery.mockResolvedValue([{ id: 1 }]);
	const request = await agent();

	const list = await request.get('/revisions?meta=filter_count').set('Authorization', admin());
	expect(list.status).toBe(200);
	expect(list.body).toEqual({ data: [{ id: 1 }], meta: { filter_count: 0 } });

	await request
		.search('/revisions')
		.set('Authorization', admin())
		.send({ query: { limit: 1 } });
	expect(service.readByQuery).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 1 }));
	expect(service.readMany).not.toHaveBeenCalled();
});

test('SEARCH with keys still reads by query: /revisions has no readMany', async () => {
	service.readByQuery.mockResolvedValue([]);
	const request = await agent();

	await request
		.search('/revisions')
		.set('Authorization', admin())
		.send({ keys: [1] });

	expect(service.readMany).not.toHaveBeenCalled();
	expect(service.readByQuery).toHaveBeenCalled();
});

test('GET /:pk returns the row', async () => {
	const request = await agent();

	expect((await request.get('/revisions/5').set('Authorization', admin())).body).toEqual({ data: { id: '5' } });
});
