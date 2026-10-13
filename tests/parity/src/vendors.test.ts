import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
	appPorts,
	cacheRedisPort,
	getStorages,
	knexConfig,
	manualProfiles,
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
	expect(FULL_FILES).toContain('src/schema-management/**/*.test.ts');
	expect(REDUCED_FILES).toContain('src/schema-management/crud.test.ts');
	expect(FULL_FILES).toContain('src/files/**/*.test.ts');
	expect(REDUCED_FILES).toContain('src/files/{files,folders,assets}.test.ts');
});

// Feature 007 (research R6, R8): shared `local` storage, MinIO, the import source and the storage selection.
test.each(allVendors)('%s env: local then s3 storage locations', (vendor) => {
	const env = readFileSync(new URL(`../env/${vendor}.env`, import.meta.url), 'utf8');
	expect(env).toMatch(/^STORAGE_LOCATIONS=local,s3$/m);
	expect(env).toMatch(/^STORAGE_LOCAL_DRIVER=local$/m);
	expect(env).toMatch(/^STORAGE_LOCAL_ROOT=\.\/uploads$/m);
	expect(env).toMatch(/^STORAGE_S3_DRIVER=s3$/m);
});

// Feature 009 (T041): the main pair exposes one test variable to flows ($env), so logs.test.ts sees its value redacted.
test.each(allVendors)('%s env: the flows $env test variable', (vendor) => {
	const env = readFileSync(new URL(`../env/${vendor}.env`, import.meta.url), 'utf8');
	expect(env).toMatch(/^FLOWS_ENV_ALLOW_LIST=PARITY_FLOWS_ENV_TEST$/m);
	expect(env).toMatch(/^PARITY_FLOWS_ENV_TEST=parity-env-secret$/m);
});

test('every app container mounts the shared uploads volume and waits for files-fixtures', () => {
	const services = compose
		.split(/\n(?= {2}\S)/)
		.filter((b) => /image: (directus\/directus|hiennd23\/backoffice-api)/.test(b));
	const withoutVolume = services.filter((b) => !b.includes('<<: *app') && !b.includes('uploads:/directus/uploads'));
	expect(withoutVolume).toEqual([]);
	expect(compose).toMatch(/^x-app: &app[\s\S]*?- uploads:\/directus\/uploads/m);
	expect(compose).toMatch(/^volumes:\n {2}uploads:$/m);
	expect(compose).toMatch(/files-fixtures: \{ condition: service_healthy \}/);
	expect(publishedPort('files-fixtures')).toBe(8882);
});

test('feature 007 (research R2): every Backoffice container runs on linux/amd64, like the Directus image', () => {
	const services = compose.split(/\n(?= {2}\S)/).filter((b) => b.includes('image: hiennd23/backoffice-api'));
	expect(services.length).toBeGreaterThan(20);
	expect(services.filter((b) => !/^\s+platform: linux\/amd64/m.test(b))).toEqual([]);
});

test('PARITY_STORAGES selects the storage locations', () => {
	expect(getStorages(undefined)).toEqual(['local', 's3']);
	expect(getStorages('')).toEqual(['local', 's3']);
	expect(getStorages('s3')).toEqual(['s3']);
	expect(getStorages('local, s3')).toEqual(['local', 's3']);
	expect(() => getStorages('minio')).toThrow('PARITY_STORAGES must list "local" and/or "s3", got "minio"');
});

// Feature 008 (research R5): a manual pair changes the shared database on its own (the retention job deletes old
// history every 10 s), so no workflow, the local CI script or the quickstart may bring it up with the other pairs.
test.each(manualProfiles)('manual profile %s is never started by env-up --profiles', (profile) => {
	const files = [
		'../../../.github/workflows/ci.yml',
		'../../../.github/workflows/parity-matrix.yml',
		'../../../.github/workflows/nightly.yml',
		'../../../.github/workflows/benchmark.yml',
		'../../../tools/ci-local.sh',
	];

	for (const file of files) {
		const text = readFileSync(new URL(file, import.meta.url), 'utf8');
		const lists = [...text.matchAll(/profiles(?:=|: )'?([\w,-]+)/g)].map((m) => m[1]!.split(','));
		expect(lists.flat(), file).not.toContain(profile);
	}

	expect(readFileSync(new URL(`../env/profile-${profile}.env`, import.meta.url), 'utf8')).toMatch(
		/^REDIS_LOCK_NAMESPACE=parity-/m,
	);
});
