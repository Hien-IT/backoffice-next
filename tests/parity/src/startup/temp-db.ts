// Temporary databases for startup scenarios (US3). Postgres refuses CREATE DATABASE ... TEMPLATE while the
// source database has connections (Directus is connected to `directus`), so a template `directus_template` is
// first copied once with pg_dump | psql, then each scenario clones it. Writes here are made by the TEST.
import knex, { type Knex } from 'knex';
import { knexConfig } from '../config.js';
import { compose } from '../docker.js';

const TEMPLATE = 'directus_template';

function admin(): Knex {
	const config = knexConfig.postgres;
	return knex({ ...config, connection: { ...(config.connection as object), database: 'postgres' } });
}

export function connect(database: string): Knex {
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
	const db = admin();

	try {
		await db.raw(`drop database if exists ${name} with (force)`);
	} finally {
		await db.destroy();
	}
}
