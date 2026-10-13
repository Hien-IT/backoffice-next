// Ported from directus/api/src/services/versions.test.ts
import { SchemaBuilder } from '@backoffice/schema-builder';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createMockKnex, resetKnexMocks } from '../test-utils/knex.js';
import { ActivityService } from './activity.service.js';
import { ItemsService } from './items.service.js';
import { RevisionsService } from './revisions.service.js';
import { VersionsService } from './versions.service.js';

vi.mock('../../src/database/index', async () => {
	const { mockDatabase } = await import('../test-utils/database.js');
	return mockDatabase();
});

vi.mock('../database/helpers/index.js', () => ({
	getHelpers: vi.fn(() => ({
		date: {
			writeTimestamp: vi.fn((value: string) => value),
		},
	})),
}));

vi.mock('../cache.js', async () => {
	const { mockCache } = await import('../test-utils/cache.js');
	return mockCache();
});

vi.mock('../utils/should-clear-cache.js');

vi.mock('./payload.service.js', () => {
	const PayloadService = vi.fn();
	PayloadService.prototype.prepareDelta = vi.fn().mockImplementation(async (delta: unknown) => delta);
	return { PayloadService };
});

vi.mock('./items.service.js', async () => {
	const { mockItemsService } = await import('../test-utils/services/items-service.js');
	return mockItemsService();
});

vi.mock('./revisions.service.js', async () => {
	const { mockRevisionsService } = await import('../test-utils/services/revisions-service.js');
	return mockRevisionsService();
});

vi.mock('./activity.service.js', async () => {
	const { mockActivityService } = await import('../test-utils/services/activity-service.js');
	return mockActivityService();
});

// Backoffice: the extra cases below (spec FR-030 to FR-035) need access checks, the collection meta and the emitter.
vi.mock('../permissions/modules/validate-access/validate-access.js', () => ({ validateAccess: vi.fn() }));

vi.mock('./collections.service.js', () => {
	const CollectionsService = vi.fn();
	CollectionsService.prototype.readOne = vi.fn().mockResolvedValue({ meta: { versioning: true } });
	return { CollectionsService };
});

vi.mock('../emitter.js', () => ({
	default: { emitFilter: vi.fn(async (_event: unknown, payload: unknown) => payload), emitAction: vi.fn() },
}));

const schema = new SchemaBuilder()
	.collection('articles_track_all', (c) => {
		c.field('id').id();
		c.field('title').string();
	})
	.options({ accountability: 'all' })
	.collection('articles_track_activity', (c) => {
		c.field('id').id();
		c.field('title').string();
	})
	.options({ accountability: 'activity' })
	.collection('articles_track_none', (c) => {
		c.field('id').id();
		c.field('title').string();
	})
	.options({ accountability: null })
	// Backoffice: special fields for mapDelta (spec FR-032).
	.collection('posts', (c) => {
		c.field('id').id();
		c.field('title').string();
		c.field('user_updated')
			.uuid()
			.options({ special: ['user-updated'] });
		c.field('date_updated')
			.timestamp()
			.options({ special: ['date-updated'] });
		c.field('user_created')
			.uuid()
			.options({ special: ['user-created'] });
		c.field('date_created')
			.timestamp()
			.options({ special: ['date-created'] });
	})
	.build();

