import knex from 'knex';
import { createTracker, MockClient } from 'knex-mock-client';
import { describe, expect, test, vi } from 'vitest';
import getDatabase, { getDatabaseClient } from '../index.js';
import { translateDatabaseError } from './translate.js';

vi.mock('../index.js', () => ({ default: vi.fn(), getDatabaseClient: vi.fn() }));

const code = (error: unknown) => (error as { code?: string }).code;
const ext = (error: unknown) => (error as { extensions?: unknown }).extensions;

async function translate(client: string, error: Record<string, unknown>, data: Record<string, unknown> = {}) {
	vi.mocked(getDatabaseClient).mockReturnValue(client as never);
	return translateDatabaseError(error as never, data);
}

describe('translateDatabaseError (directus/api/src/database/errors)', () => {
	test('postgres and cockroachdb', async () => {
		const unique = await translate(
			'postgres',
			{ code: '23505', table: 'directus_users', detail: 'Key (email)=(a@example.com) already exists.' },
			{ email: 'a@example.com' },
		);

		expect(code(unique)).toBe('RECORD_NOT_UNIQUE');
		expect(ext(unique)).toMatchObject({ collection: 'directus_users', field: 'email', value: 'a@example.com' });

		const range = await translate('cockroachdb', { code: '22003', message: 'value "x" field "n"' }, { n: 1 });
		expect(code(range)).toBe('VALUE_OUT_OF_RANGE');

		const long = await translate('postgres', { code: '22001', message: 'too long "t" "f"' });
		expect(code(long)).toBe('VALUE_TOO_LONG');

		expect(code(await translate('postgres', { code: '23502', table: 't', column: 'c', message: 'x' }))).toBe(
			'NOT_NULL_VIOLATION',
		);

		expect(
			code(await translate('postgres', { code: '23502', table: 't', column: 'c', message: 'contains null values' })),
		).toBe('CONTAINS_NULL_VALUES');

		expect(code(await translate('postgres', { code: '23503', table: 't', detail: 'Key (role)=(x)' }))).toBe(
			'INVALID_FOREIGN_KEY',
		);

		const other = { code: '99999', message: 'other' };
		expect(await translate('postgres', other)).toBe(other);
		expect(await translate('postgres', { code: '23505', table: 't', detail: 'no parens' })).toMatchObject({
			code: '23505',
		});
	});

	test('mysql', async () => {
		const mysql8 = await translate(
			'mysql',
			{ code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'a' for key 'directus_users.directus_users_email_unique'" },
			{ email: 'a' },
		);

		expect(ext(mysql8)).toMatchObject({ collection: 'directus_users', field: 'email', value: 'a' });

		const maria = await translate('mysql', { code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry '1' for key 'PRIMARY'" });
		expect(ext(maria)).toMatchObject({ field: null, primaryKey: true });

		const sql = 'insert into `articles` (`n`) values (?)';
		expect(code(await translate('mysql', { code: 'ER_WARN_DATA_OUT_OF_RANGE', sql, sqlMessage: "column 'n'" }))).toBe(
			'VALUE_OUT_OF_RANGE',
		);
		expect(code(await translate('mysql', { code: 'ER_DATA_TOO_LONG', sql, sqlMessage: "column 'n'" }))).toBe(
			'VALUE_TOO_LONG',
		);
		expect(code(await translate('mysql', { code: 'ER_BAD_NULL_ERROR', sql, sqlMessage: "column 'n'" }))).toBe(
			'NOT_NULL_VIOLATION',
		);

		const fk = await translate('mysql', {
			code: 'ER_NO_REFERENCED_ROW_2',
			sql: 'insert into `a` (`b`) values (1)',
			sqlMessage: 'a foreign key constraint fails (`db`.`a`, CONSTRAINT `fk` FOREIGN KEY (`b`) REFERENCES `c` (`id`))',
		});

		expect(code(fk)).toBe('INVALID_FOREIGN_KEY');
		expect(code(await translate('mysql', { code: 'ER_INVALID_USE_OF_NULL', sql: 'alter table `t` modify `c`' }))).toBe(
			'CONTAINS_NULL_VALUES',
		);

		const other = { code: 'OTHER' };
		expect(await translate('mysql', other)).toBe(other);
	});

	test('sqlite', async () => {
		expect(
			code(await translate('sqlite', { message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed: directus_users.email' })),
		).toBe('RECORD_NOT_UNIQUE');

		expect(
			code(await translate('sqlite', { message: 'SQLITE_CONSTRAINT: NOT NULL constraint failed: articles.title' })),
		).toBe('NOT_NULL_VIOLATION');

		expect(
			code(
				await translate('sqlite', { message: 'SQLITE_CONSTRAINT: NOT NULL constraint failed: _knex_temp_alter1.title' }),
			),
		).toBe('CONTAINS_NULL_VALUES');

		expect(code(await translate('sqlite', { message: 'SQLITE_CONSTRAINT: FOREIGN KEY constraint failed' }))).toBe(
			'INVALID_FOREIGN_KEY',
		);

		const other = { message: 'SQLITE_BUSY' };
		expect(await translate('sqlite', other)).toBe(other);
	});

	test('oracle', async () => {
		expect(code(await translate('oracle', { errorNum: 2296, message: 'cannot enable ("A"."T"."C")' }))).toBe(
			'CONTAINS_NULL_VALUES',
		);

		const other = { errorNum: 1 };
		expect(await translate('oracle', other)).toBe(other);
	});

	test('mssql', async () => {
		const db = knex({ client: MockClient });
		const tracker = createTracker(db);
		vi.mocked(getDatabase).mockReturnValue(db);
		tracker.on.select(() => true).response({ field: 'email', collection: 'directus_users' });

		const unique = await translate(
			'mssql',
			{
				number: 2627,
				message:
					"Violation of UNIQUE KEY constraint 'directus_users_email_unique'. Cannot insert duplicate key in object 'dbo.directus_users'. The duplicate key value is (a).",
			},
			{ email: 'a' },
		);

		expect(ext(unique)).toMatchObject({ collection: 'directus_users', field: 'email', value: 'a' });

		expect(
			code(await translate('mssql', { number: 220, message: 'insert into [t] ([n]) values (@p0) - Arithmetic overflow' })),
		).toBe('VALUE_OUT_OF_RANGE');

		expect(code(await translate('mssql', { number: 2628, message: "insert into [t] - String 'x' column 'c'" }))).toBe(
			'VALUE_TOO_LONG',
		);

		expect(code(await translate('mssql', { number: 515, message: "insert into [t] - column 'c' cannot be null" }))).toBe(
			'NOT_NULL_VIOLATION',
		);

		expect(
			code(
				await translate('mssql', {
					number: 547,
					message: 'conflicted with the FOREIGN KEY constraint "FK__articles__author__1" (x)',
				}),
			),
		).toBe('INVALID_FOREIGN_KEY');

		const other = { number: 1 };
		expect(await translate('mssql', other)).toBe(other);
	});
});
