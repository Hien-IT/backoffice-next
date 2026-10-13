// Feature 007 (T041): the /files/tus controller (port of directus/api/src/controllers/tus.ts) through the real app
// pipeline on SQLite, with createTusServer and validateAccess mocked: the action checkFileAccess asks for each method,
// Upload-Metadata (replacement, fields, invalid), the cleanup after handle(), and no route when TUS_ENABLED is off.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ADMIN, createDataModelDb, SECRET, startApp, token } from '../../test/data-model-app.js';
import type { App } from '../app.js';
import { clearSystemCache } from '../cache.js';
import { validateAccess } from '../permissions/modules/validate-access/validate-access.js';
import { createTusServer } from '../services/tus/index.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

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

vi.mock('../permissions/modules/validate-access/validate-access.js', () => ({ validateAccess: vi.fn() }));
vi.mock('../services/tus/index.js', () => ({ createTusServer: vi.fn() }));
vi.mock('../schedules/tus.js', () => ({ default: vi.fn() }));

vi.mock('../logger/index.js', () => {
	const logger = { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn(), fatal: vi.fn(), trace: vi.fn() };
	return {
		useLogger: () => logger,
		createExpressLogger: () => (_req: unknown, _res: unknown, next: () => void) => next(),
	};
});

const defaults = (await vi.importActual<typeof env>('@backoffice/env')).useEnv();
const admin = () => token(ADMIN);
const cleanup = vi.fn();
const handle = vi.fn();
let app: App;

async function agent(tus = true) {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET, TUS_ENABLED: tus });
	const started = await startApp();
	app = started.app;
	return started.agent;
}

const metadata = (values: Record<string, string>) =>
	Object.entries(values)
		.map(([key, value]) => `${key} ${Buffer.from(value).toString('base64')}`)
		.join(',');

beforeEach(async () => {
	state.db = await createDataModelDb();
	vi.mocked(validateAccess).mockReset();
	cleanup.mockReset();

	handle.mockReset().mockImplementation(async (_req, res) => {
		res.writeHead(204, { 'Tus-Resumable': '1.0.0' });
		res.end();
	});

	vi.mocked(createTusServer)
		.mockClear()
		.mockResolvedValue([{ handle } as any, cleanup]);
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

describe('TUS_ENABLED=true', () => {
	test.each([
		['post', '/files/tus', 'create'],
		['patch', '/files/tus/abc', 'update'],
		['delete', '/files/tus/abc', 'delete'],
		['head', '/files/tus/abc', 'read'],
		['options', '/files/tus/abc', 'read'],
	] as const)('%s %s: checks %s on directus_files, then hands the request to tus', async (method, path, action) => {
		const res = await (await agent())[method](path).set('Authorization', admin());

		expect(res.status).toBe(204);
		expect(res.headers['tus-resumable']).toBe('1.0.0');
		expect(vi.mocked(validateAccess).mock.calls[0]![0]).toMatchObject({ action, collection: 'directus_files' });
		expect(createTusServer).toHaveBeenCalledWith(expect.objectContaining({ accountability: expect.anything() }));
		expect(handle).toHaveBeenCalled();
		expect(cleanup).toHaveBeenCalled();
	});

	test('Upload-Metadata: id makes it an update of that file, file fields are checked, others ignored', async () => {
		await (
			await agent()
		)
			.post('/files/tus')
			.set('Authorization', admin())
			.set('Upload-Metadata', metadata({ id: 'f1', type: 'image/png', not_a_field: 'x' }));

		expect(vi.mocked(validateAccess).mock.calls[0]![0]).toMatchObject({
			action: 'update',
			primaryKeys: ['f1'],
			fields: ['type'],
		});
	});

	test('an Upload-Metadata that does not parse: 400 INVALID_METADATA before tus', async () => {
		const res = await (await agent()).post('/files/tus').set('Authorization', admin()).set('Upload-Metadata', 'a b c');

		expect(res.status).toBe(400);
		expect(res.body.errors[0].extensions.code).toBe('INVALID_METADATA');
		expect(handle).not.toHaveBeenCalled();
	});

	test('a refused permission stops before tus', async () => {
		const { ForbiddenError } = await import('@backoffice/errors');
		vi.mocked(validateAccess).mockRejectedValue(new ForbiddenError());

		const res = await (await agent()).patch('/files/tus/abc').set('Authorization', admin());

		expect(res.status).toBe(403);
		expect(handle).not.toHaveBeenCalled();
	});
});

test('TUS_ENABLED off: no tus routes, the requests fall to /files like Directus', async () => {
	const request = await agent(false);

	expect((await request.post('/files/tus').set('Authorization', admin())).status).toBe(404);
	expect(createTusServer).not.toHaveBeenCalled();
});
