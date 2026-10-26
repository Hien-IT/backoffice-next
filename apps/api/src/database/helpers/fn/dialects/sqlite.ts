// Ported from directus/api/src/database/helpers/fn/dialects/sqlite.ts
import { InvalidQueryError } from '@backoffice/errors';
import type { Knex } from 'knex';
import type { JsonFilterType } from '../json/parse-function.js';
import type { FnHelperOptions } from '../types.js';
import { FnHelper, JSON_ELEMENT_ALIAS } from '../types.js';

const parseLocaltime = (columnType?: string) => {
	if (columnType === 'timestamp') {
		return '';
	}

	return `, 'localtime'`;
};

export class FnHelperSQLite extends FnHelper {
	year(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`CAST(strftime('%Y', ??.?? / 1000, 'unixepoch'${parseLocaltime(options?.type)}) AS INTEGER)`, [
			table,
			column,
		]);
	}

	month(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`CAST(strftime('%m', ??.?? / 1000, 'unixepoch'${parseLocaltime(options?.type)}) AS INTEGER)`, [
			table,
			column,
		]);
	}

	week(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`CAST(strftime('%W', ??.?? / 1000, 'unixepoch'${parseLocaltime(options?.type)}) AS INTEGER)`, [
			table,
			column,
		]);
	}

	day(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`CAST(strftime('%d', ??.?? / 1000, 'unixepoch'${parseLocaltime(options?.type)}) AS INTEGER)`, [
			table,
			column,
		]);
	}

	weekday(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`CAST(strftime('%w', ??.?? / 1000, 'unixepoch'${parseLocaltime(options?.type)}) AS INTEGER)`, [
			table,
			column,
		]);
	}

	hour(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`CAST(strftime('%H', ??.?? / 1000, 'unixepoch'${parseLocaltime(options?.type)}) AS INTEGER)`, [
			table,
			column,
		]);
	}

	minute(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`CAST(strftime('%M', ??.?? / 1000, 'unixepoch'${parseLocaltime(options?.type)}) AS INTEGER)`, [
			table,
			column,
		]);
	}

	second(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`CAST(strftime('%S', ??.?? / 1000, 'unixepoch'${parseLocaltime(options?.type)}) AS INTEGER)`, [
			table,
			column,
		]);
	}

	count(table: string, column: string, options?: FnHelperOptions): Knex.Raw<any> {
		const collectionName = options?.originalCollectionName || table;
		const type = this.schema.collections?.[collectionName]?.fields?.[column]?.type ?? 'unknown';

		if (type === 'json') {
			return this.knex.raw(`json_array_length(??.??, '$')`, [table, column]);
		}

		if (type === 'alias') {
			return this._relationalCount(table, column, options);
		}

		throw new Error(`Couldn't extract type from ${table}.${column}`);
	}

	json(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		const collectionName = options?.originalCollectionName || table;
		const fieldSchema = this.schema.collections?.[collectionName]?.fields?.[column];

		if (!fieldSchema || fieldSchema.type !== 'json' || !options?.jsonPath) {
			throw new InvalidQueryError({ reason: `${collectionName}.${column} is not a JSON field` });
		}

		// SQLite uses json_extract with $ path notation
		// ".data.items[0].name" → "$.items[0].name"
		const jsonPath = '$' + options.jsonPath;

		if (options.jsonType) {
			return this.typedJsonValue(table, column, { sql: '?', bindings: [jsonPath] }, options.jsonType);
		}

		return this.knex.raw(`json_extract(??.??, ?)`, [table, column, jsonPath]);
	}

	// Backoffice (spec 023, research R4, T001): json_each of the array at the path; no row when it is not an array.
	override jsonArrayElements(table: string, column: string, options: FnHelperOptions): Knex.Raw {
		const value = validJson(table, column);
		const path = '$' + (options.jsonPath ?? '');

		return this.knex.raw(`json_each(CASE WHEN json_type(${value.sql}, ?) = 'array' THEN ${value.sql} END, ?) AS ??`, [
			...value.bindings,
			path,
			...value.bindings,
			path,
			JSON_ELEMENT_ALIAS,
		]);
	}

	// The element is read from the column at `<element fullkey><rest of the path>`: a string element is not JSON text.
	override jsonElement(table: string, column: string, options: FnHelperOptions): Knex.Raw {
		const path = { sql: '??.?? || ?', bindings: [JSON_ELEMENT_ALIAS, 'fullkey', options.jsonPath ?? ''] };

		return this.typedJsonValue(table, column, path, options.jsonType ?? 'text');
	}

	/**
	 * Backoffice (spec 023, research R4): typed value at the path, NULL when missing, JSON null, another type or text
	 * that is not JSON (`json_type` fails on it even behind `json_valid(...) AND`, T001).
	 */
	private typedJsonValue(table: string, column: string, path: SqlPart, type: JsonFilterType): Knex.Raw {
		const value = validJson(table, column);
		const typeOf = { sql: `json_type(${value.sql}, ${path.sql})`, bindings: [...value.bindings, ...path.bindings] };

		if (type === 'boolean') {
			return this.knex.raw(`CASE ${typeOf.sql} WHEN 'true' THEN 1 WHEN 'false' THEN 0 END`, typeOf.bindings);
		}

		const check = type === 'number' ? `IN ('integer', 'real')` : `= 'text'`;

		return this.knex.raw(`CASE WHEN ${typeOf.sql} ${check} THEN json_extract(${value.sql}, ${path.sql}) END`, [
			...typeOf.bindings,
			...value.bindings,
			...path.bindings,
		]);
	}
}

type SqlPart = { sql: string; bindings: unknown[] };

function validJson(table: string, column: string): SqlPart {
	return { sql: 'CASE WHEN json_valid(??.??) THEN ??.?? END', bindings: [table, column, table, column] };
}
