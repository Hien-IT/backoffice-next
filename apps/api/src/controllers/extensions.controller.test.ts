// Feature 010 (T050): the /extensions controller (port of directus/api/src/controllers/extensions.ts, which Directus
// does not unit test) through the real app pipeline on SQLite, with ExtensionsService and the registry client mocked:
// the ListQuery of /registry, the uuid params, admin checks, install/reinstall/uninstall through the service (D-37 lifted), PATCH/DELETE /:pk and the empty app bundle.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ADMIN, createDataModelDb, SECRET, startApp, token, USER } from '../../test/data-model-app.js';
import type { App } from '../app.js';
import { clearSystemCache } from '../cache.js';
import { account, describe as describeExtension, list } from '../extensions/registry/index.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));
const { readAll, updateOne, deleteOne, install, reinstall, uninstall } = vi.hoisted(() => ({
	readAll: vi.fn(),
	updateOne: vi.fn(),
	deleteOne: vi.fn(),
	install: vi.fn(),
	reinstall: vi.fn(),
	uninstall: vi.fn(),
}));

vi.mock('../services/extensions.service.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../services/extensions.service.js')>()),
	ExtensionsService: vi.fn(function (this: unknown, options: unknown) {
		return { readAll, updateOne, deleteOne, install, reinstall, uninstall, options };
	}),
}));

vi.mock('../extensions/registry/index.js', () => ({ list: vi.fn(), account: vi.fn(), describe: vi.fn() }));

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

async function agent(extra: Record<string, unknown> = {}) {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET, ...extra });
	const started = await startApp();
	app = started.app;
	return started.agent;
}

beforeEach(async () => {
	state.db = await createDataModelDb();
	vi.clearAllMocks();
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

const UUID = '3f1c2d4e-0000-4000-8000-00000000000a';

test('GET /extensions: readAll with the caller accountability, { data }', async () => {
	readAll.mockResolvedValue([{ id: UUID, bundle: null, meta: { id: UUID }, schema: null }]);
	const request = await agent();

	const res = await request.get('/extensions').set('Authorization', admin());

	expect(res.status).toBe(200);
	expect(res.body).toEqual({ data: [{ id: UUID, bundle: null, meta: { id: UUID }, schema: null }] });
});

describe('GET /extensions/registry', () => {
	test('admin only; the ListQuery of Directus from the sanitized query', async () => {
		vi.mocked(list).mockResolvedValue({ meta: { filter_count: 0 }, data: [] });
		const request = await agent({ MARKETPLACE_TRUST: 'sandbox', MARKETPLACE_REGISTRY: 'http://registry:9100' });

		expect((await request.get('/extensions/registry').set('Authorization', token(USER))).status).toBe(403);
		expect((await request.get('/extensions/registry')).status).toBe(403);

		const res = await request
			.get('/extensions/registry')
			.query('search=seo&limit=2&offset=4&sort=popular&filter[type][_eq]=display')
			.set('Authorization', admin());

		expect(res.status).toBe(200);
		expect(res.body).toEqual({ meta: { filter_count: 0 }, data: [] });
		expect(list).toHaveBeenCalledWith(
			{ search: 'seo', limit: 2, offset: 4, sort: 'popular', type: 'display', sandbox: true },
			{ registry: 'http://registry:9100' },
		);

		await request.get('/extensions/registry?filter[by][_eq]=me').set('Authorization', admin());
		expect(list).toHaveBeenLastCalledWith({ by: 'me', sandbox: true }, { registry: 'http://registry:9100' });

		// Two filter keys become { _and: [...] } in parseFilter, so neither is read (as in Directus).
		await request
			.get('/extensions/registry?filter[by][_eq]=me&filter[type][_eq]=display')
			.set('Authorization', admin());
		expect(list).toHaveBeenLastCalledWith({ sandbox: true }, { registry: 'http://registry:9100' });
	});

	test('a type that is not an extension type → 403; an unknown sort is dropped; MARKETPLACE_TRUST all', async () => {
		vi.mocked(list).mockResolvedValue({ meta: { filter_count: 0 }, data: [] });
		const request = await agent({ MARKETPLACE_TRUST: 'all' });

		const wrong = await request.get('/extensions/registry?filter[type][_eq]=widget').set('Authorization', admin());
		expect(wrong.status).toBe(403);

		await request.get('/extensions/registry?sort=-name').set('Authorization', admin());
		expect(list).toHaveBeenLastCalledWith({}, {});
	});

	test('registry errors → 503 SERVICE_UNAVAILABLE (handleRegistryError)', async () => {
		const timeout = Object.assign(new Error('x'), { name: 'TimeoutError' });
		vi.mocked(list).mockRejectedValueOnce(timeout);
		const request = await agent();

		const res = await request.get('/extensions/registry').set('Authorization', admin());

		expect(res.status).toBe(503);
		expect(res.body.errors[0].extensions).toEqual({
			code: 'SERVICE_UNAVAILABLE',
			service: 'marketplace',
			reason: 'The registry server is not responding',
		});
	});
});

test('GET /extensions/registry/account|extension/:pk: uuid only (404), admin only, payload of the registry', async () => {
	vi.mocked(account).mockResolvedValue({ data: { id: UUID } } as any);
	vi.mocked(describeExtension).mockResolvedValue({ data: { id: UUID } } as any);
	const request = await agent();

	for (const [path, fn] of [
		['account', account],
		['extension', describeExtension],
	] as const) {
		expect((await request.get(`/extensions/registry/${path}/x`).set('Authorization', admin())).status).toBe(404);
		expect((await request.get(`/extensions/registry/${path}/${UUID}`).set('Authorization', token(USER))).status).toBe(
			403,
		);

		const res = await request.get(`/extensions/registry/${path}/${UUID.toUpperCase()}`).set('Authorization', admin());
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ data: { id: UUID } });
		expect(fn).toHaveBeenCalledWith(UUID.toUpperCase(), {});
	}
});

