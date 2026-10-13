// Feature 006 (T022): the /collections controller (port of directus/api/src/controllers/collections.ts, which Directus
// does not unit test) through the real app pipeline on SQLite, with CollectionsService mocked: route order,
// validateBatch, the query flag, the body forms, 204 when the read back is forbidden. Responses and DDL are compared
// with Directus by tests/parity/src/schema-management.
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
	createOne: vi.fn(),
	createMany: vi.fn(),
	readOne: vi.fn(),
	readMany: vi.fn(),
	readByQuery: vi.fn(),
	updateOne: vi.fn(),
	updateBatch: vi.fn(),
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

vi.mock('../services/collections.service.js', () => ({
	CollectionsService: vi.fn(function (this: unknown, options: unknown) {
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

describe('/collections', () => {
	test('POST one: createOne with the concurrent index flag, read back with readOne', async () => {
		service.createOne.mockResolvedValue('blog');
		service.readOne.mockResolvedValue({ collection: 'blog' });
		const http = await agent();

		const res = await http
			.post('/collections?concurrentIndexCreation')
			.set('Authorization', admin())
			.send({ collection: 'blog' });

		expect(res.status).toBe(200);
		expect(res.body).toEqual({ data: { collection: 'blog' } });
		expect(service.createOne).toHaveBeenCalledWith({ collection: 'blog' }, { attemptConcurrentIndex: true });
		expect(service.readOne).toHaveBeenCalledWith('blog');

		await http
			.post('/collections?concurrentIndexCreation=false')
			.set('Authorization', admin())
			.send({ collection: 'b' });
		expect(service.createOne).toHaveBeenLastCalledWith({ collection: 'b' }, { attemptConcurrentIndex: false });
	});

	test('POST array: createMany and readMany; a service error keeps its status', async () => {
		service.createMany.mockResolvedValue(['a', 'b']);
		service.readMany.mockResolvedValue([{ collection: 'a' }, { collection: 'b' }]);
		const http = await agent();

		const res = await http
			.post('/collections')
			.set('Authorization', admin())
			.send([{ collection: 'a' }, { collection: 'b' }]);
		expect(res.body).toEqual({ data: [{ collection: 'a' }, { collection: 'b' }] });
		expect(service.createMany).toHaveBeenCalledWith([{ collection: 'a' }, { collection: 'b' }], {
			attemptConcurrentIndex: false,
		});

		service.createOne.mockRejectedValue(new ForbiddenError());
		expect((await http.post('/collections').set('Authorization', admin()).send({ collection: 'x' })).status).toBe(403);
	});

	test('GET and SEARCH: readByQuery without the query, readMany for body keys, no meta (empty meta query)', async () => {
		service.readByQuery.mockResolvedValue([{ collection: 'articles' }]);
		service.readMany.mockResolvedValue([{ collection: 'articles' }]);
		const http = await agent();

		const list = await http.get('/collections?limit=1&meta=*').set('Authorization', admin());
		expect(list.status).toBe(200);
		expect(list.body.data).toEqual([{ collection: 'articles' }]);
		expect(service.readByQuery).toHaveBeenCalledWith();
		// getMetaForQuery('directus_collections', {}) ignores ?meta=*, like Directus.
		expect(list.body).not.toHaveProperty('meta');

		const search = await http
			.search('/collections')
			.set('Authorization', admin())
			.send({ keys: ['articles'] });
		expect(search.body.data).toEqual([{ collection: 'articles' }]);
		expect(service.readMany).toHaveBeenCalledWith(['articles']);

		const invalid = await http.search('/collections').set('Authorization', admin()).send({ keys: 'x' });
		expect(invalid.status).toBe(400);
		expect(invalid.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');
	});

	test('GET /:collection, PATCH /:collection, PATCH batch: 204 when the read back is forbidden', async () => {
		service.readOne.mockResolvedValue({ collection: 'articles' });
		service.updateOne.mockResolvedValue('articles');
		service.updateBatch.mockResolvedValue(['articles']);
		service.readMany.mockRejectedValue(new ForbiddenError());
		const http = await agent();

		expect((await http.get('/collections/articles').set('Authorization', admin())).body).toEqual({
			data: { collection: 'articles' },
		});

		const one = await http
			.patch('/collections/articles')
			.set('Authorization', admin())
			.send({ meta: { note: 'n' } });
		expect(one.body).toEqual({ data: { collection: 'articles' } });
		expect(service.updateOne).toHaveBeenCalledWith('articles', { meta: { note: 'n' } });

		const batch = await http
			.patch('/collections')
			.set('Authorization', admin())
			.send([{ collection: 'articles', meta: {} }]);
		expect(batch.status).toBe(204);
		expect(service.updateBatch).toHaveBeenCalledWith([{ collection: 'articles', meta: {} }]);

		service.readOne.mockRejectedValue(new ForbiddenError());
		expect((await http.patch('/collections/articles').set('Authorization', admin()).send({})).status).toBe(204);
	});

	test('DELETE /:collection: 204; OPTIONS answered before the controller', async () => {
		service.deleteOne.mockResolvedValue('articles');
		const http = await agent();

		const res = await http.delete('/collections/articles').set('Authorization', admin());
		expect(res.status).toBe(204);
		expect(service.deleteOne).toHaveBeenCalledWith('articles');

		expect((await http.options('/collections/nope')).headers['allow']).toBe('GET,HEAD,PATCH,DELETE');
	});
});
