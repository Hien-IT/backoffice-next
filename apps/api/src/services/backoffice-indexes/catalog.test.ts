// Backoffice (spec 030, D-210): the index catalog of each vendor, read by name only (research R5).
import type { Knex } from 'knex';
import { beforeEach, expect, test, vi } from 'vitest';
import { getDatabaseClient } from '../../database/index.js';
import { isBuilding, listIndexNames } from './catalog.js';

vi.mock('../../database/index.js', () => ({ getDatabaseClient: vi.fn() }));

const client = vi.mocked(getDatabaseClient);
let raw: ReturnType<typeof vi.fn>;
let knex: Knex;

beforeEach(() => {
	raw = vi.fn();
	knex = { raw } as unknown as Knex;
});

test('postgres: pg_index joined to pg_class in the current schema, with indisvalid', async () => {
	client.mockReturnValue('postgres');
	raw.mockResolvedValue({
		rows: [
			{ name: 't_pkey', valid: true, columns: 'id' },
			{ name: 't_a_b_unique', valid: false, columns: 'a,b' },
			{ name: 't_name_trgm', valid: true, columns: null },
		],
	});

	const names = await listIndexNames(knex, 't');

	expect(raw.mock.calls[0]![0]).toMatch(/pg_index/);
	expect(raw.mock.calls[0]![0]).toMatch(/current_schema\(\)/);
	expect(raw.mock.calls[0]![1]).toEqual(['t']);
	expect(names).toEqual(
		new Map([
			['t_pkey', { valid: true, columns: ['id'] }],
			['t_a_b_unique', { valid: false, columns: ['a', 'b'] }],
			['t_name_trgm', { valid: true, columns: [] }],
		]),
	);
});

test('cockroachdb uses the postgres catalog', async () => {
	client.mockReturnValue('cockroachdb');
	raw.mockResolvedValue({ rows: [{ name: 'x', valid: true, columns: 'a' }] });
	expect(await listIndexNames(knex, 't')).toEqual(new Map([['x', { valid: true, columns: ['a'] }]]));
});

test('mysql: information_schema.statistics of the current database', async () => {
	client.mockReturnValue('mysql');
	raw.mockResolvedValue([[{ name: 'PRIMARY', columns: 'id' }, { name: 't_a_b_unique', columns: 'a,b' }]]);

	const names = await listIndexNames(knex, 't');

	expect(raw.mock.calls[0]![0]).toMatch(/information_schema\.statistics/);
	expect(raw.mock.calls[0]![0]).toMatch(/database\(\)/);
	expect(names).toEqual(
		new Map([
			['PRIMARY', { valid: true, columns: ['id'] }],
			['t_a_b_unique', { valid: true, columns: ['a', 'b'] }],
		]),
	);
});

test('sqlite: PRAGMA index_list', async () => {
	client.mockReturnValue('sqlite');
	raw.mockImplementation(async (sql: string) =>
		sql.startsWith('PRAGMA index_list')
			? [{ seq: 0, name: 't_a_b_unique', unique: 1 }]
			: [
					{ seqno: 1, name: 'b' },
					{ seqno: 0, name: 'a' },
				],
	);

	const names = await listIndexNames(knex, 't');

	expect(raw.mock.calls[0]![0]).toMatch(/PRAGMA index_list/);
	expect(raw.mock.calls[1]![0]).toMatch(/PRAGMA index_info/);
	expect(names).toEqual(new Map([['t_a_b_unique', { valid: true, columns: ['a', 'b'] }]]));
});

test('mssql and oracle: null, not checked', async () => {
	client.mockReturnValue('mssql');
	expect(await listIndexNames(knex, 't')).toBeNull();
	client.mockReturnValue('oracle');
	expect(await listIndexNames(knex, 't')).toBeNull();
	expect(raw).not.toHaveBeenCalled();
});

test('isBuilding: pg_stat_progress_create_index on postgres, false elsewhere', async () => {
	client.mockReturnValue('postgres');
	raw.mockResolvedValue({ rows: [{ one: 1 }] });
	expect(await isBuilding(knex, 't_a_b_unique')).toBe(true);
	expect(raw.mock.calls[0]![0]).toMatch(/pg_stat_progress_create_index/);
	expect(raw.mock.calls[0]![1]).toEqual(['t_a_b_unique']);

	raw.mockResolvedValue({ rows: [] });
	expect(await isBuilding(knex, 't_a_b_unique')).toBe(false);

	client.mockReturnValue('mysql');
	expect(await isBuilding(knex, 't_a_b_unique')).toBe(false);
});
