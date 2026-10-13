// Feature 010 (T035): UtilsService (port of directus/api/src/services/utils.ts, which Directus does not unit test). sort
// runs on an in-memory SQLite table; the permission checks, the caches and the emitter are mocked.
import { ForbiddenError } from '@backoffice/errors';
import { SchemaBuilder } from '@backoffice/schema-builder';
import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearSystemCache, getCache } from '../cache.js';
import emitter from '../emitter.js';
import { fetchAllowedFields } from '../permissions/modules/fetch-allowed-fields/fetch-allowed-fields.js';
import { validateAccess } from '../permissions/modules/validate-access/validate-access.js';
import { UtilsService } from './utils.service.js';

const cache = vi.hoisted(() => ({ clear: vi.fn() }));

vi.mock('../cache.js', () => ({ getCache: vi.fn(() => ({ cache })), clearSystemCache: vi.fn() }));
vi.mock('../emitter.js', () => ({ default: { emitAction: vi.fn() } }));
vi.mock('../utils/should-clear-cache.js', () => ({ shouldClearCache: () => true }));
vi.mock('../permissions/modules/validate-access/validate-access.js', () => ({ validateAccess: vi.fn() }));
vi.mock('../permissions/modules/fetch-allowed-fields/fetch-allowed-fields.js', () => ({ fetchAllowedFields: vi.fn() }));

const schema = new SchemaBuilder()
	.collection('articles', (c) => {
		c.field('id').id();
		c.field('sort').integer();
	})
	.build();

let db: Knex;

beforeEach(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
	await db.schema.createTable('directus_collections', (t) => {
		t.string('collection').primary();
		t.string('sort_field');
	});
	await db.schema.createTable('articles', (t) => {
		t.increments('id');
		t.integer('sort');
	});
	await db('directus_collections').insert({ collection: 'articles', sort_field: 'sort' });
});

afterEach(async () => {
	vi.clearAllMocks();
	await db.destroy();
});

const service = (accountability: any = null) => new UtilsService({ knex: db, schema, accountability });
const order = async () => (await db('articles').select('id').orderBy('sort')).map((row) => row.id);

describe('sort', () => {
	test('moves an item down and up, the other rows shift by one', async () => {
		await db('articles').insert([1, 2, 3, 4].map((id) => ({ id, sort: id })));

		await service().sort('articles', { item: 1, to: 3 });
		expect(await order()).toEqual([2, 3, 1, 4]);

		await service().sort('articles', { item: 4, to: 2 });
		expect(await order()).toEqual([4, 2, 3, 1]);

		expect(cache.clear).toHaveBeenCalledTimes(2);
		expect(emitter.emitAction).toHaveBeenCalledWith(
			['items.sort', 'articles.items.sort'],
			{ collection: 'articles', item: 4, to: 2 },
			expect.objectContaining({ accountability: null }),
		);
	});

	test('rows without a sort value get one after the max, duplicates are renumbered first', async () => {
		await db('articles').insert([
			{ id: 1, sort: 1 },
			{ id: 2, sort: 1 },
			{ id: 3, sort: null },
		]);

		await service().sort('articles', { item: 3, to: 1 });

		expect(await db('articles').select('id', 'sort').orderBy('id')).toEqual([
			{ id: 1, sort: 2 },
			{ id: 2, sort: 3 },
			{ id: 3, sort: 1 },
		]);
	});

	test('a collection without a sort field (system collections included) → 400', async () => {
		await expect(service().sort('directus_users', { item: 1, to: 2 })).rejects.toMatchObject({
			code: 'INVALID_PAYLOAD',
			extensions: { reason: `Collection "directus_users" doesn't have a sort field` },
		});
	});

	test('non-admin: update access and the sort field must be allowed', async () => {
		await db('articles').insert([1, 2].map((id) => ({ id, sort: id })));
		const accountability = { user: 'u', role: null, admin: false };

		vi.mocked(fetchAllowedFields).mockResolvedValueOnce(['id']);
		await expect(service(accountability).sort('articles', { item: 1, to: 2 })).rejects.toBeInstanceOf(ForbiddenError);
		expect(validateAccess).toHaveBeenCalledWith(
			{ accountability, action: 'update', collection: 'articles' },
			{ schema, knex: db },
		);

		vi.mocked(fetchAllowedFields).mockResolvedValueOnce(['sort']);
		await service(accountability).sort('articles', { item: 1, to: 2 });
		expect(await order()).toEqual([2, 1]);
	});

	test('an item that does not exist: TypeError, like Directus (no row to read the sort value from)', async () => {
		await db('articles').insert([1, 2].map((id) => ({ id, sort: id })));
		await expect(service().sort('articles', { item: 1, to: 99 })).rejects.toBeInstanceOf(TypeError);
	});
});

describe('clearCache', () => {
	test('admin only; the system cache only when asked', async () => {
		await expect(service({ admin: false }).clearCache({ system: false })).rejects.toBeInstanceOf(ForbiddenError);

		await service({ admin: true }).clearCache({ system: false });
		expect(clearSystemCache).not.toHaveBeenCalled();
		expect(cache.clear).toHaveBeenCalledOnce();

		await service({ admin: true }).clearCache({ system: true });
		expect(clearSystemCache).toHaveBeenCalledWith({ forced: true });
		expect(getCache).toHaveBeenCalled();
	});
});
