// Ported from directus/api/src/utils/get-schema.ts (getDatabaseSchema only: built on every call, no memory cache,
// lock or bus; those come with feature 002 and FR-049). Relations are read by read-relations.ts (no ItemsService).
import { useEnv } from '@backoffice/env';
import type { SchemaInspector } from '@backoffice/schema';
import { createInspector } from '@backoffice/schema';
import { systemCollectionRows } from '@backoffice/system-data';
import type { Filter, SchemaOverview } from '@backoffice/types';
import { parseJSON, toArray, toBoolean } from '@backoffice/utils';
import type { Knex } from 'knex';
import { mapValues } from 'lodash-es';
import { ALIAS_TYPES } from '../constants.js';
import getDatabase from '../database/index.js';
import { useLogger } from '../logger/index.js';
import getDefaultValue from './get-default-value.js';
import { getSystemFieldRowsWithAuthProviders } from './get-field-system-rows.js';
import getLocalType from './get-local-type.js';
import { readRelations } from './read-relations.js';

/** getSchema() of Directus with CACHE_SCHEMA=false: a fresh SchemaOverview from the database. */
export async function getSchema(options?: { database?: Knex }): Promise<SchemaOverview> {
	const database = options?.database || getDatabase();
	const schemaInspector = createInspector(database);
	return await getDatabaseSchema(database, schemaInspector);
}

export async function getDatabaseSchema(database: Knex, schemaInspector: SchemaInspector): Promise<SchemaOverview> {
	const env = useEnv();
	const logger = useLogger();

	const result: SchemaOverview = {
		collections: {},
		relations: [],
	};

	const systemFieldRows = getSystemFieldRowsWithAuthProviders();

	const schemaOverview = await schemaInspector.overview();

	const collections = [
		...(await database
			.select('collection', 'singleton', 'note', 'sort_field', 'accountability')
			.from('directus_collections')),
		...systemCollectionRows,
	];

	for (const [collection, info] of Object.entries(schemaOverview)) {
		if (toArray(env['DB_EXCLUDE_TABLES']).includes(collection)) {
			logger.trace(`Collection "${collection}" is configured to be excluded and will be ignored`);
			continue;
		}

		if (!info.primary) {
			logger.warn(`Collection "${collection}" doesn't have a primary key column and will be ignored`);
			continue;
		}

		if (collection.includes(' ')) {
			logger.warn(`Collection "${collection}" has a space in the name and will be ignored`);
			continue;
		}

		const collectionMeta = collections.find((collectionMeta) => collectionMeta.collection === collection);

		result.collections[collection] = {
			collection,
			primary: info.primary,
			singleton: toBoolean(collectionMeta?.singleton),
			note: collectionMeta?.note || null,
			sortField: collectionMeta?.sort_field || null,
			accountability: collectionMeta ? collectionMeta.accountability : 'all',
			fields: mapValues(schemaOverview[collection]?.columns, (column) => {
				return {
					field: column.column_name,
					defaultValue: getDefaultValue(column) ?? null,
					nullable: column.is_nullable ?? true,
					generated: column.is_generated ?? false,
					type: getLocalType(column),
					dbType: column.data_type,
					precision: column.numeric_precision || null,
					scale: column.numeric_scale || null,
					special: [],
					note: null,
					validation: null,
					alias: false,
					searchable: true,
				};
			}),
		};
	}

	const fields = [
		...(await database
			.select<
				{
					id: number;
					collection: string;
					field: string;
					special: string;
					note: string | null;
					validation: string | Record<string, any> | null;
					searchable: boolean;
				}[]
			>('id', 'collection', 'field', 'special', 'note', 'validation', 'searchable')
			.from('directus_fields')),
		...systemFieldRows,
	].filter((field) => (field.special ? toArray(field.special) : []).includes('no-data') === false);

	for (const field of fields) {
		if (!result.collections[field.collection]) continue;

		const existing = result.collections[field.collection]?.fields[field.field];
		const column = schemaOverview[field.collection]?.columns[field.field];
		const special = field.special ? toArray(field.special) : [];

		if (ALIAS_TYPES.some((type) => special.includes(type)) === false && !existing) continue;

		const type = (existing && getLocalType(column, { special })) || 'alias';
		let validation = field.validation ?? null;

		if (validation && typeof validation === 'string') validation = parseJSON(validation);

		result.collections[field.collection]!.fields[field.field] = {
			field: field.field,
			defaultValue: existing?.defaultValue ?? null,
			nullable: existing?.nullable ?? true,
			generated: existing?.generated ?? false,
			type: type,
			dbType: existing?.dbType || null,
			precision: existing?.precision || null,
			scale: existing?.scale || null,
			special: special,
			note: field.note,
			alias: existing?.alias ?? true,
			validation: (validation as Filter) ?? null,
			searchable: toBoolean(field.searchable) ?? true,
		};
	}

	result.relations = await readRelations(database, schemaInspector);

	return result;
}
