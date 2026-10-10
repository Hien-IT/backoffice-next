import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { transaction } from './transaction.js';

vi.mock('../logger/index.js', () => ({ useLogger: () => ({ trace: vi.fn() }) }));

let db: Knex;

beforeAll(() => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
});

afterAll(() => db.destroy());

describe('transaction', () => {
	test('runs the handler in a new transaction, and reuses a running one', async () => {
		await transaction(db, async (trx) => {
			expect(trx.isTransaction).toBe(true);
			await transaction(trx, async (inner) => expect(inner).toBe(trx));
		});
	});

	test('retries a transaction that failed with SQLITE_BUSY', async () => {
		let calls = 0;

		const result = await transaction(db, async () => {
			calls++;
			if (calls === 1) throw Object.assign(new Error('busy'), { code: 'SQLITE_BUSY' });
			return 'done';
		});

		expect(result).toBe('done');
		expect(calls).toBe(2);
	});

	test('does not retry other errors, and stops after 3 retries', async () => {
		await expect(transaction(db, async () => Promise.reject(new Error('other')))).rejects.toThrow('other');

		await expect(
			transaction(db, async () => Promise.reject(Object.assign(new Error('busy'), { code: 'SQLITE_BUSY' }))),
		).rejects.toThrow('Transaction failed after 4 attempts');
	}, 10_000);
});
