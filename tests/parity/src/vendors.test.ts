import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
	appPorts,
	cacheRedisPort,
	knexConfig,
	names,
	profilePorts,
	proxyPort,
	secondBackofficePort,
} from './config.js';
import { allVendors, getDbsToTest } from './get-dbs-to-test.js';
import {
	BLACKBOX_FILES,
	CACHE_FILES,
	FULL_FILES,
	MATRIX_FILES,
	REDUCED_FILES,
	parseSuite,
	suiteExcludedFiles,
	suiteFiles,
} from './suite.js';

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

test('apps, profile pairs, the proxy and the extra Redis use distinct host ports', () => {
	const ports = [
		appPorts.directus,
		appPorts.backoffice,
		proxyPort,
		secondBackofficePort,
		cacheRedisPort,
		...Object.values(profilePorts).flatMap((p) => [p.directus, p.backoffice]),
	];
	expect(new Set(ports).size).toBe(ports.length);
});

const compose = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');

/** Host port published by a compose service (`- '<host>:<container>'` under its `ports:`). */
function publishedPort(service: string): number | undefined {
	const block = compose.split(/\n(?= {2}\S)/).find((b) => b.startsWith(`  ${service}:`));
	const match = block?.match(/- '(\d+):\d+'/);
	return match ? Number(match[1]) : undefined;
}

test('every host port published in docker-compose.yml is used once (feature 005: redis-cache met the LDAP port)', () => {
	const ports = [...compose.matchAll(/- '(\d+):\d+'/g)].map((m) => m[1]);
	expect(ports.filter((p, i) => ports.indexOf(p) !== i)).toEqual([]);
	expect(publishedPort('redis-cache')).toBe(cacheRedisPort);
});

// Feature 005 (T004): the ports of config.ts match docker-compose.yml and every pair has its env file.
test.each(Object.entries(profilePorts))('profile %s: compose ports and env file', (profile, ports) => {
	expect(publishedPort(`directus-${profile}`)).toBe(ports.directus);
	expect(publishedPort(`backoffice-api-${profile}`)).toBe(ports.backoffice);
	expect(existsSync(new URL(`../env/profile-${profile}.env`, import.meta.url))).toBe(true);
});

test('the own Redis of the cache-redis pair', () => {
	expect(publishedPort('redis-cache')).toBe(cacheRedisPort);
	expect(readFileSync(new URL('../env/profile-cache-redis.env', import.meta.url), 'utf8')).toMatch(
		/^REDIS=redis:\/\/redis-cache:6379$/m,
	);
});

test('PARITY_SUITE selects the files', () => {
	expect(parseSuite(undefined)).toBe('full');
	expect(parseSuite('reduced')).toBe('reduced');
	expect(parseSuite('matrix')).toBe('matrix');
	expect(parseSuite('blackbox')).toBe('blackbox');
	expect(parseSuite('cache')).toBe('cache');
	expect(() => parseSuite('half')).toThrow(
		'PARITY_SUITE must be "full", "reduced", "matrix", "blackbox" or "cache", got "half"',
	);
	expect(suiteFiles('reduced')).toEqual(REDUCED_FILES);
	expect(suiteFiles('full')).toEqual(FULL_FILES);
	expect(REDUCED_FILES).toContain('src/server/methods.test.ts');
	// Feature 004: the full matrix has its own suite and is never part of `full`.
	expect(suiteFiles('matrix')).toEqual(MATRIX_FILES);
	expect(suiteExcludedFiles('full')).toContain('src/permissions/matrix.test.ts');
	expect(suiteExcludedFiles('full')).toContain('src/permissions/matrix-reduced.test.ts');
	expect(suiteExcludedFiles('reduced')).toEqual([]);
	// Feature 005: the blackbox port and the cache pairs have their own jobs.
	expect(suiteFiles('blackbox')).toEqual(BLACKBOX_FILES);
	expect(suiteFiles('cache')).toEqual(CACHE_FILES);
	expect(FULL_FILES).toContain('src/items/{crud,export}.test.ts');
	expect(REDUCED_FILES).toContain('src/items/crud.test.ts');
});
