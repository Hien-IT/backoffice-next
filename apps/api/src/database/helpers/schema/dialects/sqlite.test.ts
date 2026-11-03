// Ported from directus/api/src/database/helpers/schema/dialects/sqlite.test.ts
import type { Knex } from 'knex';
import { describe, expect, test, vi } from 'vitest';
import { SchemaHelperSQLite } from './sqlite.js';

vi.mock('../../index.js', () => ({
	getDatabaseClient: vi.fn(),
}));

describe('SchemaHelperSQLite', () => {
	function createHelper() {
		const mockKnex = { raw: vi.fn() } as unknown as Knex;
		const helper = new SchemaHelperSQLite(mockKnex);
		return { helper, mockKnex };
	}

	test('createIndex creates a standard index without options', async () => {
		const { helper, mockKnex } = createHelper();

		await helper.createIndex('users', 'email');

		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE INDEX ?? ON ?? (??)', ['users_email_index', 'users', 'email']);
	});

	// Backoffice (spec 030, D-210): the base helper takes several columns and drops an index by name.
	test('createIndex with several fields (spec 030)', async () => {
		const { helper, mockKnex } = createHelper();
		await helper.createIndex('t', ['a', 'b']);

		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE INDEX ?? ON ?? (??, ??)', ['t_a_b_index', 't', 'a', 'b']);
	});

	test('createIndex trigram needs PostgreSQL (spec 030)', async () => {
		const { helper } = createHelper();
		await expect(helper.createIndex('t', 'a', { type: 'trigram' })).rejects.toThrow(/PostgreSQL/);
	});

	test('dropIndex drops by name through the schema builder (spec 030)', async () => {
		const dropIndex = vi.fn();
		const alterTable = vi.fn(async (_t: string, cb: (b: { dropIndex: typeof dropIndex }) => void) => cb({ dropIndex }));
		const helper = new SchemaHelperSQLite({ raw: vi.fn(), schema: { alterTable } } as unknown as Knex);

		await helper.dropIndex('t', 't_a_b_unique');

		expect(alterTable).toHaveBeenCalledWith('t', expect.any(Function));
		expect(dropIndex).toHaveBeenCalledWith([], 't_a_b_unique');
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

	test('createIndex ignores attemptConcurrentIndex option', async () => {
		const { helper, mockKnex } = createHelper();

		await helper.createIndex('orders', 'status', { attemptConcurrentIndex: true });

		// SQLite doesn't override createIndex, so it uses base implementation which doesn't support CONCURRENTLY
		expect(mockKnex.raw).toHaveBeenCalledWith('CREATE INDEX ?? ON ?? (??)', [
			'orders_status_index',
			'orders',
			'status',
		]);
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
});
