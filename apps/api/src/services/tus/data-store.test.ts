// Backoffice: directus/api/src/services/tus/data-store.ts has no unit test (feature 007, T016): the create
// validation, the uploaded_by filter and the expiration rule of spec FR-051, FR-052, US4.
import type { TusDriver } from '@backoffice/storage';
import { ERRORS, Upload } from '@tus/utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import getDatabase from '../../database/index.js';
import { ItemsService } from '../items.service.js';
import { TusDataStore } from './data-store.js';

vi.mock('../../database/index.js', () => ({ default: vi.fn() }));
vi.mock('../../logger/index.js', () => ({ useLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }));
vi.mock('../items.service.js', () => ({ ItemsService: vi.fn() }));

const items = {
	createOne: vi.fn(),
	updateOne: vi.fn(),
	deleteOne: vi.fn(),
	readByQuery: vi.fn(),
	readOne: vi.fn(),
};

let existingFile: Record<string, unknown> | undefined;
let defaultFolder: string | null;

const driver = {
	tusExtensions: ['creation', 'termination', 'expiration'],
	createChunkedUpload: vi.fn(async (_path: string, upload: Upload) => upload),
	deleteChunkedUpload: vi.fn(),
	writeChunk: vi.fn(),
	finishChunkedUpload: vi.fn(),
} as unknown as TusDriver;

function store(accountability: Record<string, unknown> | undefined = { user: 'user-1', admin: false }) {
	return new TusDataStore({
		constants: { ENABLED: true, CHUNK_SIZE: 8_388_608, EXPIRATION_TIME: 600_000, SCHEDULE: '0 * * * *' },
		location: 'local',
		driver,
		schema: { collections: {}, relations: [] } as any,
		accountability: accountability as any,
	});
}

function upload(metadata: Record<string, string | null> | undefined, size: number | undefined = 10) {
	return new Upload({ id: 'tus-1', size, offset: 0, metadata } as any);
}

beforeEach(() => {
	vi.clearAllMocks();
	existingFile = undefined;
	defaultFolder = null;
	vi.mocked(ItemsService).mockImplementation(() => items as any);
	items.createOne.mockResolvedValue('11111111-1111-1111-1111-111111111111');

	const knex = Object.assign(vi.fn(), {
		select: vi.fn((...columns: string[]) => {
			const builder = {
				from: vi.fn(() => builder),
				andWhere: vi.fn(() => builder),
				first: vi.fn(async () =>
					columns.includes('storage_default_folder') ? { storage_default_folder: defaultFolder } : existingFile,
				),
			};

			return builder;
		}),
	});

	vi.mocked(getDatabase).mockReturnValue(knex as any);
});

describe('create', () => {
	test.each([
		['no size', upload({ filename_download: 'a.jpg' }, 0)],
		['no metadata', upload(undefined)],
		['no filename_download', upload({ type: 'image/jpeg' })],
	])('rejects an upload with %s as invalid metadata', async (_name, value) => {
		await expect(store().create(value)).rejects.toBe(ERRORS.INVALID_METADATA);
		expect(items.createOne).not.toHaveBeenCalled();
	});

	test('rejects replacing a file that has an upload in progress', async () => {
		existingFile = { tus_id: 'other-upload' };

		await expect(store().create(upload({ filename_download: 'a.jpg', id: 'abc' }))).rejects.toBe(
			ERRORS.INVALID_METADATA,
		);
	});

	test('creates the row with the upload, the default folder and <id><ext> as filename_disk', async () => {
		defaultFolder = 'folder-1';

		const result = await store().create(upload({ filename_download: 'photo.jpg' }));

		expect(items.createOne).toHaveBeenCalledWith(
			expect.objectContaining({
				filename_download: 'photo.jpg',
				type: 'application/octet-stream',
				// formatTitle of the whole filename_download: TUS keeps the extension, multipart drops it.
				title: 'Photo.jpg',
				tus_id: 'tus-1',
				filesize: 10,
				storage: 'local',
				folder: 'folder-1',
			}),
			{ emitEvents: false },
		);

		expect(driver.createChunkedUpload).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111.jpg', result);
		expect(result.metadata!['id']).toBe('11111111-1111-1111-1111-111111111111');
	});

	test('marks a replacement with replace_id when the target exists', async () => {
		existingFile = { tus_id: null, filename_disk: 'abc.jpg' };

		const result = await store().create(upload({ filename_download: 'photo.png', type: 'image/png', id: 'abc' }));

		expect(result.metadata!['replace_id']).toBe('abc');
		expect(items.createOne.mock.calls[0]![0]).not.toHaveProperty('id');
		expect(items.createOne.mock.calls[0]![0]).not.toHaveProperty('replace_id');
	});
});

describe('getUpload', () => {
	test('filters on the uploader when the accountability has a user', async () => {
		items.readByQuery.mockResolvedValue([{ tus_data: { id: 'tus-1', size: 10, offset: 4 } }]);

		const result = await store().getUpload('tus-1');

		expect(result.offset).toBe(4);

		expect(items.readByQuery).toHaveBeenCalledWith({
			filter: { tus_id: { _eq: 'tus-1' }, storage: { _eq: 'local' }, uploaded_by: { _eq: 'user-1' } },
		});
	});

	test('does not filter on the uploader without a user, admin has no exception', async () => {
		items.readByQuery.mockResolvedValue([{ tus_data: { id: 'tus-1', size: 10, offset: 0 } }]);

		await store({ user: null, role: null, admin: false }).getUpload('tus-1');
		expect(items.readByQuery.mock.calls[0]![0].filter).not.toHaveProperty('uploaded_by');

		await store({ user: 'admin-1', admin: true }).getUpload('tus-1');
		expect(items.readByQuery.mock.calls[1]![0].filter.uploaded_by).toEqual({ _eq: 'admin-1' });
	});

	test('unknown upload: FILE_NOT_FOUND', async () => {
		items.readByQuery.mockResolvedValue([]);

		await expect(store().getUpload('nope')).rejects.toBe(ERRORS.FILE_NOT_FOUND);
	});
});

test('deleteExpired removes only incomplete uploads idle for longer than the expiration', async () => {
	const old = new Date(Date.now() - 700_000).toISOString();
	const recent = new Date().toISOString();

	items.readByQuery.mockImplementation(async (query: any) => {
		if (query.fields) {
			return [
				{ tus_id: 'stale', modified_on: old, tus_data: { size: 10, offset: 4 } },
				{ tus_id: 'active', modified_on: recent, tus_data: { size: 10, offset: 4 } },
				{ tus_id: 'complete', modified_on: old, tus_data: { size: 10, offset: 10 } },
			];
		}

		return [{ id: 'row-' + query.filter.tus_id._eq, filename_disk: 'x.jpg', tus_data: {} }];
	});

	expect(await store(undefined).deleteExpired()).toBe(1);
	expect(driver.deleteChunkedUpload).toHaveBeenCalledTimes(1);
	expect(items.deleteOne).toHaveBeenCalledWith('row-stale');
});
