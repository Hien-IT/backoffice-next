// Backoffice (spec 030, D-210.4): a composite unique violation becomes one RecordNotUniqueError per field of the index.
import type { Knex } from 'knex';
import { expect, test } from 'vitest';
import { extractError as mysql } from './dialects/mysql.js';
import { extractError as postgres } from './dialects/postgres.js';
import { extractError as sqlite } from './dialects/sqlite.js';

const data = { provider: 'p1', provider_subject: 's1', email: 'a@b' };

test('postgres: one field as before; several fields in index order with their values', () => {
	const one = postgres(
		{ code: '23505', table: 'users', detail: 'Key (email)=(a@b) already exists.' } as never,
		data,
	) as any;
	expect(one.extensions).toMatchObject({ collection: 'users', field: 'email', value: 'a@b' });

	const many = postgres(
		{
			code: '23505',
			table: 'passenger_auth_identities',
			detail: 'Key (provider, provider_subject)=(p1, s1) already exists.',
		} as never,
		data,
	) as any[];
	expect(Array.isArray(many)).toBe(true);
	expect(many.map((e) => e.extensions)).toEqual([
		{ collection: 'passenger_auth_identities', field: 'provider', value: 'p1' },
		{ collection: 'passenger_auth_identities', field: 'provider_subject', value: 's1' },
	]);
	expect(many.every((e) => e.code === 'RECORD_NOT_UNIQUE')).toBe(true);
});

test('sqlite: `t.a, t.b` becomes one error per field', () => {
	const one = sqlite({ message: 'insert - SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email' } as never, data) as any;
	expect(one.extensions).toMatchObject({ collection: 'users', field: 'email' });

	const many = sqlite(
		{ message: 'insert - SQLITE_CONSTRAINT: UNIQUE constraint failed: t.provider, t.provider_subject' } as never,
		data,
	) as any[];
	expect(many.map((e) => e.extensions)).toEqual([
		{ collection: 't', field: 'provider', value: 'p1' },
		{ collection: 't', field: 'provider_subject', value: 's1' },
	]);
});

function fakeKnex(row: { fields: string | string[] } | undefined, hasTable = true): Knex {
	const builder = { select: () => builder, where: () => builder, first: async () => row };
	return Object.assign(() => builder, { schema: { hasTable: async () => hasTable } }) as unknown as Knex;
}

test('mysql: a one-column key as before; a composite key is looked up in backoffice_indexes', async () => {
	const one = (await mysql(
		{ code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'a@b' for key 'users.users_email_unique'" } as never,
		data,
		fakeKnex(undefined),
	)) as any;
	expect(one.extensions).toMatchObject({ collection: 'users', field: 'email', value: 'a@b' });

	const many = (await mysql(
		{ code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'p1-s1' for key 't.t_provider_provider_subject_unique'" } as never,
		data,
		fakeKnex({ fields: JSON.stringify(['provider', 'provider_subject']) }),
	)) as any[];
	expect(many.map((e) => e.extensions)).toEqual([
		{ collection: 't', field: 'provider', value: 'p1' },
		{ collection: 't', field: 'provider_subject', value: 's1' },
	]);

	// Not a Backoffice index (or no knex): the DR guess from the name stays.
	const guess = (await mysql(
		{ code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'p1-s1' for key 't.t_provider_provider_subject_unique'" } as never,
		data,
		fakeKnex(undefined),
	)) as any;
	expect(guess.extensions).toMatchObject({ collection: 't', field: 'provider_provider_subject' });
	const noKnex = (await mysql(
		{ code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'p1-s1' for key 't.t_provider_provider_subject_unique'" } as never,
		data,
	)) as any;
	expect(noKnex.extensions).toMatchObject({ field: 'provider_provider_subject' });
	const noTable = (await mysql(
		{ code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'p1-s1' for key 't.t_provider_provider_subject_unique'" } as never,
		data,
		fakeKnex(undefined, false),
	)) as any;
	expect(noTable.extensions).toMatchObject({ field: 'provider_provider_subject' });
});
