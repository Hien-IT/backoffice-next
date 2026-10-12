// Feature 006 (T013): directus/api/src/services/relations.ts has no unit test in Directus 11.17.4; these cases follow
// its code (input checks, foreign key DDL, metadata, events, cache) with the mocks of the ported collections tests.
import { ForbiddenError, InvalidPayloadError } from '@backoffice/errors';
import { SchemaBuilder } from '@backoffice/schema-builder';
import type { Accountability, Relation, SchemaOverview } from '@backoffice/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearSystemCache } from '../cache.js';
import emitter from '../emitter.js';
import { fetchAllowedFieldMap } from '../permissions/modules/fetch-allowed-field-map/fetch-allowed-field-map.js';
import { fetchAllowedFields } from '../permissions/modules/fetch-allowed-fields/fetch-allowed-fields.js';
import { validateAccess } from '../permissions/modules/validate-access/validate-access.js';
import { getSchema } from '../schema/get-database-schema.js';
import { createMockKnex, resetKnexMocks } from '../test-utils/knex.js';
import { ItemsService } from './items.service.js';
import { RelationsService } from './relations.service.js';

vi.mock('@backoffice/env', () => ({ useEnv: vi.fn().mockReturnValue({}) }));

vi.mock('../database/index.js', async () => {
	const { mockDatabase } = await import('../test-utils/database.js');
	return mockDatabase();
});

vi.mock('@backoffice/schema', async () => {
	const { mockSchema } = await import('../test-utils/schema.js');
	return mockSchema();
});

vi.mock('../cache.js', async () => {
	const { mockCache } = await import('../test-utils/cache.js');
	return mockCache();
});

vi.mock('../emitter.js', async () => {
	const { mockEmitter } = await import('../test-utils/emitter.js');
	return mockEmitter();
});

vi.mock('./items.service.js', async () => {
	const { mockItemsService } = await import('../test-utils/services/items-service.js');
	return mockItemsService();
});

vi.mock('../utils/transaction.js', async () => {
	const { mockTransaction } = await import('../test-utils/database.js');
	return mockTransaction();
});

vi.mock('../schema/get-database-schema.js', () => ({ getSchema: vi.fn() }));
vi.mock('../permissions/modules/validate-access/validate-access.js', () => ({ validateAccess: vi.fn() }));
vi.mock('../permissions/modules/fetch-allowed-fields/fetch-allowed-fields.js', () => ({ fetchAllowedFields: vi.fn() }));

vi.mock('../permissions/modules/fetch-allowed-field-map/fetch-allowed-field-map.js', () => ({
	fetchAllowedFieldMap: vi.fn(),
}));

const admin = { role: 'r', admin: true } as Accountability;
const user = { role: 'r', admin: false, user: 'u' } as Accountability;

function buildSchema(relations: Relation[] = []): SchemaOverview {
	const schema = new SchemaBuilder()
		.collection('directus_relations', (c) => {
			c.field('id').integer().primary();
		})
		.collection('articles', (c) => {
			c.field('id').integer().primary();
			c.field('author').integer();
			c.field('item').string();
		})
		.collection('authors', (c) => {
			c.field('id').integer().primary();
		})
		.build();

	schema.collections['articles']!.fields['author']!.dbType = 'int';
	schema.collections['authors']!.fields['id']!.dbType = 'integer';
	return { ...schema, relations };
}

/** Records what the service asks of the alterTable builder. */
function tableRecorder() {
	const calls: unknown[][] = [];
	const column = {
		notNullable: vi.fn(() => (calls.push(['notNullable']), column)),
		alter: vi.fn(() => (calls.push(['alter']), column)),
	};
	const builder = {
		references: vi.fn((target: string) => (calls.push(['references', target]), builder)),
		onDelete: vi.fn((action: string) => (calls.push(['onDelete', action]), builder)),
		onUpdate: vi.fn((action: string) => (calls.push(['onUpdate', action]), builder)),
	};
	const table = {
		foreign: vi.fn((field: string, name?: string) => (calls.push(['foreign', field, name]), builder)),
		dropForeign: vi.fn((field: string, name: string) => calls.push(['dropForeign', field, name])),
		specificType: vi.fn((field: string, type: string) => (calls.push(['specificType', field, type]), column)),
	};
	return { calls, table };
}

