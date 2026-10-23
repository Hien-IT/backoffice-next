// Feature 007 (T023): the /files controller (port of directus/api/src/controllers/files.ts, unit tested by DR only
// for the multipart handler) through the real app pipeline on SQLite, with FilesService mocked: multipartHandler
// (fields before files, payload reset, coercion, limits, errors), JSON create, import, read, batch update and delete.
import { Readable } from 'node:stream';
import * as env from '@backoffice/env';
import { ContentTooLargeError, ForbiddenError } from '@backoffice/errors';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ADMIN, createDataModelDb, SECRET, startApp, token } from '../../test/data-model-app.js';
import type { App } from '../app.js';
import { clearSystemCache } from '../cache.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

const service = vi.hoisted(() => ({
	uploadOne: vi.fn(),
	createOne: vi.fn(),
	importOne: vi.fn(),
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

vi.mock('../services/files.service.js', () => ({
	FilesService: vi.fn(function (this: unknown, options: unknown) {
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

async function agent(overrides: Record<string, unknown> = {}) {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET, ...overrides });
	const started = await startApp();
	app = started.app;
	return started.agent;
}

/** Reads the uploaded stream like FilesService.uploadOne, and fails like it when busboy truncated the file. */
async function consume(stream: Readable & { truncated?: boolean }): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(chunk);
	if (stream.truncated) throw new ContentTooLargeError();
	return Buffer.concat(chunks).toString();
}

const uploads: { content: string; payload: Record<string, unknown>; pk: unknown }[] = [];

beforeEach(async () => {
	state.db = await createDataModelDb();
	for (const fn of Object.values(service)) fn.mockReset();
	uploads.length = 0;

	let next = 0;

	service.uploadOne.mockImplementation(async (stream: Readable, payload: Record<string, unknown>, pk: unknown) => {
		uploads.push({ content: await consume(stream), payload, pk });
		return pk ?? `file-${++next}`;
	});

	service.readOne.mockImplementation(async (key: string) => ({ id: key }));
	service.readMany.mockImplementation(async (keys: string[]) => keys.map((id) => ({ id })));
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

describe('POST /files multipart', () => {
	test('fields before the file make its payload; the title comes from the file name', async () => {
		const res = await (await agent())
			.post('/files')
			.set('Authorization', admin())
			.field('storage', 's3')
			.field('folder', 'null')
			.field('description', 'true')
			.attach('file', Buffer.from('hello'), { filename: 'my-photo.final.jpg', contentType: 'image/jpeg' });

		expect(res.status).toBe(200);
		expect(res.body).toEqual({ data: { id: 'file-1' } });

		expect(uploads).toEqual([
			{
				content: 'hello',
				pk: undefined,
				payload: {
					storage: 's3',
					folder: null,
					description: true,
					title: 'My Photo.final',
					filename_download: 'my-photo.final.jpg',
					type: 'image/jpeg',
				},
			},
		]);
	});

	test('several files: each takes the fields since the previous one, the response is an array', async () => {
		const res = await (await agent())
			.post('/files')
			.set('Authorization', admin())
			.field('title', 'First')
			.attach('a', Buffer.from('1'), { filename: 'a.txt', contentType: 'text/plain' })
			.field('storage', 'local')
			.attach('b', Buffer.from('2'), { filename: 'b.txt', contentType: 'text/plain' });

		expect(res.status).toBe(200);
		expect(res.body).toEqual({ data: [{ id: 'file-1' }, { id: 'file-2' }] });
		expect(uploads.map((u) => u.payload)).toEqual([
			{ title: 'First', filename_download: 'a.txt', type: 'text/plain' },
			{ storage: 'local', title: 'B', filename_download: 'b.txt', type: 'text/plain' },
		]);
		expect(service.readMany).toHaveBeenCalledWith(['file-1', 'file-2'], expect.anything());
	});

	test('no file in the body', async () => {
		const res = await (await agent()).post('/files').set('Authorization', admin()).field('title', 'x');

		expect(res.status).toBe(400);
		expect(res.body.errors[0]).toMatchObject({ message: 'Invalid payload. No files were included in the body.' });
	});

	test('a file part without a file name', async () => {
		// busboy reads a part without filename as a file only when its type is application/octet-stream.
		const boundary = 'parity-boundary';
		const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"\r\nContent-Type: application/octet-stream\r\n\r\nx\r\n--${boundary}--\r\n`;

		const res = await (await agent())
			.post('/files')
			.set('Authorization', admin())
			.set('Content-Type', `multipart/form-data; boundary=${boundary}`)
			.send(body);

		expect(res.status).toBe(400);
		expect(res.body.errors[0].message).toBe('Invalid payload. File is missing filename.');
		expect(service.uploadOne).not.toHaveBeenCalled();
	});

	test('FILES_MIME_TYPE_ALLOW_LIST rejects other types', async () => {
		const res = await (await agent({ FILES_MIME_TYPE_ALLOW_LIST: 'image/*,application/pdf' }))
			.post('/files')
			.set('Authorization', admin())
			.attach('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });

		expect(res.status).toBe(400);
		expect(res.body.errors[0].message).toBe('Invalid payload. File is of invalid content type.');
	});

	test('FILES_MAX_UPLOAD_SIZE limits busboy: 413 from the truncated stream', async () => {
		const res = await (await agent({ FILES_MAX_UPLOAD_SIZE: '4' }))
			.post('/files')
			.set('Authorization', admin())
			.attach('file', Buffer.from('more than four bytes'), { filename: 'a.txt', contentType: 'text/plain' });

		expect(res.status).toBe(413);
		expect(res.body.errors[0].extensions.code).toBe('CONTENT_TOO_LARGE');
	});

	test('a Forbidden read after the upload answers 204 without body', async () => {
		service.readOne.mockRejectedValue(new ForbiddenError());

		const res = await (await agent())
			.post('/files')
			.set('Authorization', admin())
			.attach('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });

		expect(res.status).toBe(204);
		expect(res.text).toBe('');
	});
});

test('POST /files JSON creates the row with createOne', async () => {
	service.createOne.mockResolvedValue('json-1');

	const res = await (await agent())
		.post('/files')
		.set('Authorization', admin())
		.send({ type: 'image/png', storage: 'local', filename_download: 'a.png' });

	expect(res.status).toBe(200);
	expect(res.body).toEqual({ data: { id: 'json-1' } });
	expect(service.createOne).toHaveBeenCalledWith({ type: 'image/png', storage: 'local', filename_download: 'a.png' });
	expect(service.uploadOne).not.toHaveBeenCalled();
});

describe('POST /files/import', () => {
	test('validates the body with Joi', async () => {
		const res = await (await agent()).post('/files/import').set('Authorization', admin()).send({ data: {} });

		expect(res.status).toBe(400);
		expect(res.body.errors[0].message).toBe('Invalid payload. "url" is required.');
	});

	test('imports and reads the new file', async () => {
		service.importOne.mockResolvedValue('imported-1');

		const body = {
			url: 'http://files-fixtures/photo.jpg',
			data: { title: 'T' },
			options: { filterMimeType: ['image/*'] },
		};
		const res = await (await agent()).post('/files/import').set('Authorization', admin()).send(body);

		expect(res.status).toBe(200);
		expect(res.body).toEqual({ data: { id: 'imported-1' } });
		expect(service.importOne).toHaveBeenCalledWith(body.url, body.data, body.options);
	});

	test('a Forbidden read after the import answers 204', async () => {
		service.importOne.mockResolvedValue('imported-1');
		service.readOne.mockRejectedValue(new ForbiddenError());

		const res = await (await agent()).post('/files/import').set('Authorization', admin()).send({ url: 'http://x/a' });

		expect(res.status).toBe(204);
	});
});

describe('read', () => {
	test('GET /files reads by query with meta', async () => {
		service.readByQuery.mockResolvedValue([{ id: 'a' }]);

		const res = await (await agent()).get('/files?limit=1').set('Authorization', admin());

		expect(res.status).toBe(200);
		expect(res.body.data).toEqual([{ id: 'a' }]);
		expect(service.readByQuery).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
	});

	test('SEARCH /files with keys reads many', async () => {
		const res = await (
			await agent()
		)
			.search('/files')
			.set('Authorization', admin())
			.send({ keys: ['a', 'b'] });

		expect(res.status).toBe(200);
		expect(service.readMany).toHaveBeenCalledWith(['a', 'b'], expect.anything());
	});

	test('GET /files/:pk reads one', async () => {
		const res = await (await agent()).get('/files/abc').set('Authorization', admin());

		expect(res.body).toEqual({ data: { id: 'abc' } });
	});
});

describe('update', () => {
	test('PATCH /files with an array, keys or a query', async () => {
		service.updateBatch.mockResolvedValue(['a']);
		service.updateMany.mockResolvedValue(['b']);
		service.updateByQuery.mockResolvedValue(['c']);
		const request = await agent();

		await request
			.patch('/files')
			.set('Authorization', admin())
			.send([{ id: 'a', title: 'x' }]);
		expect(service.updateBatch).toHaveBeenCalledWith([{ id: 'a', title: 'x' }]);

		await request
			.patch('/files')
			.set('Authorization', admin())
			.send({ keys: ['b'], data: { title: 'y' } });
		expect(service.updateMany).toHaveBeenCalledWith(['b'], { title: 'y' });

		const res = await request
			.patch('/files')
			.set('Authorization', admin())
			.send({ query: { filter: { title: { _eq: 'z' } } }, data: { title: 'z2' } });
		expect(service.updateByQuery).toHaveBeenCalledWith(expect.objectContaining({ filter: expect.anything() }), {
			title: 'z2',
		});
		expect(res.body).toEqual({ data: [{ id: 'c' }] });
	});

	test('PATCH /files without keys, query or array fails validateBatch', async () => {
		const res = await (await agent()).patch('/files').set('Authorization', admin()).send({ data: {} });

		expect(res.status).toBe(400);
	});

	test('PATCH /files/:pk multipart replaces the file, then updates with the empty body like Directus', async () => {
		const res = await (await agent())
			.patch('/files/abc')
			.set('Authorization', admin())
			.attach('file', Buffer.from('new'), { filename: 'new.png', contentType: 'image/png' });

		expect(res.status).toBe(200);
		expect(uploads).toEqual([
			{ content: 'new', pk: 'abc', payload: { filename_download: 'new.png', type: 'image/png' } },
		]);
		expect(service.updateOne).toHaveBeenCalledWith('abc', {});
	});

	test('PATCH /files/:pk JSON updates the row', async () => {
		await (await agent()).patch('/files/abc').set('Authorization', admin()).send({ title: 'New' });

		expect(service.uploadOne).not.toHaveBeenCalled();
		expect(service.updateOne).toHaveBeenCalledWith('abc', { title: 'New' });
	});
});

describe('delete', () => {
	test('DELETE /files with an array, keys or a query answers 204', async () => {
		const request = await agent();

		expect((await request.delete('/files').set('Authorization', admin()).send(['a'])).status).toBe(204);
		expect(service.deleteMany).toHaveBeenCalledWith(['a']);

		await request
			.delete('/files')
			.set('Authorization', admin())
			.send({ keys: ['b'] });
		expect(service.deleteMany).toHaveBeenCalledWith(['b']);

		await request
			.delete('/files')
			.set('Authorization', admin())
			.send({ query: { filter: { id: { _eq: 'c' } } } });
		expect(service.deleteByQuery).toHaveBeenCalled();
	});

	test('DELETE /files/:pk', async () => {
		const res = await (await agent()).delete('/files/abc').set('Authorization', admin());

		expect(res.status).toBe(204);
		expect(service.deleteOne).toHaveBeenCalledWith('abc');
	});
});
