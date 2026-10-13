// Feature 006 (T029): the /relations controller (port of directus/api/src/controllers/relations.ts, which Directus does
// not unit test) through the real app pipeline on SQLite, with RelationsService mocked: validateCollection on the
// routes that have it, the Joi schemas, the body passed as is, 204 when the read back is forbidden.
import * as env from '@backoffice/env';
import { ForbiddenError } from '@backoffice/errors';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ADMIN, createDataModelDb, SECRET, startApp, token } from '../../test/data-model-app.js';
import type { App } from '../app.js';
import { clearSystemCache } from '../cache.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

const service = vi.hoisted(() => ({
	readAll: vi.fn(),
	readOne: vi.fn(),
	createOne: vi.fn(),
	updateOne: vi.fn(),
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

vi.mock('../services/relations.service.js', () => ({
	RelationsService: vi.fn(function (this: unknown, options: unknown) {
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
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

describe('/relations', () => {
	test('GET /, /:collection, /:collection/:field; validateCollection on the last two only', async () => {
		service.readAll.mockResolvedValue([{ field: 'author' }]);
		service.readOne.mockResolvedValue({ field: 'author' });
		const http = await agent();

		expect((await http.get('/relations').set('Authorization', admin())).body).toEqual({ data: [{ field: 'author' }] });
		expect(service.readAll).toHaveBeenLastCalledWith();
		expect((await http.get('/relations/articles').set('Authorization', admin())).status).toBe(200);
		expect(service.readAll).toHaveBeenLastCalledWith('articles');
		expect((await http.get('/relations/articles/author').set('Authorization', admin())).body).toEqual({
			data: { field: 'author' },
		});

		expect((await http.get('/relations/nope').set('Authorization', admin())).status).toBe(403);
		expect((await http.get('/relations/nope/x').set('Authorization', admin())).status).toBe(403);
		expect(service.readAll).toHaveBeenCalledTimes(2);
	});

	test('POST: Joi (collection and field required, on_delete values), createOne, read back by the body', async () => {
		service.readOne.mockResolvedValue({ field: 'author' });
		const http = await agent();
		const body = {
			collection: 'articles',
			field: 'author',
			related_collection: 'users',
			schema: { on_delete: 'SET NULL' },
		};

		const created = await http.post('/relations').set('Authorization', admin()).send(body);
		expect(created.status).toBe(200);
		expect(service.createOne).toHaveBeenCalledWith(body);
		expect(service.readOne).toHaveBeenCalledWith('articles', 'author');

		for (const invalid of [{ field: 'x' }, { collection: 'articles' }, { ...body, schema: { on_delete: 'NOPE' } }]) {
			const res = await http.post('/relations').set('Authorization', admin()).send(invalid);
			expect(res.status).toBe(400);
			expect(res.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');
		}

		service.readOne.mockRejectedValue(new ForbiddenError());
		expect((await http.post('/relations').set('Authorization', admin()).send(body)).status).toBe(204);
	});

	test('PATCH: validateCollection, Joi, updateOne with the URL keys and the body; DELETE 204', async () => {
		service.readOne.mockResolvedValue({ field: 'author' });
		const http = await agent();

		const res = await http
			.patch('/relations/articles/author')
			.set('Authorization', admin())
			.send({ schema: { on_delete: 'CASCADE' } });
		expect(res.body).toEqual({ data: { field: 'author' } });
		expect(service.updateOne).toHaveBeenCalledWith('articles', 'author', { schema: { on_delete: 'CASCADE' } });

		expect(
			(
				await http
					.patch('/relations/articles/author')
					.set('Authorization', admin())
					.send({ schema: { on_delete: 'x' } })
			).status,
		).toBe(400);
		expect((await http.patch('/relations/nope/author').set('Authorization', admin()).send({})).status).toBe(403);

		expect((await http.delete('/relations/articles/author').set('Authorization', admin())).status).toBe(204);
		expect(service.deleteOne).toHaveBeenCalledWith('articles', 'author');
		expect((await http.delete('/relations/nope/author').set('Authorization', admin())).status).toBe(403);
	});
});