describe('Integration Tests', () => {
	const { db, tracker, mockSchemaBuilder } = createMockKnex();

	afterEach(() => {
		resetKnexMocks(tracker, mockSchemaBuilder);

		vi.clearAllMocks();
	});

	describe('Services / Versions', () => {
		const service = new VersionsService({ knex: db, schema });

		describe('save respects collection accountability tracking', () => {
			test('should skip activity and revision when collection accountability is null', async () => {
				vi.spyOn(ItemsService.prototype, 'readOne').mockResolvedValue({
					collection: 'articles_track_none',
					item: 1,
				});

				await service.save(1, { title: 'Updated' });

				expect(ActivityService.prototype.createOne).not.toHaveBeenCalled();
				expect(RevisionsService.prototype.createOne).not.toHaveBeenCalled();

				expect(ItemsService.prototype.updateOne).toHaveBeenCalledWith(
					1,
					expect.objectContaining({ delta: expect.any(Object) }),
				);
			});

			test('should create activity without revision when collection accountability is "activity"', async () => {
				vi.spyOn(ItemsService.prototype, 'readOne').mockResolvedValue({
					collection: 'articles_track_activity',
					item: 1,
				});

				await service.save(1, { title: 'Updated' });

				expect(ActivityService.prototype.createOne).toHaveBeenCalledTimes(1);
				expect(RevisionsService.prototype.createOne).not.toHaveBeenCalled();
			});

			test('should create activity and revision when collection accountability is "all"', async () => {
				vi.spyOn(ItemsService.prototype, 'readOne').mockResolvedValue({
					collection: 'articles_track_all',
					item: 2,
				});

				await service.save(1, { title: 'Updated' });

				expect(ActivityService.prototype.createOne).toHaveBeenCalledWith(
					expect.objectContaining({ action: 'version_save', collection: 'articles_track_all', item: 2 }),
				);

				expect(RevisionsService.prototype.createOne).toHaveBeenCalledWith(
					expect.objectContaining({ collection: 'articles_track_all', item: 2, version: 1, activity: 1 }),
				);
			});
		});
	});
});

