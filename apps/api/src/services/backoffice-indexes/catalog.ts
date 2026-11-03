// Backoffice (spec 030, D-210, research R5): what the database itself knows about the indexes of a table: name,
// validity and the column list (the definition is never parsed back; the row in backoffice_indexes carries it).
// Columns matter for D-210.3: MySQL and SQLite keep an index under the same name on the remaining columns when DR
// drops one of its columns, so a name alone would hide a changed index. Checked on Postgres 13, MySQL 8.4 and SQLite
// (T001); MSSQL and Oracle are not read (null = unknown, spec Assumptions).
import type { Knex } from 'knex';
import { getDatabaseClient } from '../../database/index.js';

export type CatalogIndex = { valid: boolean; columns: string[] };

export async function listIndexNames(knex: Knex, table: string): Promise<Map<string, CatalogIndex> | null> {
	switch (getDatabaseClient(knex)) {
		case 'postgres':
		case 'cockroachdb': {
			// indisvalid is false while CREATE INDEX CONCURRENTLY runs and after it failed (INVALID). An expression
			// index (trigram) has no attribute for its key, so its column list is empty.
			const result = await knex.raw(
				`SELECT i.relname AS name, x.indisvalid AS valid, (SELECT string_agg(a.attname, ',' ORDER BY k.ord) FROM unnest(x.indkey) WITH ORDINALITY AS k(attnum, ord) JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = k.attnum) AS columns FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid JOIN pg_class t ON t.oid = x.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE t.relname = ? AND n.nspname = current_schema()`,
				[table],
			);

			return new Map(
				result.rows.map((r: { name: string; valid: boolean; columns: string | null }) => [
					r.name,
					{ valid: Boolean(r.valid), columns: split(r.columns) },
				]),
			);
		}

		case 'mysql': {
			const [rows] = await knex.raw(
				`SELECT index_name AS name, GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS columns FROM information_schema.statistics WHERE table_schema = database() AND table_name = ? GROUP BY index_name`,
				[table],
			);

			return new Map(
				(rows as { name: string; columns: string | null }[]).map((r) => [
					r.name,
					{ valid: true, columns: split(r.columns) },
				]),
			);
		}

		case 'sqlite': {
			const rows: { name: string }[] = await knex.raw(`PRAGMA index_list(??)`, [table]);
			const entries: [string, CatalogIndex][] = [];

			for (const row of rows) {
				const info: { seqno: number; name: string | null }[] = await knex.raw(`PRAGMA index_info(??)`, [row.name]);
				const columns = [...info].sort((a, b) => a.seqno - b.seqno).map((c) => c.name ?? '');
				entries.push([row.name, { valid: true, columns }]);
			}

			return new Map(entries);
		}

		default:
			return null;
	}
}

/** Postgres only: a CREATE INDEX of that name is running right now (pg_stat_progress_create_index, PG >= 12). */
export async function isBuilding(knex: Knex, indexName: string): Promise<boolean> {
	if (getDatabaseClient(knex) !== 'postgres') return false;

	const result = await knex.raw(
		`SELECT 1 AS one FROM pg_stat_progress_create_index p JOIN pg_class c ON c.oid = p.index_relid WHERE c.relname = ?`,
		[indexName],
	);

	return result.rows.length > 0;
}

function split(columns: string | null): string[] {
	return columns ? columns.split(',') : [];
}