test('install, reinstall, uninstall: the checks of Directus, then ExtensionsService (D-37 lifted by spec 020)', async () => {
	const request = await agent();

	const user = await request
		.post('/extensions/registry/install')
		.set('Authorization', token(USER))
		.send({ extension: UUID, version: UUID });
	expect(user.status).toBe(403);

	const missing = await request
		.post('/extensions/registry/install')
		.set('Authorization', admin())
		.send({ extension: UUID });
	expect(missing.status).toBe(403);
	expect(install).not.toHaveBeenCalled();

	const installed = await request
		.post('/extensions/registry/install')
		.set('Authorization', admin())
		.send({ extension: UUID, version: UUID });
	expect(installed.status).toBe(204);
	expect(install).toHaveBeenCalledWith(UUID, UUID);

	expect((await request.post('/extensions/registry/reinstall').set('Authorization', admin()).send({})).status).toBe(
		403,
	);
	const reinstalled = await request
		.post('/extensions/registry/reinstall')
		.set('Authorization', admin())
		.send({ extension: UUID });
	expect(reinstalled.status).toBe(204);
	expect(reinstall).toHaveBeenCalledWith(UUID);

	expect((await request.delete('/extensions/registry/uninstall/x').set('Authorization', admin())).status).toBe(404);
	const uninstalled = await request.delete(`/extensions/registry/uninstall/${UUID}`).set('Authorization', admin());
	expect(uninstalled.status).toBe(204);
	expect(uninstall).toHaveBeenCalledWith(UUID);
});

test('PATCH, DELETE /extensions/:pk: uuid only (404), admin only (403)', async () => {
	const request = await agent();

	expect((await request.patch('/extensions/x').set('Authorization', admin()).send({})).status).toBe(404);
	expect((await request.delete('/extensions/x').set('Authorization', admin())).status).toBe(404);

	const patch = await request
		.patch(`/extensions/${UUID}`)
		.set('Authorization', token(USER))
		.send({ meta: { enabled: false } });
	expect(patch.status).toBe(403);
	expect(patch.body.errors[0].extensions.code).toBe('FORBIDDEN');
	expect((await request.delete(`/extensions/${UUID}`).set('Authorization', token(USER))).status).toBe(403);
	expect(updateOne).not.toHaveBeenCalled();
	expect(deleteOne).not.toHaveBeenCalled();
});

test('PATCH /extensions/:pk: { data } of updateOne; a Forbidden read error is a 204; other errors pass', async () => {
	const request = await agent();
	const { ExtensionReadError } = await vi.importActual<typeof import('../services/extensions.service.js')>(
		'../services/extensions.service.js',
	);
	const { ForbiddenError, InvalidPayloadError } = await import('@backoffice/errors');

	updateOne.mockResolvedValueOnce({ id: UUID, meta: { enabled: false } });
	const ok = await request
		.patch(`/extensions/${UUID}`)
		.set('Authorization', admin())
		.send({ meta: { enabled: false } });
	expect(ok.status).toBe(200);
	expect(ok.body).toEqual({ data: { id: UUID, meta: { enabled: false } } });
	expect(updateOne).toHaveBeenCalledWith(UUID, { meta: { enabled: false } });

	updateOne.mockRejectedValueOnce(new ExtensionReadError(new ForbiddenError()));
	expect((await request.patch(`/extensions/${UUID}`).set('Authorization', admin()).send({ meta: {} })).status).toBe(
		204,
	);

	updateOne.mockRejectedValueOnce(new ExtensionReadError(new InvalidPayloadError({ reason: 'x' })));
	expect((await request.patch(`/extensions/${UUID}`).set('Authorization', admin()).send({ meta: {} })).status).toBe(
		400,
	);
});

test('DELETE /extensions/:pk: deleteOne, 204', async () => {
	const request = await agent();

	expect((await request.delete(`/extensions/${UUID}`).set('Authorization', admin())).status).toBe(204);
	expect(deleteOne).toHaveBeenCalledWith(UUID);
});

describe('GET /extensions/sources/:chunk', () => {
	test('index.js: the bundle the extension manager built (no extension here), streamed, no auth needed', async () => {
		const request = await agent();

		const res = await request
			.get('/extensions/sources/index.js')
			.buffer(true)
			.parse((r, cb) => {
				let text = '';
				r.on('data', (chunk: Buffer) => (text += chunk.toString()));
				r.on('end', () => cb(null, text));
			});

		expect(res.status).toBe(200);
		expect(res.body).toContain('export { displays, interfaces, layouts, modules, operations, panels, themes }');
		expect(res.headers['content-type']).toBe('application/javascript; charset=UTF-8');
		expect(res.headers['cache-control']).toBe('no-cache');
		expect(res.headers['vary']).toBe('Origin, Cache-Control');
		expect(res.headers['transfer-encoding']).toBe('chunked');
		expect(res.headers['content-length']).toBeUndefined();
	});

	test('a chunk of no build → 404 ROUTE_NOT_FOUND; SERVE_APP off still serves the bundle (D-137)', async () => {
		let request = await agent();
		const res = await request.get('/extensions/sources/chunk-1.js');
		expect(res.status).toBe(404);
		expect(res.body.errors[0].extensions).toEqual({ code: 'ROUTE_NOT_FOUND', path: '/sources/chunk-1.js' });
		expect((await request.get('/extensions/sources/..%2Fpackage.json')).status).toBe(404);
		await app.nest.close();

		request = await agent({ SERVE_APP: false });
		expect((await request.get('/extensions/sources/index.js')).status).toBe(200);
	});
});
