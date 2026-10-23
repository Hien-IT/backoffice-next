// Feature 010 (T035): the /utils controller (port of directus/api/src/controllers/utils.ts, which DR does not unit
// test) through the real app pipeline on SQLite, with the utils, revisions, import and export services mocked.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ADMIN, createDataModelDb, SECRET, startApp, token } from '../../test/data-model-app.js';
import type { App } from '../app.js';
import { clearSystemCache } from '../cache.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

const service = vi.hoisted(() => ({
	sort: vi.fn(),
	clearCache: vi.fn(),
	revert: vi.fn(),
	import: vi.fn(),
	exportToFile: vi.fn(),
}));

const mockService = vi.hoisted(() => (name: string) => ({
	[name]: vi.fn(function (this: unknown, options: unknown) {
		return Object.assign(Object.create(service), { options });
	}),
}));

vi.mock('../services/utils.service.js', () => mockService('UtilsService'));
vi.mock('../services/revisions.service.js', () => mockService('RevisionsService'));
vi.mock('../services/import-export.service.js', () => ({
	...mockService('ImportService'),
	...mockService('ExportService'),
}));
vi.mock('../utils/generate-translations.js', () => ({ generateTranslations: vi.fn(async () => ({ created: true })) }));

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
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

test('GET /utils/random/string: 32 characters by default, the asked length, 400 outside 1 to 500', async () => {
	const request = await agent();

	expect((await request.get('/utils/random/string')).body.data).toMatch(/^[\w-]{32}$/);
	expect((await request.get('/utils/random/string?length=7&other=1')).body.data).toMatch(/^[\w-]{7}$/);

	for (const length of ['0', '501', 'abc', '1.5']) {
		const res = await request.get(`/utils/random/string?length=${length}`);
		expect(res.status, length).toBe(400);
		expect(res.body.errors[0].extensions.code).toBe('INVALID_QUERY');
	}
});

test('POST /utils/hash/generate and /verify: argon2, required fields, a broken hash', async () => {
	const request = await agent();

	expect((await request.post('/utils/hash/generate').send({})).body.errors[0].message).toBe(
		'Invalid payload. "string" is required.',
	);

	const hash = (await request.post('/utils/hash/generate').send({ string: 'secret' })).body.data;
	expect(hash).toMatch(/^\$argon2/);

	expect((await request.post('/utils/hash/verify').send({ string: 'secret', hash })).body).toEqual({ data: true });
	expect((await request.post('/utils/hash/verify').send({ string: 'other', hash })).body).toEqual({ data: false });
	expect((await request.post('/utils/hash/verify').send({ string: 'x' })).body.errors[0].message).toBe(
		'Invalid payload. "hash" is required.',
	);
	expect((await request.post('/utils/hash/verify').send({ string: 'x', hash: 'broken' })).body.errors[0].message).toBe(
		'Invalid payload. Invalid "hash" or "string".',
	);
});

test('POST /utils/sort/:collection: collectionExists, joi, sort; 200 without a body', async () => {
	const request = await agent();

	expect((await request.post('/utils/sort/nope').set('Authorization', admin()).send({ item: 1, to: 2 })).status).toBe(
		403,
	);
	expect(
		(await request.post('/utils/sort/directus_users').set('Authorization', admin()).send({ item: 1 })).status,
	).toBe(400);

	const res = await request.post('/utils/sort/directus_users').set('Authorization', admin()).send({ item: 1, to: '2' });
	expect(res.status).toBe(200);
	expect(res.text).toBe('');
	expect(service.sort).toHaveBeenCalledWith('directus_users', { item: 1, to: '2' });
});

test('POST /utils/revert/:revision → revert, 204', async () => {
	const request = await agent();

	expect((await request.post('/utils/revert/12').set('Authorization', admin())).status).toBe(204);
	expect(service.revert).toHaveBeenCalledWith('12');
});

