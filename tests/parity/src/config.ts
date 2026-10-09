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
		connection: { user: 'secretsysuser', password: 'secretpassword', connectString: '127.0.0.1:6106/XE' },
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
} as const;

export type Profile = keyof typeof profilePorts;
