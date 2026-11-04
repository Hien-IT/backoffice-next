// Backoffice (spec 031, D-212, contracts/api.md): GET/POST /backoffice/extensions/upload through the real app pipeline on
// SQLite, with ExtensionsService mocked (installUpload reads the whole file stream, like the real one, and answers its
// size). Covers admin only, the multipart checks, the FILES_MAX_UPLOAD_SIZE cut as a 413 and the cache flag. Parity
// with DR (404) is tests/parity/src/extensions/upload.test.ts.
import * as env from '@backoffice/env';
import { InvalidPayloadError } from '@backoffice/errors';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import type { Readable } from 'node:stream';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ADMIN, createDataModelDb, SECRET, startApp, token, USER } from '../../test/data-model-app.js';
import type { App } from '../app.js';
import { clearSystemCache } from '../cache.js';
import { maxUploadSize } from './backoffice-extensions.controller.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));
const { installUpload } = vi.hoisted(() => ({ installUpload: vi.fn() }));

vi.mock('../services/extensions.service.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../services/extensions.service.js')>()),
	ExtensionsService: vi.fn(function (this: unknown, options: unknown) {
		return { installUpload, options };
	}),
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

/** Reads the whole stream (as installFromStream writes it to the temp folder) and answers its size. */
async function consume(stream: Readable) {
	let size = 0;
	for await (const chunk of stream) size += (chunk as Buffer).length;
	return { id: 'u', bundle: null, meta: { source: 'upload', size }, schema: null };
}

beforeEach(async () => {
	state.db = await createDataModelDb();
	vi.clearAllMocks();
	installUpload.mockImplementation(consume);
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

test('GET: the upload size limit for an admin, null when FILES_MAX_UPLOAD_SIZE is unset; 403 user, 401 anonymous', async () => {
	const request = await agent({ FILES_MAX_UPLOAD_SIZE: undefined });

	expect((await request.get('/backoffice/extensions/upload').set('Authorization', admin())).body).toEqual({
		data: { max_upload_size: null },
	});
	expect((await request.get('/backoffice/extensions/upload').set('Authorization', token(USER))).status).toBe(403);
	expect((await request.get('/backoffice/extensions/upload')).status).toBe(401);

	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET, FILES_MAX_UPLOAD_SIZE: '10mb' });
	expect(maxUploadSize()).toBe(10 * 1024 * 1024);
});

test('POST: the file part goes to installUpload as a stream; 200 { data } with the row', async () => {
	const request = await agent({ FILES_MAX_UPLOAD_SIZE: undefined });
	const file = Buffer.alloc(5000, 1);

	const res = await request
		.post('/backoffice/extensions/upload')
		.set('Authorization', admin())
		.field('note', 'ignored')
		.attach('file', file, 'my-extension-1.0.0.tgz');

	expect(res.status).toBe(200);
	expect(res.body).toEqual({ data: { id: 'u', bundle: null, meta: { source: 'upload', size: 5000 }, schema: null } });
	expect(installUpload).toHaveBeenCalledTimes(1);
});

test('POST: not multipart → 400; multipart without a file → 400; a user → 403 before the body is read', async () => {
	const request = await agent();

	const json = await request.post('/backoffice/extensions/upload').set('Authorization', admin()).send({ a: 1 });
	expect(json.status).toBe(400);
	expect(json.body.errors[0].extensions).toEqual({ code: 'INVALID_PAYLOAD', reason: 'Request must be multipart/form-data' });

	const empty = await request.post('/backoffice/extensions/upload').set('Authorization', admin()).field('a', '1');
	expect(empty.status).toBe(400);
	expect(empty.body.errors[0].extensions.reason).toBe('No file was uploaded');

	const user = await request
		.post('/backoffice/extensions/upload')
		.set('Authorization', token(USER))
		.attach('file', Buffer.from('x'), 'x.tgz');
	expect(user.status).toBe(403);
	expect(installUpload).not.toHaveBeenCalled();
});

test('POST: a file over FILES_MAX_UPLOAD_SIZE is a 413, the stream is cut with that error', async () => {
	const request = await agent({ FILES_MAX_UPLOAD_SIZE: '1kb' });

	const res = await request
		.post('/backoffice/extensions/upload')
		.set('Authorization', admin())
		.attach('file', Buffer.alloc(4096, 1), 'big.tgz');

	expect(res.status).toBe(413);
	expect(res.body.errors[0].extensions.code).toBe('CONTENT_TOO_LARGE');
});

test('POST: an error of the service keeps its status and reason', async () => {
	const request = await agent();
	installUpload.mockImplementation(async (stream: Readable) => {
		await consume(stream);
		throw new InvalidPayloadError({ reason: 'An extension named "x" is already installed (local)' });
	});

	const res = await request
		.post('/backoffice/extensions/upload')
		.set('Authorization', admin())
		.attach('file', Buffer.from('x'), 'x.tgz');

	expect(res.status).toBe(400);
	expect(res.body.errors[0].extensions.reason).toBe('An extension named "x" is already installed (local)');
});