test('POST /utils/import/:collection: 403 unknown collection before 415 not multipart; the file goes to import', async () => {
	const request = await agent();

	expect((await request.post('/utils/import/nope').set('Authorization', admin()).send({})).status).toBe(403);

	const json = await request.post('/utils/import/directus_users').set('Authorization', admin()).send({ a: 1 });
	expect(json.status).toBe(415);
	expect(json.body.errors[0].extensions.code).toBe('UNSUPPORTED_MEDIA_TYPE');

	service.import.mockImplementation(async (_c: string, _m: string, stream: NodeJS.ReadableStream) => {
		for await (const _chunk of stream);
	});

	const ok = await request
		.post('/utils/import/directus_users?background=true')
		.set('Authorization', admin())
		.attach('file', Buffer.from('[]'), { filename: 'a.json', contentType: 'application/json' });
	expect(ok.status).toBe(200);
	expect(service.import).toHaveBeenCalledWith('directus_users', 'application/json', expect.anything(), {
		background: true,
	});

	service.import.mockRejectedValueOnce(new Error('boom'));
	const failed = await request
		.post('/utils/import/directus_users')
		.set('Authorization', admin())
		.attach('file', Buffer.from('a'), { filename: 'a.csv', contentType: 'text/csv' });
	expect(failed.status).toBe(500);
});

test('POST /utils/export/:collection: query and format required, exportToFile not awaited, 204', async () => {
	service.exportToFile.mockReturnValue(new Promise(() => undefined));
	const request = await agent();

	expect(
		(await request.post('/utils/export/directus_users').set('Authorization', admin()).send({ format: 'csv' })).body
			.errors[0].message,
	).toBe('Invalid payload. "query" is required.');
	expect(
		(await request.post('/utils/export/directus_users').set('Authorization', admin()).send({ query: {} })).body
			.errors[0].message,
	).toBe('Invalid payload. "format" is required.');

	const res = await request
		.post('/utils/export/directus_users')
		.set('Authorization', admin())
		.send({ query: { limit: 2 }, format: 'json', file: { title: 't' } });
	expect(res.status).toBe(204);
	expect(service.exportToFile).toHaveBeenCalledWith('directus_users', expect.objectContaining({ limit: 2 }), 'json', {
		file: { title: 't' },
	});
});

test('POST /utils/translations/generate: admin only, the result through respond', async () => {
	const request = await agent();

	expect((await request.post('/utils/translations/generate').send({})).status).toBe(403);
	expect((await request.post('/utils/translations/generate').set('Authorization', admin()).send({})).body).toEqual({
		data: { created: true },
	});
});

test('POST /utils/cache/clear: system when the key is in the query (even false); 200 without a body', async () => {
	const request = await agent();

	for (const [query, system] of [
		['', false],
		['?system', true],
		['?system=true', true],
		['?system=false', true],
	] as const) {
		service.clearCache.mockClear();
		const res = await request.post(`/utils/cache/clear${query}`).set('Authorization', admin());
		expect(res.status).toBe(200);
		expect(service.clearCache).toHaveBeenCalledWith({ system });
	}
});

test('POST /utils/resolve-redirect: required redirect, string provider, invalid redirect', async () => {
	const request = await agent();

	expect((await request.post('/utils/resolve-redirect').send({})).body.errors[0].message).toBe(
		'Invalid payload. "redirect" is required.',
	);
	expect(
		(await request.post('/utils/resolve-redirect').send({ redirect: '/admin', provider: 1 })).body.errors[0].message,
	).toBe('Invalid payload. "provider" must be a string.');
	expect((await request.post('/utils/resolve-redirect').send({ redirect: 'https://evil.example.com' })).status).toBe(
		400,
	);
});

test.each([
	['/utils/random/string', 'GET,HEAD'],
	['/utils/hash/verify', 'POST'],
	['/utils/sort/x', 'POST'],
	['/utils/cache/clear', 'POST'],
])('OPTIONS %s → %s', async (path, allow) => {
	const request = await agent();
	expect((await request.options(path)).headers['allow']).toBe(allow);
});
