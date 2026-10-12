// Feature 006 (research R5, contracts/parity.md §1): what an app leaves in the shared database after a data model
// change, read through the same schema inspector Directus uses (@backoffice/schema is the port of @directus/schema).
// Two captures of the same request sequence, one per app, must be equal (FR-060, SC-003).
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { indexesOf } from '../db-snapshot.js';

export interface ModelCapture {
	/** columnInfo of each table, sorted by column name (every key of the inspector: type, length, default, keys...). */
	columns: Record<string, unknown[]>;
	indexes: { table: string; name: string; columns: string[]; unique: boolean }[];
	foreignKeys: unknown[];
	/** Rows of directus_collections, directus_fields, directus_relations for the tables, auto-increment ids removed. */
	collections: Record<string, unknown>[];
	fields: Record<string, unknown>[];
	relations: Record<string, unknown>[];
}

const byKey =
	(...keys: string[]) =>
	(a: Record<string, unknown>, b: Record<string, unknown>) =>
		keys
			.map((k) => String(a[k] ?? ''))
			.join('.')
			.localeCompare(keys.map((k) => String(b[k] ?? '')).join('.'));

const withoutId = ({ id: _id, ...row }: Record<string, unknown>) => row;

/** Tables of `tables` that exist, their columns, indexes, foreign keys, and the metadata rows that name them. */
export async function captureModel(db: Knex, tables: string[]): Promise<ModelCapture> {
	const inspector = createInspector(db);
	const existing = (await inspector.tables()).filter((t) => tables.includes(t)).sort();
	const columns: ModelCapture['columns'] = {};

	for (const table of existing) {
		columns[table] = (await inspector.columnInfo(table)).sort((a, b) => a.name.localeCompare(b.name));
	}

	const indexes = (await indexesOf(db, existing)).filter((i) => existing.includes(i.table));

	const foreignKeys = (await inspector.foreignKeys())
		.filter((fk) => existing.includes(fk.table))
		.sort((a, b) => `${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`));

	const collections = (await db('directus_collections').whereIn('collection', tables)).sort(byKey('collection'));
	const fields = (await db('directus_fields').whereIn('collection', tables))
		.map(withoutId)
		.sort(byKey('collection', 'field'));

	const relations = (
		await db('directus_relations').whereIn('many_collection', tables).orWhereIn('one_collection', tables)
	)
		.map(withoutId)
		.sort(byKey('many_collection', 'many_field'));

	return { columns, indexes, foreignKeys, collections, fields, relations };
}

/** Table names, columns, indexes and foreign keys of the whole database: equal before and after a scenario. */
export async function schemaShape(db: Knex) {
	const inspector = createInspector(db);
	const tables = (await inspector.tables()).sort();
	const columns: Record<string, unknown[]> = {};

	for (const table of tables) {
		columns[table] = (await inspector.columnInfo(table)).sort((a, b) => a.name.localeCompare(b.name));
	}

	const foreignKeys = (await inspector.foreignKeys()).sort((a, b) =>
		`${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`),
	);

	return { tables, columns, indexes: await indexesOf(db, tables), foreignKeys };
}
