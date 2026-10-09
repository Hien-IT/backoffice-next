// SC-003 / data-model §3.3: schema and data of EVERY table (directus_* and user tables), before and after.
import { createHash } from 'node:crypto';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';

export interface DbSnapshot {
	tables: {
		name: string;
		columns: { name: string; type: string; nullable: boolean; default: unknown }[];
		rowCount: number;
		checksum: string;
	}[];
	indexes: { table: string; name: string; columns: string[]; unique: boolean }[];
	foreignKeys: {
		table: string;
		column: string;
		foreignKeyTable: string;
		foreignKeyColumn: string;
		constraintName: string | null;
	}[];
}

export async function snapshot(db: Knex): Promise<DbSnapshot> {
	const inspector = createInspector(db);
	const tableNames = (await inspector.tables()).sort();
	const tables: DbSnapshot['tables'] = [];

	for (const name of tableNames) {
		const columns = (await inspector.columnInfo(name))
			.map((c) => ({ name: c.name, type: c.data_type, nullable: c.is_nullable, default: c.default_value }))
			.sort((a, b) => a.name.localeCompare(b.name));

		const primary = await inspector.primary(name);
		const orderBy = primary ? [primary] : columns.map((c) => c.name);
		const rows = await db.select('*').from(name).orderBy(orderBy);
		const checksum = createHash('sha256').update(JSON.stringify(rows)).digest('hex');

		tables.push({ name, columns, rowCount: rows.length, checksum });
	}

	const foreignKeys = (await inspector.foreignKeys())
		.map((fk) => ({
			table: fk.table,
			column: fk.column,
			foreignKeyTable: fk.foreign_key_table,
			foreignKeyColumn: fk.foreign_key_column,
			constraintName: fk.constraint_name,
		}))
		.sort((a, b) => `${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`));

	return { tables, indexes: await indexes(db, tableNames), foreignKeys };
}

async function indexes(db: Knex, tables: string[]): Promise<DbSnapshot['indexes']> {
	const client = db.client.constructor.name;
	let out: DbSnapshot['indexes'] = [];

	if (client === 'Client_PG' || client === 'Client_CockroachDB') {
		const { rows } = await db.raw(`
			select t.relname as table, i.relname as name, ix.indisunique as unique,
				array_to_string(array(select a.attname from unnest(ix.indkey) with ordinality k(attnum, ord)
					join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum order by k.ord), ',') as columns
			from pg_index ix
			join pg_class t on t.oid = ix.indrelid
			join pg_class i on i.oid = ix.indexrelid
			join pg_namespace n on n.oid = t.relnamespace
			where n.nspname = current_schema()`);

		out = rows.map((r: any) => ({ table: r.table, name: r.name, unique: r.unique, columns: r.columns.split(',') }));
	} else if (client === 'Client_SQLite3') {
		for (const table of tables) {
			for (const index of await db.raw(`pragma index_list(??)`, [table])) {
				const columns = (await db.raw(`pragma index_info(??)`, [index.name])).map((c: any) => c.name);
				out.push({ table, name: index.name, unique: index.unique === 1, columns });
			}
		}
	} else if (client === 'Client_MySQL2') {
		const [rows] = await db.raw(`
			select table_name as \`table\`, index_name as name, non_unique = 0 as \`unique\`,
				group_concat(column_name order by seq_in_index) as columns
			from information_schema.statistics where table_schema = database()
			group by table_name, index_name, non_unique`);

		out = rows.map((r: any) => ({
			table: r.table,
			name: r.name,
			unique: Boolean(r.unique),
			columns: r.columns.split(','),
		}));
	} else if (client === 'Client_MSSQL') {
		const rows = await db.raw(`
			select t.name as [table], i.name as name, i.is_unique as [unique],
				string_agg(c.name, ',') within group (order by ic.key_ordinal) as columns
			from sys.indexes i
			join sys.tables t on t.object_id = i.object_id
			join sys.index_columns ic on ic.object_id = i.object_id and ic.index_id = i.index_id
			join sys.columns c on c.object_id = ic.object_id and c.column_id = ic.column_id
			where i.name is not null
			group by t.name, i.name, i.is_unique`);

		out = rows.map((r: any) => ({
			table: r.table,
			name: r.name,
			unique: Boolean(r.unique),
			columns: r.columns.split(','),
		}));
	} else if (client === 'Client_Oracledb' || client === 'Client_Oracle') {
		const rows = await db.raw(`
			select i.table_name as "table", i.index_name as "name", i.uniqueness as "uniqueness",
				listagg(c.column_name, ',') within group (order by c.column_position) as "columns"
			from user_indexes i join user_ind_columns c on c.index_name = i.index_name
			group by i.table_name, i.index_name, i.uniqueness`);

		out = rows.map((r: any) => ({
			table: r.table,
			name: r.name,
			unique: r.uniqueness === 'UNIQUE',
			columns: r.columns.split(','),
		}));
	} else {
		throw new Error(`Index snapshot not implemented for ${client}`);
	}

	return out.sort((a, b) => `${a.table}.${a.name}`.localeCompare(`${b.table}.${b.name}`));
}
