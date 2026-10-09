import { expect, test } from 'vitest';
import { appPorts, knexConfig, names, profilePorts } from './config.js';
import { allVendors, getDbsToTest } from './get-dbs-to-test.js';
import { FULL_FILES, REDUCED_FILES, parseSuite, suiteFiles } from './suite.js';

test('getDbsToTest reads TEST_DB (comma separated), defaults to postgres, rejects unknown vendors', () => {
	expect(getDbsToTest('mysql')).toEqual(['mysql']);
	expect(getDbsToTest('postgres, sqlite3')).toEqual(['postgres', 'sqlite3']);
	expect(getDbsToTest(undefined)).toEqual(['postgres']);
	expect(() => getDbsToTest('db2')).toThrow('No e2e testing capabilities for vendor "db2".');
});

test('the 9 vendors of directus/tests/blackbox have a connection, a name and their host port', () => {
	expect(allVendors).toEqual([
		'postgres',
		'postgres10',
		'mysql',
		'mysql5',
		'maria',
		'mssql',
		'oracle',
		'cockroachdb',
		'sqlite3',
	]);

	for (const vendor of allVendors) {
		expect(knexConfig[vendor].client).toBeTruthy();
		expect(knexConfig[vendor].waitTestSQL).toMatch(/^SELECT 1/);
		expect(names[vendor]).toBeTruthy();
	}

	expect((knexConfig.postgres.connection as any).port).toBe(6100);
	expect((knexConfig.cockroachdb.connection as any).port).toBe(6107);
	expect(knexConfig.oracle.waitTestSQL).toBe('SELECT 1 FROM DUAL');
});

test('apps and profile pairs use distinct host ports', () => {
	const ports = [
		appPorts.directus,
		appPorts.backoffice,
		...Object.values(profilePorts).flatMap((p) => [p.directus, p.backoffice]),
	];
	expect(new Set(ports).size).toBe(ports.length);
});

test('PARITY_SUITE selects the files', () => {
	expect(parseSuite(undefined)).toBe('full');
	expect(parseSuite('reduced')).toBe('reduced');
	expect(() => parseSuite('half')).toThrow('PARITY_SUITE must be "full" or "reduced", got "half"');
	expect(suiteFiles('reduced')).toEqual(REDUCED_FILES);
	expect(suiteFiles('full')).toEqual(FULL_FILES);
	expect(REDUCED_FILES).toContain('src/server/methods.test.ts');
});
