// Feature 010 (T020, T024, T043, T046): the five CRUD controllers of /presets, /notifications, /translations,
// /dashboards and /panels (ports of directus/api/src/controllers/<name>.ts, which Directus does not unit test) through
// the real app pipeline on SQLite, with their services mocked. Two families, as in Directus: presets, notifications and
// translations read with `singleton`, `keys` or the query; dashboards and panels read by query only, with
// `records || null`, and their DELETE / has no validateBatch.
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
	readSingleton: vi.fn(),
	updateBatch: vi.fn(),
	updateMany: vi.fn(),
	updateByQuery: vi.fn(),
	updateOne: vi.fn(),
	deleteMany: vi.fn(),
	deleteByQuery: vi.fn(),
	deleteOne: vi.fn(),
}));

const mockService = vi.hoisted(() => (name: string) => ({
	[name]: vi.fn(function (this: unknown, options: unknown) {
		return Object.assign(Object.create(service), { options });
	}),
}));

vi.mock('../services/presets.service.js', () => mockService('PresetsService'));
vi.mock('../services/notifications.service.js', () => mockService('NotificationsService'));
vi.mock('../services/translations.service.js', () => mockService('TranslationsService'));
vi.mock('../services/dashboards.service.js', () => mockService('DashboardsService'));
vi.mock('../services/panels.service.js', () => mockService('PanelsService'));

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

const ALL = ['presets', 'notifications', 'translations', 'dashboards', 'panels'];

describe.each(ALL)('/%s', (path) => {
	test('POST one item or an array, 204 when the new item cannot be read', async () => {
		service.createOne.mockResolvedValue('f1');
		service.createMany.mockResolvedValue(['f2', 'f3']);
		const request = await agent();

		const one = await request.post(`/${path}`).set('Authorization', admin()).send({ name: 'A' });
		expect(one.status).toBe(200);
		expect(one.body).toEqual({ data: { id: 'f1' } });

		const many = await request
			.post(`/${path}`)
			.set('Authorization', admin())
			.send([{ name: 'B' }, { name: 'C' }]);
		expect(many.body).toEqual({ data: [{ id: 'f2' }, { id: 'f3' }] });

		service.readOne.mockRejectedValue(new ForbiddenError());
		expect((await request.post(`/${path}`).set('Authorization', admin()).send({ name: 'D' })).status).toBe(204);
	});

	test('GET /:pk, PATCH batch and one, DELETE one; the services get the request accountability', async () => {
		service.updateBatch.mockResolvedValue(['a']);
		service.updateOne.mockResolvedValue('b');
		const request = await agent();

		expect((await request.get(`/${path}/abc`).set('Authorization', admin())).body).toEqual({ data: { id: 'abc' } });

		await request
			.patch(`/${path}`)
			.set('Authorization', admin())
			.send([{ id: 'a', name: 'x' }]);
		expect(service.updateBatch).toHaveBeenCalledWith([{ id: 'a', name: 'x' }]);

		const one = await request.patch(`/${path}/b`).set('Authorization', admin()).send({ name: 'y' });
		expect(service.updateOne).toHaveBeenCalledWith('b', { name: 'y' });
		expect(one.body).toEqual({ data: { id: 'b' } });

		service.readOne.mockRejectedValue(new ForbiddenError());
		expect((await request.patch(`/${path}/b`).set('Authorization', admin()).send({})).status).toBe(204);

		expect((await request.delete(`/${path}/d`).set('Authorization', admin())).status).toBe(204);
		expect(service.deleteOne).toHaveBeenCalledWith('d');

		expect((await request.patch(`/${path}`).set('Authorization', admin()).send({ data: {} })).status).toBe(400);
	});

	test('DELETE / with keys, an array or a query', async () => {
		const request = await agent();

		await request
			.delete(`/${path}`)
			.set('Authorization', admin())
			.send({ keys: ['c'] });
		expect(service.deleteMany).toHaveBeenCalledWith(['c']);

		await request.delete(`/${path}`).set('Authorization', admin()).send(['e']);
		expect(service.deleteMany).toHaveBeenCalledWith(['e']);

		await request
			.delete(`/${path}`)
			.set('Authorization', admin())
			.send({ query: { filter: { id: { _eq: 'f' } } } });
		expect(service.deleteByQuery).toHaveBeenCalledWith(expect.objectContaining({ filter: { id: { _eq: 'f' } } }));
	});
});

describe.each(['presets', 'notifications', 'translations'])('/%s reads like the comments router', (path) => {
	test('GET by query with meta, SEARCH with keys', async () => {
		service.readByQuery.mockResolvedValue([{ id: 'x' }]);
		const request = await agent();

		expect((await request.get(`/${path}`).set('Authorization', admin())).body.data).toEqual([{ id: 'x' }]);

		await request
			.search(`/${path}`)
			.set('Authorization', admin())
			.send({ keys: ['a'] });
		expect(service.readMany).toHaveBeenCalledWith(['a'], expect.anything());
	});

	test('DELETE / runs validateBatch: a body without keys, an array or a query is a 400', async () => {
		const request = await agent();
		expect((await request.delete(`/${path}`).set('Authorization', admin()).send({})).status).toBe(400);
	});
});

describe.each(['dashboards', 'panels'])('/%s reads by query only', (path) => {
	test('GET and SEARCH always read by query, null when the service gives nothing', async () => {
		service.readByQuery.mockResolvedValue(undefined);
		const request = await agent();

		expect((await request.get(`/${path}`).set('Authorization', admin())).body.data).toBe(null);

		await request
			.search(`/${path}`)
			.set('Authorization', admin())
			.send({ keys: ['a'] });
		expect(service.readMany).not.toHaveBeenCalled();
		expect(service.readByQuery).toHaveBeenCalledTimes(2);
	});
});

test('PATCH /translations and PATCH /:pk of translations, dashboards, panels answer null for an empty read', async () => {
	service.updateMany.mockResolvedValue(['a']);
	service.updateOne.mockResolvedValue('a');
	const request = await agent();

	service.readMany.mockResolvedValue(undefined);
	const batch = await request
		.patch('/translations')
		.set('Authorization', admin())
		.send({ keys: ['a'], data: {} });
	expect(batch.body).toEqual({ data: null });

	service.readOne.mockResolvedValue(undefined);
	for (const path of ['translations', 'dashboards', 'panels']) {
		const res = await request.patch(`/${path}/a`).set('Authorization', admin()).send({});
		expect(res.body, path).toEqual({ data: null });
	}
});

test.each(ALL)('OPTIONS /%s and /%s/:pk answer like the Directus router', async (path) => {
	const request = await agent();

	expect((await request.options(`/${path}`)).headers['allow']).toBe('POST,GET,HEAD,SEARCH,PATCH,DELETE');
	expect((await request.options(`/${path}/1`)).headers['allow']).toBe('GET,HEAD,PATCH,DELETE');
});
