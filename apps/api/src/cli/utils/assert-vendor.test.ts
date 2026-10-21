import { expect, test, vi } from 'vitest';
import { getDatabaseClient } from '../../database/index.js';
import { unsupportedClient, vendorMessages } from './assert-vendor.js';

vi.mock('../../database/index.js', () => ({ getDatabaseClient: vi.fn() }));

const database = {} as any;

test.each(['postgres', 'sqlite'] as const)('%s is bootstrapped and migrated by Backoffice', (client) => {
	vi.mocked(getDatabaseClient).mockReturnValue(client);
	expect(unsupportedClient(database)).toBeNull();
	expect(getDatabaseClient).toHaveBeenCalledWith(database);
});

test.each(['mysql', 'mssql', 'oracle', 'cockroachdb', 'redshift'] as const)(
	'%s is left to Directus (D-145)',
	(client) => {
		vi.mocked(getDatabaseClient).mockReturnValue(client);
		expect(unsupportedClient(database)).toBe(client);
	},
);

test('the D-145 messages of spec FR-008 and FR-026', () => {
	expect(vendorMessages.bootstrapEmpty('mysql')).toBe(
		'Backoffice bootstraps only Postgres and SQLite databases; on mysql run "node cli.js bootstrap" with the Directus 11.17.4 image (D-145)',
	);
	expect(vendorMessages.bootstrapInstalled('mssql')).toBe(
		'Database on mssql is migrated by Directus 11.17.4 (D-145); skipping migrations',
	);
	expect(vendorMessages.migrate('oracle')).toBe(
		'Backoffice runs migrations only on Postgres and SQLite databases; on oracle use the Directus 11.17.4 image (D-145)',
	);
});
