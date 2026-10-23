// Feature 007 (T024, T037): the /assets controller (port of directus/api/src/controllers/assets.ts, which DR does
// not unit test) through the real app pipeline on SQLite, with AssetsService and FilesService mocked: query validation
// in the three storage_asset_transform modes, the preset merge, headers, ranges, revalidation, HEAD, zip routes.
import { PassThrough, Readable } from 'node:stream';
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ADMIN, createDataModelDb, SECRET, startApp, token } from '../../test/data-model-app.js';
import type { App } from '../app.js';
import { clearSystemCache } from '../cache.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

const assets = vi.hoisted(() => ({ getAsset: vi.fn(), zipFolder: vi.fn(), zipFiles: vi.fn() }));
const files = vi.hoisted(() => ({ readOne: vi.fn() }));

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

vi.mock('../services/assets.service.js', () => ({
	AssetsService: vi.fn(function (this: unknown, options: unknown) {
		return Object.assign(Object.create(assets), { options });
	}),
}));

vi.mock('../services/files.service.js', () => ({
	FilesService: vi.fn(function (this: unknown, options: unknown) {
		return Object.assign(Object.create(files), { options });
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

const ID = '4a5e6f70-1111-4222-8333-944455556666';
const content = Buffer.from('0123456789abcdefghij');

const file = {
	id: ID,
	type: 'image/jpeg',
	filename_download: 'photo.jpg',
	modified_on: '2026-10-12T10:00:00.000Z',
};

async function agent(overrides: Record<string, unknown> = {}) {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET, ...overrides });
	const started = await startApp();
	app = started.app;
	return started.agent;
}

async function settings(transform: string, presets: unknown[] = []) {
	await state.db('directus_settings').insert({
		storage_asset_transform: transform,
		storage_asset_presets: JSON.stringify(presets),
	});
}

beforeEach(async () => {
	state.db = await createDataModelDb();

	await state.db.schema.alterTable('directus_settings', (t) => {
		t.string('storage_asset_transform').defaultTo('all');
		t.json('storage_asset_presets');
	});

	for (const fn of [...Object.values(assets), ...Object.values(files)]) fn.mockReset();

	assets.getAsset.mockImplementation(async (_id: string, _set: unknown, range?: { start?: number; end?: number }) => ({
		stream: async () =>
			Readable.from([range ? content.subarray(range.start ?? 0, (range.end ?? content.length - 1) + 1) : content]),
		file,
		stat: { size: content.length, modified: new Date(file.modified_on) },
	}));
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

describe('GET /assets/:pk without transformation', () => {
	test('streams the file inline with the Directus headers', async () => {
		const res = await (await agent()).get(`/assets/${ID}`).set('Authorization', admin());

		expect(res.status).toBe(200);
		expect(res.body.toString()).toBe(content.toString());
		expect(assets.getAsset).toHaveBeenCalledWith(
			ID,
			{ transformationParams: {}, acceptFormat: undefined },
			undefined,
			true,
		);

		expect(res.headers).toMatchObject({
			'content-type': 'image/jpeg',
			'accept-ranges': 'bytes',
			// getCacheControlHeader: `public` when the accountability has no role (this admin has its policy directly).
			'cache-control': 'public, max-age=2592000',
			vary: 'Origin, Cache-Control',
			'content-disposition': 'inline; filename="photo.jpg"',
			'content-length': String(content.length),
			'last-modified': new Date(file.modified_on).toUTCString(),
			etag: `"${Date.parse(file.modified_on) / 1000}"`,
			'content-security-policy': "default-src 'none'",
		});
	});

	test('?download is an attachment, :filename names it, ASSETS_CACHE_TTL sets max-age', async () => {
		const request = await agent({ ASSETS_CACHE_TTL: '1h' });

		expect((await request.get(`/assets/${ID}`)).headers['cache-control']).toBe('public, max-age=3600');

		const download = await request.get(`/assets/${ID}/other.jpg?download`).set('Authorization', admin());
		expect(download.headers['content-disposition']).toBe('attachment; filename="other.jpg"');

		const named = await request.get(`/assets/${ID}/other.jpg`).set('Authorization', admin());
		expect(named.headers['content-disposition']).toBe('inline; filename="other.jpg"');
	});

	test('the id is the first 36 characters of :pk', async () => {
		await (await agent()).get(`/assets/${ID}.jpg`).set('Authorization', admin());

		expect(assets.getAsset.mock.calls[0]![0]).toBe(ID);
	});

	test('Range: 206 with Content-Range, ignored when there is a transformation', async () => {
		const request = await agent();

		const res = await request.get(`/assets/${ID}`).set('Authorization', admin()).set('Range', 'bytes=2-5');
		expect(res.status).toBe(206);
		expect(res.headers['content-range']).toBe(`bytes 2-5/${content.length}`);
		expect(res.headers['content-length']).toBe('4');
		expect(assets.getAsset.mock.calls[0]![2]).toEqual({ start: 2, end: 5 });

		await request.get(`/assets/${ID}?width=10`).set('Authorization', admin()).set('Range', 'bytes=2-5');
		expect(assets.getAsset.mock.calls[1]![2]).toBeUndefined();
	});

	test('HEAD answers 200 with the headers and no body', async () => {
		const res = await (await agent()).head(`/assets/${ID}`).set('Authorization', admin());

		expect(res.status).toBe(200);
		expect(res.headers['content-length']).toBe(String(content.length));
		expect(res.text).toBeUndefined();
		expect(assets.getAsset).toHaveBeenCalled();
	});

	test('a stream error before the first byte answers 500 JSON', async () => {
		assets.getAsset.mockImplementation(async () => ({
			stream: async () =>
				new Readable({
					read() {
						this.destroy(new Error('storage down'));
					},
				}),
			file,
			stat: { size: 10, modified: new Date() },
		}));

		const res = await (await agent()).get(`/assets/${ID}`).set('Authorization', admin());

		expect(res.status).toBe(500);
		expect(res.body.errors[0].extensions.code).toBe('INTERNAL_SERVER_ERROR');
	});
});

describe('ASSETS_CACHE_REVALIDATE', () => {
	test('304 for a matching If-None-Match or a later If-Modified-Since', async () => {
		files.readOne.mockResolvedValue({ modified_on: file.modified_on });
		const request = await agent({ ASSETS_CACHE_REVALIDATE: true });
		const etag = `"${Date.parse(file.modified_on) / 1000}"`;

		const byEtag = await request.get(`/assets/${ID}`).set('Authorization', admin()).set('If-None-Match', etag);
		expect(byEtag.status).toBe(304);
		expect(byEtag.headers['cache-control']).toBe('max-age=0, must-revalidate');
		expect(byEtag.headers['etag']).toBe(etag);

		const byDate = await request
			.get(`/assets/${ID}`)
			.set('Authorization', admin())
			.set('If-Modified-Since', new Date(Date.parse(file.modified_on) + 1000).toUTCString());
		expect(byDate.status).toBe(304);
		expect(assets.getAsset).not.toHaveBeenCalled();

		const changed = await request.get(`/assets/${ID}`).set('Authorization', admin()).set('If-None-Match', '"1"');
		expect(changed.status).toBe(200);
		expect(changed.headers['cache-control']).toBe('max-age=0, must-revalidate');
	});
});

describe('transformation query', () => {
	test.each([
		['transforms=nope', '"transforms" Parameter needs to be a JSON array of allowed transformations'],
		['transforms={"a":1}', '"transforms" Parameter needs to be a JSON array of allowed transformations'],
		[
			`transforms=${JSON.stringify(Array(6).fill(['blur', 1]))}`,
			'"transforms" Parameter is only allowed 5 transformations',
		],
		['transforms=[["toFile","x"]]', '"transforms" Parameter does not allow "toFile" as a transformation'],
		['key=unknown', 'Key "unknown" isn\'t configured'],
	])('%s → 400', async (query, reason) => {
		const res = await (await agent()).get(`/assets/${ID}?${query}`).set('Authorization', admin());

		expect(res.status).toBe(400);
		expect(res.body.errors[0]).toEqual({
			message: `Invalid query. ${reason}.`,
			extensions: { code: 'INVALID_QUERY', reason },
		});
	});

	test('a key merges the preset with the query (query wins), format=auto follows Accept', async () => {
		const res = await (await agent())
			.get(`/assets/${ID}?key=system-small-cover&width=10&quality=50`)
			.set('Authorization', admin())
			.set('Accept', 'image/avif,image/webp,*/*');

		expect(res.status).toBe(200);
		expect(res.headers['vary']).toBe('Origin, Cache-Control, Accept');

		expect(assets.getAsset.mock.calls[0]![1]).toEqual({
			transformationParams: {
				key: 'system-small-cover',
				format: 'auto',
				transforms: [['resize', { width: 64, height: 64, fit: 'cover' }]],
				width: '10',
				quality: '50',
			},
			acceptFormat: 'avif',
		});
	});

	test('presets mode: only a configured key alone', async () => {
		await settings('presets', [{ key: 'thumb', width: 20 }]);
		const request = await agent();

		expect((await request.get(`/assets/${ID}?key=thumb`).set('Authorization', admin())).status).toBe(200);

		const mixed = await request.get(`/assets/${ID}?key=thumb&width=5`).set('Authorization', admin());
		expect(mixed.status).toBe(400);
		expect(mixed.body.errors[0].extensions.reason).toBe('Only configured presets can be used in asset generation');
	});

	test('none mode: only a system key alone; transforms=[] passes every mode like Directus (R-16)', async () => {
		await settings('none');
		const request = await agent();

		expect((await request.get(`/assets/${ID}?key=system-large-contain`).set('Authorization', admin())).status).toBe(
			200,
		);

		const free = await request.get(`/assets/${ID}?width=5`).set('Authorization', admin());
		expect(free.status).toBe(400);
		expect(free.body.errors[0].extensions.reason).toBe('Dynamic asset generation has been disabled for this project');

		const bypass = await request.get(`/assets/${ID}?width=5&transforms=[]`).set('Authorization', admin());
		expect(bypass.status).toBe(200);
		expect(assets.getAsset.mock.calls[1]![1].transformationParams).toEqual({ width: '5', transforms: [] });
	});
});

describe('zip', () => {
	function archive() {
		return Object.assign(new PassThrough(), { abort: vi.fn() });
	}

	test('POST /assets/folder/:pk streams a zip named after the folder', async () => {
		const zip = archive();

		assets.zipFolder.mockResolvedValue({
			archive: zip,
			metadata: { name: 'Holiday' },
			complete: async () => zip.end('PK'),
		});

		const res = await (await agent()).post(`/assets/folder/${ID}`).set('Authorization', admin());

		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toBe('application/zip');
		expect(res.headers['content-disposition']).toMatch(/^attachment; filename="folder-Holiday-\d{8}-\d{1,6}\.zip"$/);
		expect(assets.zipFolder).toHaveBeenCalledWith(ID);
	});

	test('POST /assets/files validates the ids', async () => {
		const request = await agent();

		const invalid = await request
			.post('/assets/files')
			.set('Authorization', admin())
			.send({ ids: ['x'] });
		expect(invalid.status).toBe(400);
		expect(invalid.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');

		const zip = archive();
		assets.zipFiles.mockResolvedValue({ archive: zip, complete: async () => zip.end('PK') });

		const res = await request
			.post('/assets/files')
			.set('Authorization', admin())
			.send({ ids: [ID] });

		expect(res.status).toBe(200);
		expect(res.headers['content-disposition']).toMatch(/^attachment; filename="files-\d{8}-\d{1,6}\.zip"$/);
		expect(assets.zipFiles).toHaveBeenCalledWith([ID]);
	});

	test('a failing archive before any byte answers 500 JSON', async () => {
		const zip = archive();

		assets.zipFiles.mockResolvedValue({
			archive: zip,
			complete: async () => {
				throw new Error('object missing');
			},
		});

		const res = await (
			await agent()
		)
			.post('/assets/files')
			.set('Authorization', admin())
			.send({ ids: [ID] });

		expect(res.status).toBe(500);
		expect(res.body.errors[0].extensions.code).toBe('INTERNAL_SERVER_ERROR');
	});
});
