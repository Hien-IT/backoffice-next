// Backoffice: no test in Directus. RevisionsService.revert (spec FR-020; the route is POST /utils/revert of feature 010)
// and the defaults of its writes.
import { ForbiddenError, InvalidPayloadError } from '@backoffice/errors';
import { SchemaBuilder } from '@backoffice/schema-builder';
import { afterEach, expect, test, vi } from 'vitest';
import { ItemsService } from './items.service.js';
import { RevisionsService } from './revisions.service.js';

vi.mock('./items.service.js', async () => {
	const { mockItemsService } = await import('../test-utils/services/items-service.js');
	return mockItemsService();
});

const schema = new SchemaBuilder().build();
const accountability = { user: 'u1', role: null, roles: [], admin: false, app: true, ip: null } as any;
const service = () => new RevisionsService({ schema, accountability });

afterEach(() => {
	vi.clearAllMocks();
});

test('revert updates the item of the revision with its data, as the caller, through a plain ItemsService', async () => {
	vi.mocked(ItemsService.prototype.readOne).mockResolvedValueOnce({
		collection: 'directus_files',
		item: 'f1',
		data: { title: 'old' },
	});

	await service().revert(5);

	expect(ItemsService.prototype.readOne).toHaveBeenCalledWith(5);
	expect(vi.mocked(ItemsService).mock.calls.at(-1)).toEqual([
		'directus_files',
		expect.objectContaining({ accountability, schema }),
	]);
	expect(ItemsService.prototype.updateOne).toHaveBeenCalledWith('f1', { title: 'old' });
});

test('a revision that is not there is Forbidden, one without data is an invalid payload', async () => {
	vi.mocked(ItemsService.prototype.readOne).mockResolvedValueOnce(undefined);
	await expect(service().revert(5)).rejects.toBeInstanceOf(ForbiddenError);

	vi.mocked(ItemsService.prototype.readOne).mockResolvedValueOnce({ collection: 'posts', item: '1', data: null });
	const error = await service()
		.revert(5)
		.catch((e: unknown) => e);
	expect(error).toBeInstanceOf(InvalidPayloadError);
	expect(error).toMatchObject({ extensions: { reason: `Revision doesn't contain data to revert to` } });
	expect(ItemsService.prototype.updateOne).not.toHaveBeenCalled();
});

test('writes skip the cache purge and the batch limits unless the caller says otherwise', async () => {
	await service().createOne({ collection: 'posts' });
	await service().createMany([{ collection: 'posts' }], { autoPurgeCache: false, bypassLimits: false });
	await service().updateOne(1, { data: null });
	await service().updateMany([1], { data: null }, { bypassLimits: false });

	expect(ItemsService.prototype.createOne).toHaveBeenCalledWith(expect.anything(), {
		autoPurgeCache: false,
		bypassLimits: true,
	});
	expect(ItemsService.prototype.createMany).toHaveBeenCalledWith(expect.anything(), {
		autoPurgeCache: false,
		bypassLimits: false,
	});
	expect(ItemsService.prototype.updateOne).toHaveBeenCalledWith(1, expect.anything(), {
		autoPurgeCache: false,
		bypassLimits: true,
	});
	expect(ItemsService.prototype.updateMany).toHaveBeenCalledWith([1], expect.anything(), {
		autoPurgeCache: false,
		bypassLimits: false,
	});
});
