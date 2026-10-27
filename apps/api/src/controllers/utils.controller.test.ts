// Feature 010 (T035): the /utils controller (port of directus/api/src/controllers/utils.ts, which DR does not unit
// test) through the real app pipeline on SQLite, with the utils, revisions, import and export services mocked.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ADMIN, createDataModelDb, SECRET, startApp, token } from '../../test/data-model-app.js';
import type { App } from '../app.js';
import { clearSystemCache } from '../cache.js';
import { assertExport } from '../permissions/modules/backoffice-permissions/assert-backoffice-action.js';
import { assertImport } from '../permissions/modules/backoffice-permissions/import-access.js';
import { createCollectionForbiddenError } from '../permissions/modules/process-ast/utils/validate-path/create-error.js';

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
// Spec 025: the import and export permissions (their logic is tested in permissions/modules/backoffice-permissions).
vi.mock('../permissions/modules/backoffice-permissions/import-access.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../permissions/modules/backoffice-permissions/import-access.js')>()),
	assertImport: vi.fn(async () => null),
}));
vi.mock('../permissions/modules/backoffice-permissions/assert-backoffice-action.js', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../permissions/modules/backoffice-permissions/assert-backoffice-action.js')
	>()),
	assertExport: vi.fn(async ({ query }: { query: unknown }) => query),
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

// Backoffice (spec 024, D-188.1, D-188.2): the bo_show_* columns of the Backoffice migration 20261026A (spec 022),
// which createDataModelDb leaves out, set on articles.
async function toggles(values: Record<string, boolean | null>) {
	await state.db.schema.alterTable('directus_collections', (t) => {
		for (const column of ['bo_show_search', 'bo_show_import', 'bo_show_export']) t.boolean(column).defaultTo(true);
	});

	await state.db('directus_collections').where({ collection: 'articles' }).update(values);
	await clearSystemCache();
}

const forbiddenArticles = `You don't have permission to access collection "articles" or it does not exist. Queried in root.`;

test('POST /utils/import/:collection with import off: the collection error before reading the file (FR-005)', async () => {
	await toggles({ bo_show_import: false });
	const request = await agent();

	const res = await request
		.post('/utils/import/articles')
		.set('Authorization', admin())
		.attach('file', Buffer.from('[]'), { filename: 'a.json', contentType: 'application/json' });

	expect(res.status).toBe(403);
	expect(res.body.errors[0]).toMatchObject({ message: forbiddenArticles, extensions: { code: 'FORBIDDEN' } });
	expect(service.import).not.toHaveBeenCalled();

	// Not multipart: the toggle answers first, like collectionExists before the 415.
	expect((await request.post('/utils/import/articles').set('Authorization', admin()).send({})).status).toBe(403);
});

test('POST /utils/export/:collection: export off, or a search of the body query with search off (FR-004, FR-017)', async () => {
	service.exportToFile.mockReturnValue(new Promise(() => undefined));
	await toggles({ bo_show_export: false });
	let request = await agent();

	const off = await request.post('/utils/export/articles').set('Authorization', admin()).send({ format: 'csv' });
	expect(off.status).toBe(403);
	expect(off.body.errors[0].message).toBe(forbiddenArticles);

	await app.nest.close();
	await state
		.db('directus_collections')
		.where({ collection: 'articles' })
		.update({ bo_show_export: true, bo_show_search: false });
	await clearSystemCache();
	request = await agent();

	const search = await request
		.post('/utils/export/articles')
		.set('Authorization', admin())
		.send({ query: { search: 'a' }, format: 'csv' });
	expect(search.status).toBe(403);

	const plain = await request
		.post('/utils/export/articles')
		.set('Authorization', admin())
		.send({ query: {}, format: 'csv' });
	expect(plain.status).toBe(204);
	expect(service.exportToFile).toHaveBeenCalledOnce();
});

test('POST /utils/import and /utils/export with the toggles on or null: as before (FR-008)', async () => {
	service.exportToFile.mockReturnValue(new Promise(() => undefined));
	service.import.mockImplementation(async (_c: string, _m: string, stream: NodeJS.ReadableStream) => {
		for await (const _chunk of stream);
	});
	await toggles({ bo_show_import: null, bo_show_export: true });
	const request = await agent();

	const imported = await request
		.post('/utils/import/articles')
		.set('Authorization', admin())
		.attach('file', Buffer.from('[]'), { filename: 'a.json', contentType: 'application/json' });
	expect(imported.status).toBe(200);

	const exported = await request
		.post('/utils/export/articles')
		.set('Authorization', admin())
		.send({ query: {}, format: 'csv' });
	expect(exported.status).toBe(204);
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

// Spec 025 (FR-006, FR-007, FR-016, D-189.1): the import and export permissions of the caller's policies.
test('POST /utils/import: the import permission after the 415 and before the file; its format and row guard', async () => {
	vi.mocked(assertImport).mockClear();
	service.import.mockImplementation(async (_c: string, _m: string, stream: NodeJS.ReadableStream) => {
		for await (const _chunk of stream);
	});
	const request = await agent();
	const json = { filename: 'a.json', contentType: 'application/json' };

	expect((await request.post('/utils/import/articles').set('Authorization', admin()).send({})).status).toBe(415);
	expect(assertImport).not.toHaveBeenCalled();

	vi.mocked(assertImport).mockRejectedValueOnce(createCollectionForbiddenError('', 'articles'));
	const refused = await request
		.post('/utils/import/articles')
		.set('Authorization', admin())
		.attach('file', Buffer.from('[]'), json);
	expect(refused.status).toBe(403);
	expect(refused.body.errors[0].message).toBe(forbiddenArticles);
	expect(service.import).not.toHaveBeenCalled();
	expect(vi.mocked(assertImport).mock.calls[0]![1]).toBe('articles');

	const limited = { allowed: true, filter: { title: { _eq: 'a' } }, fields: ['*'], formats: ['csv'] };
	vi.mocked(assertImport).mockResolvedValue(limited);

	const wrongFormat = await request
		.post('/utils/import/articles')
		.set('Authorization', admin())
		.attach('file', Buffer.from('[]'), json);
	expect(wrongFormat.status).toBe(403);
	expect(service.import).not.toHaveBeenCalled();

	const csv = await request
		.post('/utils/import/articles')
		.set('Authorization', admin())
		.attach('file', Buffer.from('title\na'), { filename: 'a.csv', contentType: 'text/csv' });
	expect(csv.status).toBe(200);
	expect(service.import.mock.calls[0]![3]).toMatchObject({ rowGuard: expect.any(Function) });
});

test('POST /utils/export: the export permission after the 400s and the toggles, with the body query and format', async () => {
	vi.mocked(assertExport).mockClear();
	service.exportToFile.mockReturnValue(new Promise(() => undefined));
	const request = await agent();

	expect(
		(await request.post('/utils/export/articles').set('Authorization', admin()).send({ format: 'csv' })).status,
	).toBe(400);
	expect(assertExport).not.toHaveBeenCalled();

	vi.mocked(assertExport).mockRejectedValueOnce(createCollectionForbiddenError('', 'articles'));
	const refused = await request
		.post('/utils/export/articles')
		.set('Authorization', admin())
		.send({ query: {}, format: 'json' });
	expect(refused.status).toBe(403);
	expect(service.exportToFile).not.toHaveBeenCalled();
	expect(vi.mocked(assertExport).mock.calls[0]![0]).toMatchObject({
		collection: 'articles',
		format: 'json',
		query: {},
	});
});
