import { expect, test } from 'vitest';
import { DatabaseClients } from './database.js';

test('lists the database clients Directus 11.17.4 knows', () => {
	expect(DatabaseClients).toEqual(['mysql', 'postgres', 'cockroachdb', 'sqlite', 'oracle', 'mssql', 'redshift']);
});
