import { useEnv } from '@backoffice/env';
import knex from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useLogger } from '../logger/index.js';
import { useMetrics } from '../metrics/index.js';
import { validateEnv } from '../utils/validate-env.js';

vi.mock('@backoffice/env');
vi.mock('../logger/index.js');
vi.mock('../metrics/index.js');
vi.mock('../utils/validate-env.js');
vi.mock('knex');

const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn() };
const observe = vi.fn();
const handlers: Record<string, (...args: any[]) => void> = {};

function fakeKnex(clientName = 'Client_PG', raw = vi.fn().mockResolvedValue([])) {
	const db: any = vi.fn();
	db.client = { constructor: { name: clientName } };
	db.raw = raw;
	db.on = vi.fn((event: string, handler: any) => ((handlers[event] = handler), db));
	return db;
}

async function load(env: Record<string, unknown>, db = fakeKnex()) {
	vi.mocked(useEnv).mockReturnValue(env);
	vi.mocked(knex).mockReturnValue(db);
	(knex as any).default = knex;
	return { mod: await import('./index.js'), db, config: () => vi.mocked(knex).mock.calls[0]![0] as any };
}

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(useMetrics).mockReturnValue({ getDatabaseResponseMetric: () => ({ observe }) } as any);
});

afterEach(() => vi.restoreAllMocks());

const pg = { DB_CLIENT: 'pg', DB_HOST: 'h', DB_PORT: 5432, DB_DATABASE: 'd', DB_USER: 'u', DB_PASSWORD: 'p' };