const m2o = (overrides: Partial<Relation> = {}): Relation => ({
	collection: 'articles',
	field: 'author',
	related_collection: 'authors',
	schema: {
		table: 'articles',
		column: 'author',
		foreign_key_table: 'authors',
		foreign_key_column: 'id',
		constraint_name: 'articles_author_foreign',
		on_update: 'NO ACTION',
		on_delete: 'SET NULL',
	},
	meta: { id: 7, many_collection: 'articles', many_field: 'author', one_collection: 'authors' } as Relation['meta'],
	...overrides,
});

describe('RelationsService', () => {
	const { db, tracker, mockSchemaBuilder } = createMockKnex();
	let recorder: ReturnType<typeof tableRecorder>;

	beforeEach(() => {
		recorder = tableRecorder();
		mockSchemaBuilder.alterTable.mockImplementation(async (_name: string, callback: (t: unknown) => unknown) => {
			await callback(recorder.table);
		});
		vi.mocked(getSchema).mockResolvedValue(buildSchema());
	});

	afterEach(() => {
		resetKnexMocks(tracker, mockSchemaBuilder);
		vi.clearAllMocks();
	});

	describe('createOne', () => {
		test('non-admin: 403 before any check', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema(), accountability: user });
			await expect(service.createOne({ collection: 'articles', field: 'author' })).rejects.toThrow(ForbiddenError);
		});

		test.each([
			[{ field: 'author' }, '"collection" is required'],
			[{ collection: 'articles' }, '"field" is required'],
			[{ collection: 'nope', field: 'author' }, `Collection "nope" doesn't exist`],
			[{ collection: 'articles', field: 'nope' }, `Field "nope" doesn't exist in collection "articles"`],
			[{ collection: 'articles', field: 'id' }, `Field "id" in collection "articles" is a primary key`],
			[{ collection: 'articles', field: 'author', related_collection: 'nope' }, `Collection "nope" doesn't exist`],
		])('invalid payload %j: %s', async (payload, reason) => {
			const service = new RelationsService({ knex: db, schema: buildSchema(), accountability: admin });
			await expect(service.createOne(payload)).rejects.toThrow(new InvalidPayloadError({ reason }));
		});

		test('a field that already has a relation is rejected', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema([m2o()]), accountability: admin });

			await expect(service.createOne({ collection: 'articles', field: 'author' })).rejects.toThrow(
				new InvalidPayloadError({
					reason: 'Field "author" in collection "articles" already has an associated relationship',
				}),
			);
		});

		test('m2o: foreign key named like Directus, actions, metadata without accountability, cache, event', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema(), accountability: admin });

			await service.createOne({
				collection: 'articles',
				field: 'author',
				related_collection: 'authors',
				schema: { on_delete: 'SET NULL', on_update: 'CASCADE' } as Relation['schema'],
				meta: { sort_field: null } as unknown as Relation['meta'],
			});

			expect(recorder.calls).toEqual([
				['foreign', 'author', 'articles_author_foreign'],
				['references', 'authors.id'],
				['onDelete', 'SET NULL'],
				['onUpdate', 'CASCADE'],
			]);

			const itemsService = vi.mocked(ItemsService);
			expect(itemsService).toHaveBeenCalledWith('directus_relations', { knex: db, schema: expect.any(Object) });
			expect(itemsService.prototype.createOne).toHaveBeenCalledWith(
				{ sort_field: null, many_collection: 'articles', many_field: 'author', one_collection: 'authors' },
				expect.any(Object),
			);
			expect(clearSystemCache).toHaveBeenCalledWith({ autoPurgeCache: undefined });
		});

		test('m2a (no related collection): no DDL, one_collection null', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema(), accountability: admin });

			await service.createOne({
				collection: 'articles',
				field: 'item',
				meta: { one_allowed_collections: ['authors'], one_collection_field: 'collection' } as Relation['meta'],
			});

			expect(mockSchemaBuilder.alterTable).not.toHaveBeenCalled();
			expect(vi.mocked(ItemsService).prototype.createOne).toHaveBeenCalledWith(
				expect.objectContaining({ many_field: 'item', one_collection: null, one_allowed_collections: ['authors'] }),
				expect.any(Object),
			);
		});

		test('MySQL: an int m2o pointing at an int unsigned key becomes int unsigned, keeping NOT NULL', async () => {
			const schema = buildSchema();
			schema.collections['authors']!.fields['id']!.dbType = 'int unsigned';
			schema.collections['articles']!.fields['author']!.nullable = false;
			const service = new RelationsService({ knex: db, schema, accountability: admin });

			await service.createOne({ collection: 'articles', field: 'author', related_collection: 'authors' });

			expect(recorder.calls.slice(0, 3)).toEqual([
				['specificType', 'author', 'int unsigned'],
				['notNullable'],
				['alter'],
			]);
		});

		test('autoPurgeSystemCache false skips the cache clear; action events are emitted after the transaction', async () => {
			vi.mocked(ItemsService).prototype.createOne = vi.fn(async (_payload, opts) => {
				opts.bypassEmitAction({ event: 'relations.create', meta: {}, context: {} });
				return 1;
			});

			const service = new RelationsService({ knex: db, schema: buildSchema(), accountability: admin });
			await service.createOne({ collection: 'articles', field: 'item' }, { autoPurgeSystemCache: false });

			expect(clearSystemCache).not.toHaveBeenCalled();
			expect(emitter.emitAction).toHaveBeenCalledWith('relations.create', {}, { schema: expect.any(Object) });
		});
	});

	describe('updateOne', () => {
		test('drops and recreates the foreign key with the stored name; related collection kept', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema([m2o()]), accountability: admin });

			// The app sends the whole relation; the foreign key always targets the related collection already stored.
			await service.updateOne('articles', 'author', {
				collection: 'articles',
				field: 'author',
				related_collection: 'authors',
				schema: { on_delete: 'CASCADE' } as Relation['schema'],
				meta: { sort_field: 'sort' } as Relation['meta'],
			});

			expect(recorder.calls).toEqual([
				['dropForeign', 'author', 'articles_author_foreign'],
				['foreign', 'author', 'articles_author_foreign'],
				['references', 'authors.id'],
				['onDelete', 'CASCADE'],
			]);

			expect(vi.mocked(ItemsService).prototype.updateOne).toHaveBeenCalledWith(
				7,
				{ sort_field: 'sort' },
				expect.any(Object),
			);
		});

		test('a relation without metadata gets a new metadata row', async () => {
			const service = new RelationsService({
				knex: db,
				schema: buildSchema([m2o({ meta: null })]),
				accountability: admin,
			});

			await service.updateOne('articles', 'author', {
				collection: 'articles',
				field: 'author',
				related_collection: 'authors',
				meta: { one_field: 'articles' } as Relation['meta'],
			});

			expect(vi.mocked(ItemsService).prototype.createOne).toHaveBeenCalledWith(
				{ one_field: 'articles', many_collection: 'articles', many_field: 'author', one_collection: 'authors' },
				expect.any(Object),
			);
		});

		test('m2o body without collection or related_collection: TypeError (500), like Directus alterType', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema([m2o()]), accountability: admin });

			await expect(
				service.updateOne('articles', 'author', { schema: { on_delete: 'CASCADE' } as Relation['schema'] }),
			).rejects.toThrow(TypeError);
		});

		test('m2a: no DDL', async () => {
			const service = new RelationsService({
				knex: db,
				schema: buildSchema([m2o({ field: 'item', related_collection: null, schema: null })]),
				accountability: admin,
			});

			await service.updateOne('articles', 'item', { meta: { sort_field: 'sort' } as Relation['meta'] });
			expect(mockSchemaBuilder.alterTable).not.toHaveBeenCalled();
		});

		test.each([
			['nope', 'author', `Collection "nope" doesn't exist`],
			['articles', 'nope', `Field "nope" doesn't exist in collection "articles"`],
			['articles', 'author', `Field "author" in collection "articles" doesn't have a relationship.`],
		])('%s.%s: %s', async (collection, field, reason) => {
			const service = new RelationsService({ knex: db, schema: buildSchema(), accountability: admin });
			await expect(service.updateOne(collection, field, {})).rejects.toThrow(new InvalidPayloadError({ reason }));
		});
	});

	describe('deleteOne', () => {
		test('drops the foreign key when it exists, deletes the raw metadata row, emits relations.delete', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema([m2o()]), accountability: admin });
			vi.spyOn(service, 'foreignKeys').mockResolvedValue([m2o().schema!]);
			tracker.on.delete('directus_relations').response(1);

			await service.deleteOne('articles', 'author');

			expect(recorder.calls).toEqual([['dropForeign', 'author', 'articles_author_foreign']]);
			expect(tracker.history.delete[0]!.sql).toContain('directus_relations');

			expect(emitter.emitAction).toHaveBeenCalledWith(
				'relations.delete',
				{ payload: ['author'], collection: 'articles' },
				expect.objectContaining({ accountability: admin }),
			);
		});

		test('no foreign key in the database: metadata only', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema([m2o()]), accountability: admin });
			vi.spyOn(service, 'foreignKeys').mockResolvedValue([]);
			tracker.on.delete('directus_relations').response(1);

			await service.deleteOne('articles', 'author');
			expect(mockSchemaBuilder.alterTable).not.toHaveBeenCalled();
		});

		test('non-admin: 403', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema([m2o()]), accountability: user });
			await expect(service.deleteOne('articles', 'author')).rejects.toThrow(ForbiddenError);
		});
	});

	describe('readAll / readOne', () => {
		test('stitches foreign keys and metadata: FK without metadata, metadata without FK, system relations', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema(), accountability: null });
			const meta = { id: 1, many_collection: 'articles', many_field: 'item', one_collection: null } as Relation['meta'];
			vi.mocked(ItemsService).prototype.readByQuery = vi.fn().mockResolvedValue([meta]);
			vi.spyOn(service, 'foreignKeys').mockResolvedValue([m2o().schema!]);

			const relations = await service.readAll();

			expect(relations[0]).toEqual({ ...m2o(), meta: null });
			expect(relations).toContainEqual({
				collection: 'articles',
				field: 'item',
				related_collection: null,
				schema: null,
				meta,
			});
			expect(relations.some((r) => r.collection === 'directus_users' && r.field === 'role')).toBe(true);
		});

		test('readAll(collection) keeps only that collection', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema(), accountability: null });
			vi.mocked(ItemsService).prototype.readByQuery = vi.fn().mockResolvedValue([]);
			vi.spyOn(service, 'foreignKeys').mockResolvedValue([m2o().schema!]);

			const relations = await service.readAll('articles');
			expect(relations.map((r) => `${r.collection}.${r.field}`)).toEqual(['articles.author']);
		});

		test('non-admin: validateAccess on directus_relations, then filterForbidden by allowed fields', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema(), accountability: user });
			vi.mocked(ItemsService).prototype.readByQuery = vi.fn().mockResolvedValue([]);
			vi.spyOn(service, 'foreignKeys').mockResolvedValue([m2o().schema!]);
			vi.mocked(fetchAllowedFieldMap).mockResolvedValue({ articles: ['author'] });

			expect(await service.readAll('articles')).toEqual([]);
			expect(validateAccess).toHaveBeenCalledWith(
				expect.objectContaining({ action: 'read', collection: 'directus_relations' }),
				expect.any(Object),
			);

			vi.mocked(fetchAllowedFieldMap).mockResolvedValue({ articles: ['author'], authors: ['*'] });
			expect(await service.readAll('articles')).toHaveLength(1);
		});

		test('readOne: 403 when the field is not readable or there is no relation', async () => {
			const service = new RelationsService({ knex: db, schema: buildSchema(), accountability: user });
			vi.mocked(fetchAllowedFields).mockResolvedValue(['id']);
			await expect(service.readOne('articles', 'author')).rejects.toThrow(ForbiddenError);

			const adminService = new RelationsService({ knex: db, schema: buildSchema(), accountability: admin });
			vi.mocked(ItemsService).prototype.readByQuery = vi.fn().mockResolvedValue([]);
			vi.spyOn(adminService, 'foreignKeys').mockResolvedValue([]);
			await expect(adminService.readOne('articles', 'author')).rejects.toThrow(ForbiddenError);
		});
	});
});
