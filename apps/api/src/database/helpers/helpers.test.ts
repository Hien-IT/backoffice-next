import knex from 'knex';
import { describe, expect, test, vi } from 'vitest';
import { getDatabaseClient } from '../index.js';
import { getHelpers } from './index.js';

vi.mock('../index.js', () => ({ getDatabaseClient: vi.fn() }));

const db = knex({ client: 'pg' });

function helpersFor(client: string) {
	vi.mocked(getDatabaseClient).mockReturnValue(client as never);
	return getHelpers(db);
}

describe('date helpers (directus/api/src/database/helpers/date)', () => {
	test('writeTimestamp parses ISO strings; MySQL and MSSQL shift by the timezone offset', () => {
		const iso = '2026-10-10T12:00:00.000Z';
		const offset = new Date(iso).getTimezoneOffset() * 60000;

		expect(helpersFor('postgres').date.writeTimestamp(iso).getTime()).toBe(Date.parse(iso));
		expect(helpersFor('mysql').date.writeTimestamp(iso).getTime()).toBe(Date.parse(iso) + offset);
		expect(helpersFor('mssql').date.writeTimestamp(iso).getTime()).toBe(Date.parse(iso) + offset);
	});

	test('parse: SQLite returns epoch milliseconds, Oracle keeps dates, others return ISO strings', () => {
		const date = new Date('2026-10-10T12:00:00.000Z');

		expect(helpersFor('postgres').date.parse(date)).toBe('2026-10-10T12:00:00.000Z');
		expect(helpersFor('sqlite').date.parse(date)).toBe(String(date.getTime()));
		expect(helpersFor('sqlite').date.parse('12:30:00')).toBe('12:30:00');
		expect(helpersFor('oracle').date.parse('2026-10-10')).toBe('2026-10-10');
		expect(helpersFor('oracle').date.parse('2026-10-10T12:00:00Z')).toBe('2026-10-10T12:00:00.000Z');
	});

	test('readTimestampString shifts MySQL values only', () => {
		const value = '2026-10-10T12:00:00.000Z';
		expect(helpersFor('postgres').date.readTimestampString(value)).toBe(value);
		expect(helpersFor('mysql').date.readTimestampString(value)).toBe(
			new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000).toISOString(),
		);
	});

	test('fieldFlagForField per vendor', () => {
		expect(helpersFor('postgres').date.fieldFlagForField('json')).toBe('cast-json');
		expect(helpersFor('sqlite').date.fieldFlagForField('timestamp')).toBe('cast-timestamp');
		expect(helpersFor('oracle').date.fieldFlagForField('dateTime')).toBe('cast-datetime');
		expect(helpersFor('mysql').date.fieldFlagForField('string')).toBe('');
	});
});

describe('schema helper (formatUUID)', () => {
	test('MSSQL upper-cases UUIDs, the other vendors keep them', () => {
		const uuid = 'a3b1c2d4-0000-4000-8000-00000000000a';
		expect(helpersFor('mssql').schema.formatUUID(uuid)).toBe(uuid.toUpperCase());

		for (const client of ['postgres', 'mysql', 'sqlite', 'oracle', 'cockroachdb', 'redshift']) {
			expect(helpersFor(client).schema.formatUUID(uuid)).toBe(uuid);
		}
	});
});
