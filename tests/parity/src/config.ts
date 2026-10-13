// Ported from directus/tests/blackbox/common/config.ts (vendor connection part: same images and host ports).
// The two apps run inside Docker and read tests/parity/env/<vendor>.env; the test process reaches the
// databases through these host ports (snapshots, read-only role, temporary databases).
import type { Knex } from 'knex';
import type { Vendor } from './get-dbs-to-test.js';

export type VendorConfig = Knex.Config & { waitTestSQL: string };

export const knexConfig: Record<Vendor, VendorConfig> = {
	postgres: {
		client: 'pg',
		connection: { database: 'directus', user: 'postgres', password: 'secret', host: '127.0.0.1', port: 6100 },
		waitTestSQL: 'SELECT 1',
	},
	postgres10: {
		client: 'pg',
		connection: { database: 'directus', user: 'postgres', password: 'secret', host: '127.0.0.1', port: 6101 },
		waitTestSQL: 'SELECT 1',
	},
	mysql: {
		client: 'mysql2',
		connection: { database: 'directus', user: 'root', password: 'secret', host: '127.0.0.1', port: 6102 },
		waitTestSQL: 'SELECT 1',
	},
	mysql5: {
		client: 'mysql2',
		connection: { database: 'directus', user: 'root', password: 'secret', host: '127.0.0.1', port: 6103 },
		waitTestSQL: 'SELECT 1',
	},
	maria: {
		client: 'mysql2',
		connection: { database: 'directus', user: 'root', password: 'secret', host: '127.0.0.1', port: 6104 },
		waitTestSQL: 'SELECT 1',
	},
	mssql: {
		client: 'mssql',
		connection: {
			database: 'model',
			user: 'sa',
			password: 'Test@123',
			host: '127.0.0.1',
			port: 6105,
			requestTimeout: 60000,
		},
		waitTestSQL: 'SELECT 1',
	},
	oracle: {
		client: 'oracledb',
		// The pluggable database of env/oracle.env, where gvenzl/oracle-xe creates APP_USER (XE answers ORA-01017).
		connection: { user: 'secretsysuser', password: 'secretpassword', connectString: '127.0.0.1:6106/XEPDB1' },
		waitTestSQL: 'SELECT 1 FROM DUAL',
	},
	cockroachdb: {
		client: 'cockroachdb',
		connection: { database: 'defaultdb', user: 'root', password: '', host: '127.0.0.1', port: 6107 },
		waitTestSQL: 'SELECT 1',
	},
	sqlite3: {
		client: 'sqlite3',
		connection: { filename: new URL('../.data/sqlite/data.db', import.meta.url).pathname },
		useNullAsDefault: true,
		waitTestSQL: 'SELECT 1',
	},
};

export const names: Record<Vendor, string> = {
	postgres: 'Postgres',
	postgres10: 'Postgres (10)',
	mysql: 'MySQL',
	mysql5: 'MySQL (5)',
	maria: 'MariaDB',
	mssql: 'MS SQL Server',
	oracle: 'OracleDB',
	cockroachdb: 'CockroachDB',
	sqlite3: 'SQLite 3',
};

/** Host ports of the two apps in tests/parity/docker-compose.yml (one vendor at a time). */
export const appPorts = { directus: 8155, backoffice: 8156 } as const;

/** Host ports of the profile pairs (docker-compose.yml, T065 and T091). */
export const profilePorts = {
	ratelimit: { directus: 8255, backoffice: 8256 },
	'cors-hsts': { directus: 8355, backoffice: 8356 },
	pressure: { directus: 8455, backoffice: 8456 },
	metrics: { directus: 8555, backoffice: 8556 },
	'cache-config': { directus: 8755, backoffice: 8756 },
	sso: { directus: 8955, backoffice: 8956 },
	// Feature 004 (T048): user limits.
	'user-limits': { directus: 8855, backoffice: 8856 },
	// Feature 005 (research R5): response cache configurations and the WebSocket pair.
	'cache-mem': { directus: 9055, backoffice: 9056 },
	'cache-mem-purge': { directus: 9155, backoffice: 9156 },
	'cache-redis': { directus: 9255, backoffice: 9256 },
	'cache-redis-purge': { directus: 9355, backoffice: 9356 },
	websocket: { directus: 9455, backoffice: 9456 },
	// Feature 005 (research R6): the env of directus/tests/blackbox for the port of its items files.
	blackbox: { directus: 9555, backoffice: 9556 },
	// Feature 006 (research R7): nodes of the blackbox schema-cache.test.ts and of the two timezone files.
	'schema-cache': { directus: 9655, backoffice: 9656 },
	'schema-cache-nomsg': { directus: 9755, backoffice: 9756 },
	'tz-asia': { directus: 9855, backoffice: 9856 },
	'tz-america': { directus: 9955, backoffice: 9956 },
	// Feature 007 (research R8): narrower files configuration and the time-dependent cases.
	'assets-limit': { directus: 10055, backoffice: 10056 },
	'assets-stress': { directus: 10155, backoffice: 10156 },
	// Feature 008 (research R5): the retention job pair, started and stopped by src/history/retention.test.ts only.
	retention: { directus: 10255, backoffice: 10256 },
	// Feature 009 (research R12): the scheduled flows pair, started and stopped by src/flows/schedule.test.ts only.
	'flows-schedule': { directus: 10355, backoffice: 10356 },
} as const;

/** Host port of the own Redis of the cache-redis pair (feature 005, FR-016, R-10). */
export const cacheRedisPort = 6111;

/** Host port of the reverse proxy in front of both apps (profile `app`, feature 004, contracts/proxy-e2e.md). */
export const proxyPort = 8160;

/** Host port of the second Backoffice instance of the main pair (profile `multi`, feature 002). */
export const secondBackofficePort = 8157;

export type Profile = keyof typeof profilePorts;

/**
 * Pairs that share the database and change it on their own (feature 008: the retention job deletes old history every
 * 10 s; feature 009: the scheduled flows pair runs a flow every 2 s). Only the test file that needs one starts and stops it (profileUp, profileStop); never `env-up --profiles`.
 */
export const manualProfiles: readonly Profile[] = ['retention', 'flows-schedule'];

/** Storage locations of tests/parity/env/<vendor>.env (feature 007, research R6). */
export const storageLocations = ['local', 's3'] as const;

export type StorageLocation = (typeof storageLocations)[number];

/**
 * Feature 007 (spec Clarifications): the storage locations the files and assets tests run on, from PARITY_STORAGES
 * (comma separated). Postgres runs both on every push, MySQL and SQLite only `s3`.
 */
export function getStorages(value = process.env['PARITY_STORAGES']): StorageLocation[] {
	if (value === undefined || value.trim() === '') return [...storageLocations];

	const storages = value.split(',').map((s) => s.trim());

	for (const storage of storages) {
		if (!(storageLocations as readonly string[]).includes(storage)) {
			throw new Error(`PARITY_STORAGES must list "local" and/or "s3", got "${value}"`);
		}
	}

	return storages as StorageLocation[];
}
