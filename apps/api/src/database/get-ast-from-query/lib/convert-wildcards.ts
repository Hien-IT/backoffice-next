// Ported from directus/api/src/database/get-ast-from-query/lib/convert-wildcards.ts
import type { Accountability, Query, Relation, SchemaOverview } from '@backoffice/types';
import { getRelation } from '@backoffice/utils';
import type { Knex } from 'knex';
import { cloneDeep } from 'lodash-es';
import { fetchAllowedFields } from '../../../permissions/modules/fetch-allowed-fields/fetch-allowed-fields.js';
import { getHiddenFields } from '../../../utils/hidden-fields.js';
import { parseFilterKey } from '../../../utils/parse-filter-key.js';

export interface ConvertWildcardsOptions {
	collection: string;
	fields: string[];
	alias: Query['alias'];
	accountability: Accountability | null;
	backlink: boolean | undefined;
}

export interface ConvertWildCardsContext {
	schema: SchemaOverview;
	knex: Knex;
	parentRelation?: Relation;
}

/** The specials of the system fields DR creates hidden (Created/Updated By/On): they stay in a wildcard (D-209 C). */
const SYSTEM_SPECIALS = ['user-created', 'date-created', 'user-updated', 'date-updated'];

/**
 * Backoffice (spec 005, D-209, owner 2026-11-03: option C widened to every relation): hidden fields a wildcard still
 * returns, like DR, so related data never goes missing. Every field of a relation of the collection: the key of an m2o
 * (o2o, the keys of an m2m or m2a junction), the a2o field and its `collection` column, the o2m / m2m / m2a / translations
 * alias of the other side; and the system fields of SYSTEM_SPECIALS.
 */
function keptHiddenFields(collection: string, schema: SchemaOverview): Set<string> {
	const kept = new Set<string>();

	for (const relation of schema.relations) {
		if (relation.collection === collection) {
			kept.add(relation.field);
			if (relation.meta?.one_collection_field) kept.add(relation.meta.one_collection_field);
			// The manual sort of an o2m / m2m (on the many side or the junction).
			if (relation.meta?.sort_field) kept.add(relation.meta.sort_field);
		}

		if (relation.related_collection === collection && relation.meta?.one_field) kept.add(relation.meta.one_field);
	}

	// The sort field of the collection (status and sort of directus_collections are also left out by getHiddenFields).
	const sortField = schema.collections[collection]?.sortField;
	if (sortField) kept.add(sortField);

	for (const [name, field] of Object.entries(schema.collections[collection]?.fields ?? {})) {
		if (field.special?.some((special) => SYSTEM_SPECIALS.includes(special))) kept.add(name);
	}

	return kept;
}

export async function convertWildcards(options: ConvertWildcardsOptions, context: ConvertWildCardsContext) {
	const fields = cloneDeep(options.fields);

	// Backoffice (spec 005, D-209): a wildcard leaves out the hidden fields of a user collection, except the primary
	// key, the relational fields and the four system fields (owner 2026-11-03: option C widened to every relation); a
	// field named in `fields` (or an alias) is not a wildcard and stays.
	const hidden = (await getHiddenFields(context.knex))[options.collection] ?? [];
	const primary = context.schema.collections[options.collection]!.primary;
	const kept = hidden.length > 0 ? keptHiddenFields(options.collection, context.schema) : new Set<string>();
	// A hidden field also named in `fields` is expanded in its column place, like DR (`*,secret`).
	const named = new Set(fields);
	const shown = (name: string) => name === primary || kept.has(name) || named.has(name) || !hidden.includes(name);

	const allFieldsInCollection = Object.keys(context.schema.collections[options.collection]!.fields);
	const fieldsInCollection = allFieldsInCollection.filter(shown);

	let allowedFields: string[] | null = allFieldsInCollection;

	if (options.accountability && options.accountability.admin === false) {
		allowedFields = await fetchAllowedFields(
			{
				collection: options.collection,
				action: 'read',
				accountability: options.accountability,
			},
			context,
		);
	}

	if (!allowedFields || allowedFields.length === 0) return [];

	// In case of full read permissions
	if (allowedFields[0] === '*') allowedFields = allFieldsInCollection;

	// an alias names its field, so it may read a hidden one
	const readableFields = allowedFields;
	allowedFields = allowedFields.filter(shown);

	for (let index = 0; index < fields.length; index++) {
		const fieldKey = fields[index]!;

		if (fieldKey.includes('*') === false) continue;

		if (fieldKey === '*') {
			const aliases = Object.keys(options.alias ?? {});

			// Set to all fields in collection
			if (allowedFields.includes('*')) {
				fields.splice(index, 1, ...fieldsInCollection, ...aliases);
			} else {
				// Set to all allowed fields
				const allowedAliases = aliases.filter((fieldKey) => {
					// Backoffice (spec 023, checklist CHK009): keep the DR field name of json() aliases here.
					const { fieldName } = parseFilterKey(options.alias![fieldKey]!, { jsonBaseField: false });
					return readableFields.includes(fieldName);
				});

				fields.splice(index, 1, ...allowedFields, ...allowedAliases);
			}
		}

		// Swap *.* case for *,<relational-field>.*,<another-relational>.*
		if (fieldKey.includes('.') && fieldKey.split('.')[0] === '*') {
			const parts = fieldKey.split('.');

			let relationalFields: string[] = [];

			if (allowedFields.includes('*')) {
				relationalFields = context.schema.relations.reduce<string[]>((acc, relation) => {
					if (relation.collection === options.collection && !acc.includes(relation.field)) {
						acc.push(relation.field);
					}

					if (relation.related_collection === options.collection && !acc.includes(relation.meta!.one_field!)) {
						acc.push(relation.meta!.one_field!);
					}

					return acc;
				}, []);
			} else {
				relationalFields = allowedFields.filter(
					(fieldKey) => getRelation(context.schema.relations, options.collection, fieldKey) !== undefined,
				);
			}

			if (options.backlink === false) {
				relationalFields = relationalFields.filter(
					(relationField) =>
						getRelation(context.schema.relations, options.collection, relationField) !== context.parentRelation,
				);
			}

			const nonRelationalFields = allowedFields.filter((fieldKey) => relationalFields.includes(fieldKey) === false);

			const aliasFields = Object.keys(options.alias ?? {}).map((fieldKey) => {
				const name = options.alias![fieldKey];

				if (relationalFields.includes(name!)) {
					return `${fieldKey}.${parts.slice(1).join('.')}`;
				}

				return fieldKey;
			});

			fields.splice(
				index,
				1,
				...[
					...relationalFields.map((relationalField) => {
						return `${relationalField}.${parts.slice(1).join('.')}`;
					}),
					...nonRelationalFields,
					...aliasFields,
				],
			);
		}
	}

	return fields;
}