describe('getDatabase() knex config per client', () => {
	test('pg: connection from DB_*, required vars, cached instance', async () => {
		const { mod, config } = await load(pg);
		const db = mod.getDatabase();
		expect(mod.getDatabase()).toBe(db);
		expect(knex).toHaveBeenCalledOnce();
		expect(config()).toMatchObject({
			client: 'pg',
			connection: { host: 'h', port: 5432, database: 'd', user: 'u', password: 'p' },
		});
		expect(validateEnv).toHaveBeenCalledWith(['DB_CLIENT', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USER']);
	});

	test('pg with DB_CONNECTION_STRING', async () => {
		const { mod, config } = await load({ DB_CLIENT: 'pg', DB_CONNECTION_STRING: 'postgres://x' });
		mod.getDatabase();
		expect(config().connection).toBe('postgres://x');
		expect(validateEnv).toHaveBeenCalledWith(['DB_CLIENT', 'DB_CONNECTION_STRING']);
	});

	test('mysql → mysql2, Docker default `filename` removed', async () => {
		const { mod, config } = await load({
			...pg,
			DB_CLIENT: 'mysql',
			DB_FILENAME: '/backoffice/database/database.sqlite',
		});
		mod.getDatabase();
		expect(config().client).toBe('mysql2');
		expect(config().connection).not.toHaveProperty('filename');
		expect(validateEnv).toHaveBeenCalledWith([
			'DB_CLIENT',
			'DB_HOST',
			'DB_PORT',
			'DB_DATABASE',
			'DB_USER',
			'DB_PASSWORD',
		]);
	});

	test('mysql with DB_SOCKET_PATH', async () => {
		const { mod } = await load({
			DB_CLIENT: 'mysql',
			DB_SOCKET_PATH: '/s',
			DB_DATABASE: 'd',
			DB_USER: 'u',
			DB_PASSWORD: 'p',
		});
		mod.getDatabase();
		expect(validateEnv).toHaveBeenCalledWith(['DB_CLIENT', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD', 'DB_SOCKET_PATH']);
	});

	test('mssql: useUTC false', async () => {
		const { mod, config } = await load({ ...pg, DB_CLIENT: 'mssql' });
		mod.getDatabase();
		expect(config().connection.options).toEqual({ useUTC: false });
		expect(validateEnv).toHaveBeenCalledWith([
			'DB_CLIENT',
			'DB_HOST',
			'DB_PORT',
			'DB_DATABASE',
			'DB_USER',
			'DB_PASSWORD',
		]);
	});

	test('mssql with DB_TYPE other than default needs no host vars', async () => {
		const { mod } = await load({ DB_CLIENT: 'mssql', DB_TYPE: 'azure-active-directory-msi-app-service' });
		mod.getDatabase();
		expect(validateEnv).toHaveBeenCalledWith(['DB_CLIENT']);
	});

	test('sqlite3: useNullAsDefault and PRAGMA foreign_keys on each connection', async () => {
		const { mod, config } = await load({ DB_CLIENT: 'sqlite3', DB_FILENAME: 'a.db' });
		mod.getDatabase();
		expect(config().useNullAsDefault).toBe(true);
		expect(validateEnv).toHaveBeenCalledWith(['DB_CLIENT', 'DB_FILENAME']);

		const conn = { run: vi.fn() };
		const cb = vi.fn();
		config().pool.afterCreate(conn, cb);
		expect(conn.run).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
		expect(cb).toHaveBeenCalledWith(null, conn);
	});

	test('cockroachdb: session SETs on each connection', async () => {
		const { mod, config } = await load({ ...pg, DB_CLIENT: 'cockroachdb' });
		mod.getDatabase();
		const conn = { query: vi.fn() };
		config().pool.afterCreate(conn, vi.fn());
		expect(conn.query.mock.calls).toEqual([
			['SET serial_normalization = "sql_sequence"'],
			['SET default_int_size = 4'],
		]);
	});

	test('oracledb: NLS formats on each connection; DB_CONNECT_STRING variant', async () => {
		const { mod, config } = await load({
			DB_CLIENT: 'oracledb',
			DB_USER: 'u',
			DB_PASSWORD: 'p',
			DB_CONNECT_STRING: 'h:1/XE',
		});
		mod.getDatabase();
		expect(validateEnv).toHaveBeenCalledWith(['DB_CLIENT', 'DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING']);
		const conn = { execute: vi.fn() };
		config().pool.afterCreate(conn, vi.fn());
		expect(conn.execute.mock.calls).toEqual([
			['ALTER SESSION SET NLS_TIMESTAMP_FORMAT = \'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"\''],
			["ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD'"],
		]);
	});

	test('oracledb without DB_CONNECT_STRING needs host vars', async () => {
		const { mod } = await load({ ...pg, DB_CLIENT: 'oracledb' });
		mod.getDatabase();
		expect(validateEnv).toHaveBeenCalledWith([
			'DB_CLIENT',
			'DB_HOST',
			'DB_PORT',
			'DB_DATABASE',
			'DB_USER',
			'DB_PASSWORD',
		]);
	});

	test('unknown client requires the full set', async () => {
		const { mod } = await load({ ...pg, DB_CLIENT: 'other' });
		mod.getDatabase();
		expect(validateEnv).toHaveBeenCalledWith([
			'DB_CLIENT',
			'DB_HOST',
			'DB_PORT',
			'DB_DATABASE',
			'DB_USER',
			'DB_PASSWORD',
		]);
	});

	test('knex log hooks: noisy warnings dropped, others forwarded', async () => {
		const { mod, config } = await load(pg);
		mod.getDatabase();
		const log = config().log;
		log.warn('.returning() is not supported');
		log.warn('x does not currently support RETURNING clause');
		log.warn('Transaction was implicitly committed, do not mix transactions and DDL with MySQL');
		log.warn('real warning');
		log.error('e');
		log.deprecate('d');
		log.debug('g');
		expect(logger.warn).toHaveBeenCalledExactlyOnceWith('real warning');
		expect(logger.error).toHaveBeenCalledWith('e');
		expect(logger.info).toHaveBeenCalledWith('d');
		expect(logger.debug).toHaveBeenCalledWith('g');
	});

	test('query timing goes to the DB response metric and the trace log', async () => {
		const { mod } = await load(pg);
		mod.getDatabase();
		handlers['query']!({ __knexUid: 'q1' });
		handlers['query-response']!(null, { __knexUid: 'q1', sql: 'select ?', bindings: [1] });
		expect(observe).toHaveBeenCalledOnce();
		expect(logger.trace).toHaveBeenLastCalledWith(expect.stringMatching(/^\[\d+\.\d{3}ms\] select \? \[1\]$/));

		handlers['query-response']!(null, { __knexUid: 'unknown', sql: 's', bindings: { a: 2 } });
		expect(logger.trace).toHaveBeenLastCalledWith('[?ms] s [2]');

		handlers['query']!({ __knexUid: 'q2' });
		handlers['query-error']!(null, { __knexUid: 'q2' });
		handlers['query-response']!(null, { __knexUid: 'q2', sql: 's' });
		expect(observe).toHaveBeenCalledOnce();
	});
});

describe('client helpers', () => {
	test.each([
		['Client_MySQL2', 'mysql'],
		['Client_PG', 'postgres'],
		['Client_CockroachDB', 'cockroachdb'],
		['Client_SQLite3', 'sqlite'],
		['Client_Oracledb', 'oracle'],
		['Client_Oracle', 'oracle'],
		['Client_MSSQL', 'mssql'],
		['Client_Redshift', 'redshift'],
	])('getDatabaseClient(%s) = %s', async (name, expected) => {
		const { mod } = await load(pg);
		expect(mod.getDatabaseClient(fakeKnex(name))).toBe(expected);
	});

	test('getDatabaseClient throws for an unknown client', async () => {
		const { mod } = await load(pg);
		expect(() => mod.getDatabaseClient(fakeKnex('Nope'))).toThrow("Couldn't extract database client");
	});

	test('hasDatabaseConnection: SELECT 1, Oracle uses DUAL, false on error', async () => {
		const { mod } = await load(pg);
		const ok = fakeKnex('Client_PG');
		expect(await mod.hasDatabaseConnection(ok)).toBe(true);
		expect(ok.raw).toHaveBeenCalledWith('SELECT 1');

		const oracle = fakeKnex('Client_Oracledb');
		await mod.hasDatabaseConnection(oracle);
		expect(oracle.raw).toHaveBeenCalledWith('select 1 from DUAL');

		expect(await mod.hasDatabaseConnection(fakeKnex('Client_PG', vi.fn().mockRejectedValue(new Error('down'))))).toBe(
			false,
		);
	});

	test("validateDatabaseConnection: logs Can't connect and exits 1", async () => {
		const { mod } = await load(pg);
		const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
		const error = new Error('down');
		await mod.validateDatabaseConnection(fakeKnex('Client_PG', vi.fn().mockRejectedValue(error)));
		expect(logger.error).toHaveBeenNthCalledWith(1, "Can't connect to the database.");
		expect(logger.error).toHaveBeenNthCalledWith(2, error);
		expect(exit).toHaveBeenCalledWith(1);

		exit.mockClear();
		await mod.validateDatabaseConnection(fakeKnex('Client_Oracle'));
		expect(exit).not.toHaveBeenCalled();
	});

	test('getSchemaInspector caches the inspector', async () => {
		const { mod } = await load({ DB_CLIENT: 'sqlite3', DB_FILENAME: 'a.db' }, fakeKnex('Client_SQLite3'));
		const inspector = mod.getSchemaInspector();
		expect(mod.getSchemaInspector()).toBe(inspector);
	});
});

describe('MySQL collation check (validateDatabaseCharset, called without await like Directus)', () => {
	test('warns with the tables and columns that differ', async () => {
		const db = fakeKnex('Client_MySQL2');

		const query = (rows: unknown) => {
			const q: any = {};
			q.select = vi.fn(() => q);
			q.where = vi.fn(() => q);
			q.whereNot = vi.fn(() => q);
			q.first = vi.fn(async () => rows);
			q.then = (resolve: any) => Promise.resolve(rows).then(resolve);
			return q;
		};

		db.select = vi.fn(() => query({ collation: 'utf8mb4_unicode_ci' }));

		db.mockImplementation((table: string) =>
			table === 'information_schema.tables'
				? query([
						{ name: 'a', collation: 'latin1' },
						{ name: 'b', collation: 'utf8mb4_unicode_ci' },
						{ name: 'skip', collation: 'latin1' },
					])
				: query([{ table_name: 'b', name: 'c', collation: 'latin1' }]),
		);

		const { mod } = await load({ ...pg, DB_CLIENT: 'mysql', DB_EXCLUDE_TABLES: ['skip'] }, db);
		mod.getDatabase();
		await vi.waitFor(() => expect(logger.warn).toHaveBeenCalled());

		expect(logger.warn).toHaveBeenCalledWith(
			`Some tables and columns do not match your database's default collation (utf8mb4_unicode_ci):\n` +
				`\t\t- Table "a": "latin1"\n\t\t- Table "b": "utf8mb4_unicode_ci"\n\t\t  - Column "c": "latin1"\n`,
		);
	});
});

describe('isInstalled and validateDatabaseExtensions', () => {
	test('isInstalled checks directus_collections through the inspector', async () => {
		const { default: realKnex } = await vi.importActual<typeof import('knex')>('knex');
		const db = realKnex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
		const { mod } = await load({ DB_CLIENT: 'sqlite3', DB_FILENAME: ':memory:' }, db as any);
		mod.getDatabase();
		expect(await mod.isInstalled()).toBe(false);
		await db.schema.createTable('directus_collections', (t) => t.string('collection'));
		expect(await mod.isInstalled()).toBe(true);
		await db.destroy();
	});

	test.each([
		['Client_PG', "PostGIS isn't installed. Geometry type support will be limited."],
		['Client_SQLite3', "Spatialite isn't installed. Geometry type support will be limited."],
	])('%s without geometry support warns', async (client, message) => {
		const db = fakeKnex(client);
		db.select = vi.fn(() => ({ from: () => ({ where: async () => [] }) }));
		const { mod } = await load(client === 'Client_PG' ? pg : { DB_CLIENT: 'sqlite3', DB_FILENAME: 'a.db' }, db);
		await mod.validateDatabaseExtensions();
		expect(logger.warn).toHaveBeenCalledWith(message);
	});

	test('with geometry support: no warning', async () => {
		const db = fakeKnex('Client_PG');
		db.select = vi.fn(() => ({ from: () => ({ where: async () => [{ oid: 1 }] }) }));
		const { mod } = await load(pg, db);
		await mod.validateDatabaseExtensions();
		expect(logger.warn).not.toHaveBeenCalled();
	});
});