// Backoffice: cases of spec FR-030 to FR-035 beyond the three of Directus (contracts/versions.md §2, §5, §7).
describe('Backoffice: validation, mapDelta and promote', async () => {
	const { validateAccess } = await import('../permissions/modules/validate-access/validate-access.js');
	const { CollectionsService } = await import('./collections.service.js');
	const { default: emitter } = await import('../emitter.js');
	const { db } = createMockKnex();
	const accountability = { user: 'u1', role: null, roles: [], admin: false, app: true, ip: null } as any;
	const service = new VersionsService({ knex: db, schema, accountability });
	const valid = { key: 'draft', name: 'Draft', collection: 'posts', item: '1' };

	afterEach(() => {
		vi.clearAllMocks();
	});

	test.each([
		[{ ...valid, key: undefined }, '"key" is required'],
		[{ ...valid, collection: undefined }, '"collection" is required'],
		[{ ...valid, item: 1 }, '"item" must be a string'],
		[{ ...valid, extra: true }, '"extra" is not allowed'],
		[{ ...valid, key: 'main' }, '"main" is a reserved version key'],
	])('createOne rejects %j with "%s"', async (data, reason) => {
		await expect(service.createOne(data)).rejects.toMatchObject({ code: 'INVALID_PAYLOAD', extensions: { reason } });
	});

	test('createOne: no read access to the item is Forbidden, before the versioning check', async () => {
		vi.mocked(validateAccess).mockRejectedValueOnce(new Error('no'));

		await expect(service.createOne(valid)).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect(CollectionsService.prototype.readOne).not.toHaveBeenCalled();
	});

	test('createOne: collection without versioning, then an existing key, are unprocessable', async () => {
		vi.mocked(CollectionsService.prototype.readOne).mockResolvedValueOnce({ meta: { versioning: false } } as any);

		await expect(service.createOne(valid)).rejects.toMatchObject({
			code: 'UNPROCESSABLE_CONTENT',
			extensions: { reason: 'Content Versioning is not enabled for collection "posts"' },
		});

		vi.mocked(ItemsService.prototype.readByQuery).mockResolvedValueOnce([{ count: 1 }]);

		await expect(service.createOne(valid)).rejects.toMatchObject({
			extensions: { reason: 'Version "draft" already exists for item "1" in collection "posts"' },
		});
	});

	test('createOne stores the object-hash of the main item read with the caller access', async () => {
		vi.mocked(ItemsService.prototype.readByQuery).mockResolvedValueOnce([{ count: 0 }]);
		vi.mocked(ItemsService.prototype.readOne).mockResolvedValueOnce({ id: 1, title: 'a' });

		await service.createOne({ ...valid });

		const { default: objectHash } = await import('object-hash');
		expect(ItemsService.prototype.createOne).toHaveBeenCalledWith(
			expect.objectContaining({ hash: objectHash({ id: 1, title: 'a' }) }),
			undefined,
		);
	});

	test('createMany: two versions with the same key for one item are unprocessable', async () => {
		await expect(service.createMany([valid, valid])).rejects.toMatchObject({
			extensions: { reason: 'Cannot create multiple versions on "1" in collection "posts" with the same key "draft"' },
		});
	});

	test('updateMany accepts key and name only, never "main" nor a key another version has', async () => {
		await expect(service.updateMany(['v1'], { delta: {} })).rejects.toMatchObject({
			extensions: { reason: '"delta" is not allowed' },
		});

		await expect(service.updateMany(['v1'], { key: 'main' })).rejects.toMatchObject({
			extensions: { reason: '"main" is a reserved version key' },
		});

		// The first key passes its check (no other version has the key), the second one repeats the combination.
		vi.mocked(ItemsService.prototype.readOne)
			.mockResolvedValueOnce({ collection: 'posts', item: '1' })
			.mockResolvedValueOnce({ collection: 'posts', item: '1' })
			.mockResolvedValueOnce({ collection: 'posts', item: '1' });
		vi.mocked(ItemsService.prototype.readByQuery).mockResolvedValueOnce([{ count: 0 }]);

		await expect(service.updateMany(['v1', 'v2'], { key: 'other' })).rejects.toMatchObject({
			extensions: { reason: 'Cannot update multiple versions on "1" in collection "posts" to the same key "other"' },
		});

		vi.mocked(ItemsService.prototype.readByQuery).mockResolvedValueOnce([{ count: 1 }]);

		await expect(service.updateMany(['v1'], { key: 'other' })).rejects.toMatchObject({
			extensions: { reason: 'Version "other" already exists for item "1" in collection "posts"' },
		});
	});

	test('readOne maps _user and _date of the delta to the special fields and adds the primary key', async () => {
		vi.mocked(ItemsService.prototype.readOne).mockResolvedValueOnce({
			collection: 'posts',
			item: '1',
			delta: { title: 'b', _user: 'u1', _date: '2026-10-13T10:00:00.000Z' },
		});

		const version = await service.readOne('v1');

		expect(version.delta).toEqual({
			id: '1',
			title: 'b',
			user_updated: 'u1',
			date_updated: '2026-10-13T10:00:00.000Z',
		});
	});

	test('promote: no delta, then a changed main item, are unprocessable; access is checked first', async () => {
		vi.mocked(ItemsService.prototype.readOne).mockResolvedValueOnce({ collection: 'posts', item: '1', delta: null });

		await expect(service.promote('v1', 'hash')).rejects.toMatchObject({
			extensions: { reason: 'No changes to promote' },
		});

		expect(validateAccess).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'update', collection: 'posts', primaryKeys: ['1'] }),
			expect.anything(),
		);

		vi.mocked(ItemsService.prototype.readOne)
			.mockResolvedValueOnce({ collection: 'posts', item: '1', delta: { title: 'b' } })
			.mockResolvedValueOnce({ id: 1, title: 'changed' });

		await expect(service.promote('v1', 'stale')).rejects.toMatchObject({
			extensions: { reason: 'Main item has changed since this version was last updated' },
		});
	});

	test('promote picks the requested top-level fields, emits items.promote and updates with the default overwrites', async () => {
		const { default: objectHash } = await import('object-hash');
		const main = { id: 1, title: 'a' };

		vi.mocked(ItemsService.prototype.readOne)
			.mockResolvedValueOnce({
				collection: 'posts',
				item: '1',
				delta: { title: 'b', body: 'x', _user: 'u1', _date: 'd' },
			})
			.mockResolvedValueOnce(main);

		await service.promote('v1', objectHash(main), ['title', 'missing']);

		expect(emitter.emitFilter).toHaveBeenCalledWith(
			['items.promote', 'posts.items.promote'],
			{ title: 'b' },
			{ collection: 'posts', item: '1', version: 'v1' },
			expect.anything(),
		);

		expect(ItemsService.prototype.updateOne).toHaveBeenCalledWith(
			'1',
			{ title: 'b' },
			{
				overwriteDefaults: { _user: 'u1', _date: 'd' },
			},
		);

		expect(emitter.emitAction).toHaveBeenCalledWith(
			['items.promote', 'posts.items.promote'],
			expect.objectContaining({ payload: { title: 'b' }, collection: 'posts', version: 'v1' }),
			expect.anything(),
		);
	});
});
