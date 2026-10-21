// Spec 021 FR-100: schema and rows of every directus_* table, to compare a database bootstrapped by Directus 11.17.4
// with one bootstrapped by Backoffice. db-snapshot.ts only keeps a checksum per table, so the rows are read here.
import { createInspector } from '@backoffice/schema';
import { rmSync } from 'node:fs';
import knex, { type Knex } from 'knex';
import { bootstrapDbPort } from '../config.js';
import { indexesOf } from '../db-snapshot.js';

export interface DumpColumn {
	name: string;
	data_type: string;
	is_nullable: boolean;
	default_value: unknown;
	max_length: number | null;
	numeric_precision: number | null;
	numeric_scale: number | null;
}

export interface Dump {
	tables: { name: string; columns: DumpColumn[]; primary: string | string[] | null }[];
	foreignKeys: {
		table: string;
		column: string;
		foreign_key_table: string;
		foreign_key_column: string;
		on_delete: string | null;
		constraint_name: string | null;
	}[];
	indexes: { table: string; name: string; columns: string[]; unique: boolean }[];
	rows: Record<string, Record<string, unknown>[]>;
}

const byName = <T extends { name: string }>(a: T, b: T) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export async function dump(db: Knex): Promise<Dump> {
	const inspector = createInspector(db);
	const tables = (await inspector.tables()).filter((t) => t.startsWith('directus_')).sort();

	const out: Dump = { tables: [], foreignKeys: [], indexes: await indexesOf(db, tables), rows: {} };

	for (const table of tables) {
		const columns = (await inspector.columnInfo(table))
			.map((c) => ({
				name: c.name,
				data_type: c.data_type,
				is_nullable: c.is_nullable,
				default_value: c.default_value,
				max_length: c.max_length,
				numeric_precision: c.numeric_precision,
				numeric_scale: c.numeric_scale,
			}))
			.sort(byName);

		out.tables.push({ name: table, columns, primary: await inspector.primary(table) });

		for (const fk of await inspector.foreignKeys(table)) {
			out.foreignKeys.push({
				table: fk.table,
				column: fk.column,
				foreign_key_table: fk.foreign_key_table,
				foreign_key_column: fk.foreign_key_column,
				on_delete: fk.on_delete,
				constraint_name: fk.constraint_name,
			});
		}

		out.rows[table] = await db.select('*').from(table);
	}

	out.foreignKeys.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
	out.indexes.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

	return out;
}

export type BootstrapApp = 'directus' | 'backoffice';

/** The database of profile bootstrap: Postgres `<database>` or `.data/bootstrap/<database>.db` (DB_FILENAME of the services). */
export function bootstrapDb(vendor: string, app: BootstrapApp, database = `${app}_bootstrap`): Knex {
	if (vendor === 'sqlite3') {
		const filename = new URL(`../../.data/bootstrap/${database}.db`, import.meta.url).pathname;
		return knex({ client: 'sqlite3', connection: { filename }, useNullAsDefault: true });
	}

	return knex({
		client: 'pg',
		connection: {
			host: '127.0.0.1',
			port: bootstrapDbPort,
			user: 'postgres',
			password: 'bootstrap-db-pass-91c2',
			database,
		},
	});
}

/** Drops every table of a database of profile bootstrap (Postgres keeps PostGIS' spatial_ref_sys), or removes the file. */
export async function emptyBootstrapDb(vendor: string, app: BootstrapApp, database: string): Promise<void> {
	if (vendor === 'sqlite3') {
		rmSync(new URL(`../../.data/bootstrap/${database}.db`, import.meta.url), { force: true });
		return;
	}

	const db = bootstrapDb(vendor, app, database);

	try {
		for (const table of await createInspector(db).tables()) {
			if (table !== 'spatial_ref_sys') await db.raw('DROP TABLE IF EXISTS ?? CASCADE', [table]);
		}
	} finally {
		await db.destroy();
	}
}
