// Ported from directus/api/src/database/helpers/schema/dialects/postgres.test.ts
import type { Knex } from 'knex';
import { describe, expect, test, vi } from 'vitest';
import { SchemaHelperPostgres } from './postgres.js';

vi.mock('../../index.js', () => ({
	getDatabaseClient: vi.fn(),
}));

describe('SchemaHelperPostgres', () => {
	function createHelper() {
		const mockKnex = { raw: vi.fn() } as unknown as Knex;
		const helper = new SchemaHelperPostgres(mockKnex);
		return { helper, mockKnex };
	}

	test('createIndex creates a standard index without options', async () => {
		const { helper, mockKnex } = createHelper();
		await helper.createIndex('users', 'email');

		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE INDEX ?? ON ?? (??)', ['users_email_index', 'users', 'email']);
	});

	test('createIndex creates a unique index when unique option is true', async () => {
		const { helper, mockKnex } = createHelper();
		await helper.createIndex('users', 'email', { unique: true });

		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE UNIQUE INDEX ?? ON ?? (??)', [
			'users_email_unique',
			'users',
			'email',
		]);
	});

	test('createIndex creates a standard index when unique option is false', async () => {
		const { helper, mockKnex } = createHelper();
		await helper.createIndex('products', 'sku', { unique: false });

		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE INDEX ?? ON ?? (??)', ['products_sku_index', 'products', 'sku']);
	});

	test('createIndex creates a concurrent index when attemptConcurrentIndex is true', async () => {
		const { helper, mockKnex } = createHelper();
		await helper.createIndex('orders', 'status', { attemptConcurrentIndex: true });

		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE INDEX CONCURRENTLY ?? ON ?? (??)', [
			'orders_status_index',
			'orders',
			'status',
		]);
	});

	test('createIndex creates a concurrent unique index when both options are true', async () => {
		const { helper, mockKnex } = createHelper();
		await helper.createIndex('users', 'username', { attemptConcurrentIndex: true, unique: true });

		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE UNIQUE INDEX CONCURRENTLY ?? ON ?? (??)', [
			'users_username_unique',
			'users',
			'username',
		]);
	});

	test('createIndex creates a concurrent standard index when attemptConcurrentIndex is true and unique is false', async () => {
		const { helper, mockKnex } = createHelper();
		await helper.createIndex('posts', 'author_id', { attemptConcurrentIndex: true, unique: false });

		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE INDEX CONCURRENTLY ?? ON ?? (??)', [
			'posts_author_id_index',
			'posts',
			'author_id',
		]);
	});

	// Backoffice (spec 030, D-210): several columns and the trigram kind.
	test('createIndex with several fields lists them in order (spec 030)', async () => {
		const { helper, mockKnex } = createHelper();
		await helper.createIndex('t', ['provider', 'provider_subject'], { unique: true, attemptConcurrentIndex: true });

		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE UNIQUE INDEX CONCURRENTLY ?? ON ?? (??, ??)', [
			't_provider_provider_subject_unique',
			't',
			'provider',
			'provider_subject',
		]);
	});

	test('createIndex trigram is a GIN index on lower(column) with gin_trgm_ops (spec 030)', async () => {
		const { helper, mockKnex } = createHelper();
		await helper.createIndex('t', 'name', { type: 'trigram' });
		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE INDEX ?? ON ?? USING gin (lower(??) gin_trgm_ops)', [
			't_name_trgm',
			't',
			'name',
		]);

		await helper.createIndex('t', ['name'], { type: 'trigram', attemptConcurrentIndex: true });
		expect(mockKnex.raw).toHaveBeenCalledWith(
			'CREATE INDEX CONCURRENTLY ?? ON ?? USING gin (lower(??) gin_trgm_ops)',
			['t_name_trgm', 't', 'name'],
		);
	});

	test('createIndex trigram refuses several fields or unique (spec 030)', async () => {
		const { helper } = createHelper();
		await expect(helper.createIndex('t', ['a', 'b'], { type: 'trigram' })).rejects.toThrow();
		await expect(helper.createIndex('t', 'a', { type: 'trigram', unique: true })).rejects.toThrow();
	});

	test('createIndex handles empty options object', async () => {
		const { helper, mockKnex } = createHelper();
		await helper.createIndex('categories', 'name', {});

		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE INDEX ?? ON ?? (??)', [
			'categories_name_index',
			'categories',
			'name',
		]);
	});

	test('createIndex works with different collection and field names', async () => {
		const { helper, mockKnex } = createHelper();
		await helper.createIndex('my_custom_table', 'my_custom_column');

		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE INDEX ?? ON ?? (??)', [
			'my_custom_table_my_custom_column_index',
			'my_custom_table',
			'my_custom_column',
		]);
	});
});
