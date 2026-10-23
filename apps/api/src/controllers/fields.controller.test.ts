// Feature 006 (T023): the /fields controller (port of directus/api/src/controllers/fields.ts, which DR does not
// unit test) through the real app pipeline on SQLite, with FieldsService mocked: validateCollection first, Joi and the
// zod schema of system fields, the query flag, the field of the URL, 204 when the read back is forbidden.
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
	createField: vi.fn(),
	updateField: vi.fn(),
	updateFields: vi.fn(),
	deleteField: vi.fn(),
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

vi.mock('../services/fields.service.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../services/fields.service.js')>();

	return {
		systemFieldUpdateSchema: original.systemFieldUpdateSchema,
		FieldsService: vi.fn(function (this: unknown, options: unknown) {
			return Object.assign(Object.create(service), { options });
		}),
	};
});

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

describe('/fields', () => {
	test('GET /, /:collection, /:collection/:field; an unknown collection is 403 before the service', async () => {
		service.readAll.mockResolvedValue([{ field: 'id' }]);
		service.readOne.mockResolvedValue({ field: 'title' });
		const http = await agent();

		expect((await http.get('/fields').set('Authorization', admin())).body).toEqual({ data: [{ field: 'id' }] });
		expect(service.readAll).toHaveBeenLastCalledWith();

		expect((await http.get('/fields/articles').set('Authorization', admin())).body).toEqual({
			data: [{ field: 'id' }],
		});
		expect(service.readAll).toHaveBeenLastCalledWith('articles');

		expect((await http.get('/fields/articles/title').set('Authorization', admin())).body).toEqual({
			data: { field: 'title' },
		});

		const unknown = await http.get('/fields/nope/title').set('Authorization', admin());
		expect(unknown.status).toBe(403);
		expect(unknown.body.errors[0].message).toMatch(/collection "nope"/);
		expect(service.readOne).toHaveBeenCalledOnce();
	});

	test('POST: Joi after validateCollection, createField with the flag, read back by the body field', async () => {
		service.readOne.mockResolvedValue({ field: 'subtitle' });
		const http = await agent();

		const created = await http
			.post('/fields/articles?concurrentIndexCreation')
			.set('Authorization', admin())
			.send({ field: 'subtitle', type: 'string' });

		expect(created.status).toBe(200);
		expect(created.body).toEqual({ data: { field: 'subtitle' } });
		expect(service.createField).toHaveBeenCalledWith('articles', { field: 'subtitle', type: 'string' }, undefined, {
			attemptConcurrentIndex: true,
		});

		for (const body of [
			{ type: 'string' },
			{ field: 'x', type: 'nope' },
			{ field: 'x', schema: { max_length: true } },
		]) {
			const res = await http.post('/fields/articles').set('Authorization', admin()).send(body);
			expect(res.status).toBe(400);
			expect(res.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');
		}

		expect((await http.post('/fields/nope').set('Authorization', admin()).send({})).status).toBe(403);

		service.readOne.mockRejectedValue(new ForbiddenError());
		expect((await http.post('/fields/articles').set('Authorization', admin()).send({ field: 'y' })).status).toBe(204);
	});

	test('PATCH /:collection: the body must be an array; system fields only take schema.is_indexed', async () => {
		service.readOne.mockImplementation(async (_c: string, f: string) => ({ field: f }));
		const http = await agent();

		const notArray = await http.patch('/fields/articles').set('Authorization', admin()).send({ field: 'title' });
		expect(notArray.body.errors[0]).toEqual({
			message: 'Invalid payload. Submitted body has to be an array.',
			extensions: { reason: 'Submitted body has to be an array', code: 'INVALID_PAYLOAD' },
		});

		const ok = await http
			.patch('/fields/articles?concurrentIndexCreation=false')
			.set('Authorization', admin())
			.send([{ field: 'title', meta: { note: 'n' } }, { field: 'id' }]);
		expect(ok.body).toEqual({ data: [{ field: 'title' }, { field: 'id' }] });
		expect(service.updateFields).toHaveBeenCalledWith('articles', expect.any(Array), { attemptConcurrentIndex: false });

		const system = await http
			.patch('/fields/directus_users')
			.set('Authorization', admin())
			.send([{ field: 'email', schema: { is_unique: true } }]);
		expect(system.status).toBe(400);
		expect(system.body.errors[0].extensions.reason).toBe('Only "schema.is_indexed" may be modified for system fields');

		const indexed = await http
			.patch('/fields/directus_users')
			.set('Authorization', admin())
			.send([{ field: 'email', schema: { is_indexed: true } }]);
		expect(indexed.status).toBe(200);

		expect((await http.patch('/fields/articles').set('Authorization', admin()).send([])).status).toBe(204);
	});

	test('PATCH /:collection/:field: Joi for user fields, zod for system fields, the field of the URL by default', async () => {
		service.readOne.mockResolvedValue({ field: 'title' });
		const http = await agent();

		await http
			.patch('/fields/articles/title')
			.set('Authorization', admin())
			.send({ meta: { note: 'n' } });
		expect(service.updateField).toHaveBeenCalledWith(
			'articles',
			{ meta: { note: 'n' }, field: 'title' },
			{ attemptConcurrentIndex: false },
		);

		await http.patch('/fields/articles/title').set('Authorization', admin()).send({ field: 'other' });
		expect(service.updateField).toHaveBeenLastCalledWith(
			'articles',
			{ field: 'other' },
			{ attemptConcurrentIndex: false },
		);
		expect(service.readOne).toHaveBeenLastCalledWith('articles', 'title');

		const invalid = await http.patch('/fields/articles/title').set('Authorization', admin()).send({ type: 'nope' });
		expect(invalid.status).toBe(400);

		const system = await http.patch('/fields/directus_users/email').set('Authorization', admin()).send({ meta: {} });
		expect(system.body.errors[0].extensions.reason).toBe('Only "schema.is_indexed" may be modified for system fields');

		service.readOne.mockRejectedValue(new ForbiddenError());
		expect((await http.patch('/fields/articles/title').set('Authorization', admin()).send({})).status).toBe(204);
	});

	test('DELETE: system fields 403 before the service, others 204', async () => {
		const http = await agent();

		expect((await http.delete('/fields/directus_users/email').set('Authorization', admin())).status).toBe(403);
		expect(service.deleteField).not.toHaveBeenCalled();

		expect((await http.delete('/fields/articles/title').set('Authorization', admin())).status).toBe(204);
		expect(service.deleteField).toHaveBeenCalledWith('articles', 'title');
	});
});
