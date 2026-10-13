// Feature 010 (T014): the /settings controller (port of directus/api/src/controllers/settings.ts, which Directus does
// not unit test) through the real app pipeline on SQLite, with SettingsService mocked.
import * as env from '@backoffice/env';
import { ForbiddenError } from '@backoffice/errors';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ADMIN, createDataModelDb, SECRET, startApp, token } from '../../test/data-model-app.js';
import type { App } from '../app.js';
import { clearSystemCache } from '../cache.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

const service = vi.hoisted(() => ({ readSingleton: vi.fn(), upsertSingleton: vi.fn(), setOwner: vi.fn() }));

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

vi.mock('../services/settings.service.js', () => ({
	SettingsService: vi.fn(function (this: unknown, options: unknown) {
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

test('GET / reads the singleton with the sanitized query; a missing record is null', async () => {
	service.readSingleton.mockResolvedValue({ project_name: 'P' });
	const request = await agent();

	const res = await request.get('/settings?fields=project_name').set('Authorization', admin());
	expect(res.status).toBe(200);
	expect(res.body).toEqual({ data: { project_name: 'P' } });
	expect(service.readSingleton).toHaveBeenCalledWith(expect.objectContaining({ fields: ['project_name'] }));

	service.readSingleton.mockResolvedValue(undefined);
	expect((await request.get('/settings').set('Authorization', admin())).body).toEqual({ data: null });
});

test('POST /owner calls setOwner with the body and answers 204 without a body', async () => {
	const request = await agent();
	const body = { project_owner: 'a@b.c', project_usage: null, org_name: null, product_updates: false };

	const res = await request.post('/settings/owner').set('Authorization', admin()).send(body);
	expect(res.status).toBe(204);
	expect(res.text).toBe('');
	expect(service.setOwner).toHaveBeenCalledWith(body);
});

test('PATCH / upserts then reads again; a forbidden read gives 204', async () => {
	service.readSingleton.mockResolvedValue({ project_name: 'Q' });
	const request = await agent();

	const res = await request.patch('/settings').set('Authorization', admin()).send({ project_name: 'Q' });
	expect(res.status).toBe(200);
	expect(res.body).toEqual({ data: { project_name: 'Q' } });
	expect(service.upsertSingleton).toHaveBeenCalledWith({ project_name: 'Q' });

	service.readSingleton.mockRejectedValue(new ForbiddenError());
	expect((await request.patch('/settings').set('Authorization', admin()).send({})).status).toBe(204);
});

test('OPTIONS /settings and /settings/owner answer like the Directus router', async () => {
	const request = await agent();

	expect((await request.options('/settings')).headers['allow']).toBe('GET,HEAD,PATCH');
	expect((await request.options('/settings/owner')).headers['allow']).toBe('POST');
});
