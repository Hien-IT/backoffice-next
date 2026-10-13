// Feature 010 (T028): the /shares controller (port of directus/api/src/controllers/shares.ts, which Directus does not
// unit test) through the real app pipeline on SQLite, with SharesService mocked: /auth in its three modes, /invite,
// /info/:pk, the uuid params, reads by query only without meta, and DELETE / without validateBatch.
import * as env from '@backoffice/env';
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
	login: vi.fn(),
	invite: vi.fn(),
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

vi.mock('../services/shares.service.js', () => mockService('SharesService'));

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

const UUID = '3f1c2d4e-0000-4000-8000-00000000000a';

describe('POST /shares/auth', () => {
	test('json (default): tokens in the body; cookie: refresh cookie; session: session cookie only', async () => {
		service.login.mockResolvedValue({ accessToken: 'a.b.c', refreshToken: 'r'.repeat(64), expires: 900000 });
		const request = await agent();

		const json = await request.post('/shares/auth').send({ share: UUID, password: 'pw' });
		expect(json.status).toBe(200);
		expect(json.body).toEqual({ data: { expires: 900000, refresh_token: 'r'.repeat(64), access_token: 'a.b.c' } });
		expect(service.login).toHaveBeenCalledWith({ share: UUID, password: 'pw' }, { session: false });
		expect((service.login.mock.instances[0] as any)?.options?.accountability).toBeUndefined();

		const cookie = await request.post('/shares/auth').send({ share: UUID, mode: 'cookie' });
		expect(cookie.body).toEqual({ data: { expires: 900000, access_token: 'a.b.c' } });
		expect(cookie.headers['set-cookie']![0]).toMatch(/^directus_refresh_token=r{64};/);

		const session = await request.post('/shares/auth').send({ share: UUID, mode: 'session' });
		expect(session.body).toEqual({ data: { expires: 900000 } });
		expect(session.headers['set-cookie']![0]).toMatch(/^directus_session_token=a\.b\.c;/);
		expect(service.login).toHaveBeenLastCalledWith({ share: UUID, mode: 'session' }, { session: true });
	});

	test('joi: missing share, a wrong mode → 400 INVALID_PAYLOAD; extra keys pass', async () => {
		service.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expires: 1 });
		const request = await agent();

		const missing = await request.post('/shares/auth').send({ password: 'x' });
		expect(missing.status).toBe(400);
		expect(missing.body.errors[0].message).toBe('Invalid payload. "share" is required.');

		expect((await request.post('/shares/auth').send({ share: UUID, mode: 'other' })).status).toBe(400);
		expect((await request.post('/shares/auth').send({ share: UUID, extra: 1 })).status).toBe(200);
	});
});

test('POST /shares/invite: joi, then invite with the body; 204', async () => {
	const request = await agent();

	expect(
		(
			await request
				.post('/shares/invite')
				.set('Authorization', admin())
				.send({ emails: ['a'] })
		).status,
	).toBe(400);

	const res = await request
		.post('/shares/invite')
		.set('Authorization', admin())
		.send({ share: UUID, emails: ['a@b.c'] });
	expect(res.status).toBe(204);
	expect(service.invite).toHaveBeenCalledWith({ share: UUID, emails: ['a@b.c'] });
});

test('GET /shares/info/:pk reads without accountability with the time window; non-uuid → 404', async () => {
	service.readOne.mockResolvedValue({ id: UUID });
	const request = await agent();

	const res = await request.get(`/shares/info/${UUID.toUpperCase()}`);
	expect(res.body).toEqual({ data: { id: UUID } });
	expect(service.readOne).toHaveBeenCalledWith(
		UUID.toUpperCase(),
		expect.objectContaining({
			fields: ['id', 'collection', 'item', 'password', 'max_uses', 'times_used', 'date_start', 'date_end'],
		}),
	);
	expect((service.readOne.mock.calls[0]![1] as any).filter._and).toHaveLength(2);

	expect((await request.get('/shares/info/not-a-uuid')).status).toBe(404);
	expect((await request.get('/shares/info')).status).toBe(404);
});

test('GET reads by query, null when empty, no meta; :pk must be a uuid on GET, PATCH, DELETE', async () => {
	service.readByQuery.mockResolvedValue(undefined);
	const request = await agent();

	expect((await request.get('/shares?meta=*').set('Authorization', admin())).body).toEqual({ data: null });

	await request
		.search('/shares')
		.set('Authorization', admin())
		.send({ keys: [UUID] });
	expect(service.readMany).not.toHaveBeenCalled();

	for (const method of ['get', 'patch', 'delete'] as const) {
		expect((await request[method]('/shares/abc').set('Authorization', admin())).status, method).toBe(404);
	}

	expect((await request.get(`/shares/${UUID}`).set('Authorization', admin())).body).toEqual({ data: { id: UUID } });
	expect((await request.delete(`/shares/${UUID}`).set('Authorization', admin())).status).toBe(204);
	expect(service.deleteOne).toHaveBeenCalledWith(UUID);
});

test('POST, PATCH; DELETE / without validateBatch reads a body without keys as a query', async () => {
	service.createOne.mockResolvedValue(UUID);
	service.updateOne.mockResolvedValue(UUID);
	const request = await agent();

	expect(
		(await request.post('/shares').set('Authorization', admin()).send({ collection: 'x', item: '1' })).body,
	).toEqual({
		data: { id: UUID },
	});

	service.readOne.mockResolvedValue(undefined);
	expect((await request.patch(`/shares/${UUID}`).set('Authorization', admin()).send({})).body).toEqual({ data: null });

	const byQuery = await request
		.delete('/shares')
		.set('Authorization', admin())
		.send({ query: { filter: { id: { _eq: UUID } } } });
	expect(byQuery.status).toBe(204);
	expect(service.deleteByQuery).toHaveBeenCalledWith(expect.objectContaining({ filter: { id: { _eq: UUID } } }));

	// Neither keys nor query: sanitizeQuery(undefined) throws, as in Directus (no validateBatch on this route); the
	// parity file compares the answer of both apps.
	expect((await request.delete('/shares').set('Authorization', admin()).send({})).status).toBe(500);
});

test('OPTIONS answers like the Directus router', async () => {
	const request = await agent();

	expect((await request.options('/shares')).headers['allow']).toBe('POST,GET,HEAD,SEARCH,PATCH,DELETE');
	expect((await request.options('/shares/auth')).headers['allow']).toBe('POST');
	expect((await request.options(`/shares/info/${UUID}`)).headers['allow']).toBe('GET,HEAD');
	expect((await request.options(`/shares/${UUID}`)).headers['allow']).toBe('GET,HEAD,PATCH,DELETE');
});
