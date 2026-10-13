// Feature 008 (T025): the /versions controller (port of directus/api/src/controllers/versions.ts, which Directus does
// not unit test) through the real app pipeline on SQLite, with VersionsService mocked.
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
	verifyHash: vi.fn(),
	getMainItem: vi.fn(),
	save: vi.fn(),
	promote: vi.fn(),
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

vi.mock('../services/versions.service.js', () => ({
	VersionsService: vi.fn(function (this: unknown, options: unknown) {
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

	const one = await request.post('/versions').set('Authorization', admin()).send({ name: 'A' });
	expect(one.status).toBe(200);
	expect(one.body).toEqual({ data: { id: 'f1' } });

	const many = await request
		.post('/versions')
		.set('Authorization', admin())
		.send([{ name: 'B' }, { name: 'C' }]);
	expect(many.body).toEqual({ data: [{ id: 'f2' }, { id: 'f3' }] });

	service.readOne.mockRejectedValue(new ForbiddenError());
	expect((await request.post('/versions').set('Authorization', admin()).send({ name: 'D' })).status).toBe(204);
});

test('GET, SEARCH and GET /:pk', async () => {
	service.readByQuery.mockResolvedValue([{ id: 'x' }]);
	const request = await agent();

	expect((await request.get('/versions').set('Authorization', admin())).body.data).toEqual([{ id: 'x' }]);

	await request
		.search('/versions')
		.set('Authorization', admin())
		.send({ keys: ['a'] });
	expect(service.readMany).toHaveBeenCalledWith(['a'], expect.anything());

	expect((await request.get('/versions/abc').set('Authorization', admin())).body).toEqual({ data: { id: 'abc' } });
});

test('PATCH batch and one, DELETE batch and one', async () => {
	service.updateBatch.mockResolvedValue(['a']);
	service.updateOne.mockResolvedValue('b');
	const request = await agent();

	await request
		.patch('/versions')
		.set('Authorization', admin())
		.send([{ id: 'a', name: 'x' }]);
	expect(service.updateBatch).toHaveBeenCalledWith([{ id: 'a', name: 'x' }]);

	const one = await request.patch('/versions/b').set('Authorization', admin()).send({ name: 'y' });
	expect(service.updateOne).toHaveBeenCalledWith('b', { name: 'y' });
	expect(one.body).toEqual({ data: { id: 'b' } });

	expect(
		(
			await request
				.delete('/versions')
				.set('Authorization', admin())
				.send({ keys: ['c'] })
		).status,
	).toBe(204);
	expect(service.deleteMany).toHaveBeenCalledWith(['c']);

	expect((await request.delete('/versions/d').set('Authorization', admin())).status).toBe(204);
	expect(service.deleteOne).toHaveBeenCalledWith('d');

	expect((await request.patch('/versions').set('Authorization', admin()).send({ data: {} })).status).toBe(400);
});

test('GET /:pk/compare: outdated, mainHash, the delta with the primary key, the main item', async () => {
	service.readOne.mockResolvedValue({ collection: 'directus_users', item: 'f1', hash: 'h0', delta: { name: 'b' } });
	service.verifyHash.mockResolvedValue({ outdated: true, mainHash: 'h1' });
	service.getMainItem.mockResolvedValue({ id: 'f1', name: 'a' });
	const request = await agent();

	const res = await request.get('/versions/v1/compare').set('Authorization', admin());

	expect(res.body).toEqual({
		data: { outdated: true, mainHash: 'h1', current: { name: 'b', id: 'f1' }, main: { id: 'f1', name: 'a' } },
	});
	expect(service.verifyHash).toHaveBeenCalledWith('directus_users', 'f1', 'h0');
});

test('POST /:pk/save answers the main item with the saved delta over it', async () => {
	service.readOne.mockResolvedValue({ collection: 'directus_folders', item: 'f1' });
	service.getMainItem.mockResolvedValue({ id: 'f1', name: 'a', parent: null });
	service.save.mockResolvedValue({ name: 'b' });
	const request = await agent();

	const res = await request.post('/versions/v1/save').set('Authorization', admin()).send({ name: 'b' });

	expect(res.status).toBe(200);
	expect(res.body).toEqual({ data: { id: 'f1', name: 'b', parent: null } });
	expect(service.save).toHaveBeenCalledWith('v1', { name: 'b' });
});

test('POST /:pk/promote needs a string mainHash and answers the key of the item', async () => {
	service.promote.mockResolvedValue('f1');
	const request = await agent();

	const missing = await request.post('/versions/v1/promote').set('Authorization', admin()).send({ mainHash: 1 });
	expect(missing.status).toBe(400);
	expect(missing.body.errors[0].extensions.reason).toBe('"mainHash" field is required');

	const res = await request
		.post('/versions/v1/promote')
		.set('Authorization', admin())
		.send({ mainHash: 'h1', fields: ['name'] });
	expect(res.status).toBe(200);
	expect(res.body).toEqual({ data: 'f1' });
	expect(service.promote).toHaveBeenCalledWith('v1', 'h1', ['name']);
});
