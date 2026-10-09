// Temporary databases for startup scenarios (US3). Postgres refuses CREATE DATABASE ... TEMPLATE while the
// source database has connections (Directus is connected to `directus`), so a template `directus_template` is
// first copied once with pg_dump | psql, then each scenario clones it. Writes here are made by the TEST.
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import knex, { type Knex } from 'knex';
import { knexConfig } from '../config.js';
import { compose } from '../docker.js';
import { getDbsToTest } from '../get-dbs-to-test.js';

const [vendor] = getDbsToTest();
const SQLITE_DIR = fileURLToPath(new URL('../../.data/sqlite-tmp/', import.meta.url));
const SQLITE_MAIN = fileURLToPath(new URL('../../.data/sqlite/data.db', import.meta.url));

/** Path of a temporary SQLite database. */
export const sqlitePath = (name: string) => `${SQLITE_DIR}${name}.db`;

/** Settings that point the API at a temporary database. */
export function tempDbEnv(name: string): Record<string, string> {
	return vendor === 'sqlite3' ? { DB_FILENAME: sqlitePath(name) } : { DB_DATABASE: name };
}

const TEMPLATE = 'directus_template';

function admin(): Knex {
	const config = knexConfig.postgres;
	return knex({ ...config, connection: { ...(config.connection as object), database: 'postgres' } });
}

export function connect(database: string): Knex {
	if (vendor === 'sqlite3')
		return knex({ client: 'sqlite3', connection: { filename: sqlitePath(database) }, useNullAsDefault: true });

	const config = knexConfig.postgres;
	return knex({ ...config, connection: { ...(config.connection as object), database } });
}

let templateReady = false;

export async function ensureTemplate(): Promise<void> {
	if (templateReady) return;

	const db = admin();

	try {
		await db.raw(`drop database if exists ${TEMPLATE}`);
		await db.raw(`create database ${TEMPLATE}`);
	} finally {
		await db.destroy();
	}

	compose('exec', '-T', 'postgres', 'sh', '-c', `pg_dump -U postgres directus | psql -q -U postgres ${TEMPLATE}`);
	templateReady = true;
}

/** Clones the bootstrapped Directus database (or an empty one) into `name`. */
export async function createTempDb(name: string, options: { empty?: boolean } = {}): Promise<void> {
	if (vendor === 'sqlite3') {
		// SQLite: a copy of the database file Directus bootstrapped (or an empty file).
		mkdirSync(SQLITE_DIR, { recursive: true });
		if (options.empty) writeFileSync(sqlitePath(name), '');
		else copyFileSync(SQLITE_MAIN, sqlitePath(name));
		return;
	}

	if (!options.empty) await ensureTemplate();
	const db = admin();

	try {
		await db.raw(`drop database if exists ${name}`);
		await db.raw(options.empty ? `create database ${name}` : `create database ${name} template ${TEMPLATE}`);
	} finally {
		await db.destroy();
	}
}

export async function dropTempDb(name: string): Promise<void> {
	if (vendor === 'sqlite3') {
		rmSync(sqlitePath(name), { force: true });
		return;
	}

	const db = admin();

	try {
		await db.raw(`drop database if exists ${name} with (force)`);
	} finally {
		await db.destroy();
	}
}
