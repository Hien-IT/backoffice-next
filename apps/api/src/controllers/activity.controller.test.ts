// Feature 008 (T018): the /activity controller (port of directus/api/src/controllers/activity.ts, which DR does
// not unit test) through the real app pipeline on SQLite, with ActivityService mocked.
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

vi.mock('../services/activity.service.js', () => ({
	ActivityService: vi.fn(function (this: unknown, options: unknown) {
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

test('GET reads by query, SEARCH by keys or query, both with meta', async () => {
	service.readByQuery.mockResolvedValue([{ id: 1 }]);
	const request = await agent();

	const list = await request.get('/activity?meta=total_count').set('Authorization', admin());
	expect(list.status).toBe(200);
	expect(list.body).toEqual({ data: [{ id: 1 }], meta: { total_count: 0 } });

	await request
		.search('/activity')
		.set('Authorization', admin())
		.send({ keys: [2, 3] });
	expect(service.readMany).toHaveBeenCalledWith([2, 3], expect.anything());

	await request
		.search('/activity')
		.set('Authorization', admin())
		.send({ query: { limit: 1 } });
	expect(service.readByQuery).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 1 }));
});

test('SEARCH validates its body like Directus: keys or query only', async () => {
	const request = await agent();

	const invalid = await request.search('/activity').set('Authorization', admin()).send({ foo: 1 });
	expect(invalid.status).toBe(400);
	expect(invalid.body.errors[0].extensions.reason).toBe('"foo" is not allowed');
	expect((await request.search('/activity').set('Authorization', admin()).send({})).status).toBe(200);
});

test('GET /:pk returns the row', async () => {
	const request = await agent();

	expect((await request.get('/activity/12').set('Authorization', admin())).body).toEqual({ data: { id: '12' } });
	expect(service.readOne).toHaveBeenCalledWith('12', expect.anything());
});

test('no write route: POST is 404', async () => {
	const request = await agent();

	expect((await request.post('/activity').set('Authorization', admin()).send({})).status).toBe(404);
});
