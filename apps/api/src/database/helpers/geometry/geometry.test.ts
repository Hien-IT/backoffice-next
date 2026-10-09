import knex from 'knex';
import { describe, expect, test, vi } from 'vitest';
import * as geometry from './index.js';

function fakeKnex(rows: unknown[]) {
	const where = vi.fn(async () => rows);
	const from = vi.fn(() => ({ where }));
	return { db: { select: vi.fn(() => ({ from })) } as any, from, where };
}

describe('supported()', () => {
	test.each([
		['postgres', 'pg_proc', { proname: 'postgis_version' }],
		['cockroachdb', 'pg_proc', { proname: 'postgis_version' }],
		['sqlite', 'pragma_function_list', { name: 'spatialite_version' }],
	] as const)('%s reads %s', async (client, table, where) => {
		const yes = fakeKnex([{}]);
		expect(await new geometry[client](yes.db).supported()).toBe(true);
		expect(yes.from).toHaveBeenCalledWith(table);
		expect(yes.where).toHaveBeenCalledWith(where);

		expect(await new geometry[client](fakeKnex([]).db).supported()).toBe(false);
	});

	test.each(['mysql', 'mssql', 'oracle', 'redshift'] as const)('%s is always supported', async (client) => {
		expect(await new geometry[client]({} as any).supported()).toBe(true);
	});

	test('SQLite without Spatialite (real in-memory database) → false', async () => {
		const db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
		expect(await new geometry.sqlite(db).supported()).toBe(false);
		await db.destroy();
	});
});
