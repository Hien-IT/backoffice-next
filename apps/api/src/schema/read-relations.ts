// Ported from directus/api/src/services/relations.ts (readAll with bypassCache and no accountability, and
// stitchRelations). directus_relations is read with knex instead of ItemsService (research R16.3).
import type { ForeignKey, SchemaInspector } from '@backoffice/schema';
import { systemRelationRows } from '@backoffice/system-data';
import type { Relation, RelationMeta } from '@backoffice/types';
import type { Knex } from 'knex';
import { castCsv } from '../utils/cast-on-read.js';

export async function readRelations(database: Knex, schemaInspector: SchemaInspector): Promise<Relation[]> {
	const rows = (await database.select('*').from('directus_relations')).map((row: RelationMeta) => ({
		...row,
		one_allowed_collections: castCsv(row.one_allowed_collections) as RelationMeta['one_allowed_collections'],
	}));

	const metaRows = [...rows, ...(systemRelationRows as unknown as RelationMeta[])];
	const schemaRows = await schemaInspector.foreignKeys();

	return stitchRelations(metaRows, schemaRows);
}

export function stitchRelations(metaRows: RelationMeta[], schemaRows: ForeignKey[]): Relation[] {
	const results = schemaRows.map((foreignKey): Relation => {
		return {
			collection: foreignKey.table,
			field: foreignKey.column,
			related_collection: foreignKey.foreign_key_table,
			schema: foreignKey,
			meta:
				metaRows.find((meta) => {
					if (meta.many_collection !== foreignKey.table) return false;
					if (meta.many_field !== foreignKey.column) return false;
					if (meta.one_collection && meta.one_collection !== foreignKey.foreign_key_table) return false;
					return true;
				}) || null,
		};
	});

	/**
	 * Meta rows that don't have a corresponding schema foreign key
	 */
	const remainingMetaRows = metaRows
		.filter((meta) => {
			return !results.find((relation) => relation.meta === meta);
		})
		.map((meta): Relation => {
			return {
				collection: meta.many_collection,
				field: meta.many_field,
				related_collection: meta.one_collection ?? null,
				schema: null,
				meta: meta,
			};
		});

	results.push(...remainingMetaRows);

	return results;
}
