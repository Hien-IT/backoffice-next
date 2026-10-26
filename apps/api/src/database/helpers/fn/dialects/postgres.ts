// Ported from directus/api/src/database/helpers/fn/dialects/postgres.ts
import { InvalidQueryError } from '@backoffice/errors';
import type { Knex } from 'knex';
import { toPath } from 'lodash-es';
import type { JsonFilterType } from '../json/parse-function.js';
import type { FnHelperOptions } from '../types.js';
import { FnHelper, JSON_ELEMENT_ALIAS, normalizeTypedJsonValue } from '../types.js';

const parseLocaltime = (columnType?: string) => {
	if (columnType === 'timestamp') {
		return ` AT TIME ZONE 'UTC'`;
	}

	return '';
};

export class FnHelperPostgres extends FnHelper {
	year(table: string, column: string, options: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`EXTRACT(YEAR FROM ??.??${parseLocaltime(options?.type)})`, [table, column]);
	}

	month(table: string, column: string, options: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`EXTRACT(MONTH FROM ??.??${parseLocaltime(options?.type)})`, [table, column]);
	}

	week(table: string, column: string, options: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`EXTRACT(WEEK FROM ??.??${parseLocaltime(options?.type)})`, [table, column]);
	}

	day(table: string, column: string, options: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`EXTRACT(DAY FROM ??.??${parseLocaltime(options?.type)})`, [table, column]);
	}

	weekday(table: string, column: string, options: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`EXTRACT(DOW FROM ??.??${parseLocaltime(options?.type)})`, [table, column]);
	}

	hour(table: string, column: string, options: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`EXTRACT(HOUR FROM ??.??${parseLocaltime(options?.type)})`, [table, column]);
	}

	minute(table: string, column: string, options: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`EXTRACT(MINUTE FROM ??.??${parseLocaltime(options?.type)})`, [table, column]);
	}

	second(table: string, column: string, options: FnHelperOptions): Knex.Raw {
		return this.knex.raw(`EXTRACT(SECOND FROM ??.??${parseLocaltime(options?.type)})`, [table, column]);
	}

	count(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		const collectionName = options?.originalCollectionName || table;
		const type = this.schema.collections?.[collectionName]?.fields?.[column]?.type ?? 'unknown';

		if (type === 'json') {
			const { dbType } = this.schema.collections[table]!.fields[column]!;

			return this.knex.raw(dbType === 'jsonb' ? 'jsonb_array_length(??.??)' : 'json_array_length(??.??)', [
				table,
				column,
			]);
		}

		if (type === 'alias') {
			return this._relationalCount(table, column, options);
		}

		throw new Error(`Couldn't extract type from ${table}.${column}`);
	}

	// The pg driver automatically deserializes json/jsonb columns, so no string parsing needed.
	// Backoffice (spec 023, D-184.2): typed values (numeric comes back as a string) are normalized.
	override parseJsonResult(value: unknown, type?: JsonFilterType): unknown {
		return type ? normalizeTypedJsonValue(value, type) : value;
	}

	json(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		const collectionName = options?.originalCollectionName || table;
		const fieldSchema = this.schema.collections?.[collectionName]?.fields?.[column];

		if (!fieldSchema || fieldSchema.type !== 'json' || !options?.jsonPath) {
			throw new InvalidQueryError({ reason: `${collectionName}.${column} is not a JSON field` });
		}

		if (options.jsonType) {
			this.assertJsonFilterSupported();
			return this.typedJsonValue(
				columnRef(table, column, fieldSchema.dbType),
				options.jsonPath,
				options.jsonType,
				fieldSchema.dbType,
			);
		}

		const { template, bindings } = buildPostgresJsonPath(options.jsonPath);
		const cast = fieldSchema.dbType === 'jsonb' ? 'jsonb' : 'json';

		return this.knex.raw(`??::${cast}${template}`, [table + '.' + column, ...bindings]);
	}

	// Backoffice (spec 023, research R4): `json(b)_array_elements` of the array at the path; a value that is not an array
	// gives no row (json_array_elements fails on a scalar).
	override jsonArrayElements(table: string, column: string, options: FnHelperOptions): Knex.Raw {
		this.assertJsonFilterSupported();

		const dbType = this.jsonFieldSchema(table, column, options).dbType;
		const jsonb = dbType === 'jsonb';
		const array = pathExpression(columnRef(table, column, dbType), options.jsonPath ?? '');

		return this.knex.raw(
			`${jsonb ? 'jsonb' : 'json'}_array_elements(CASE WHEN ${jsonb ? 'jsonb' : 'json'}_typeof(${array.sql}) = 'array' THEN ${array.sql} ELSE '[]'::${jsonb ? 'jsonb' : 'json'} END) AS ??(??)`,
			[...array.bindings, ...array.bindings, JSON_ELEMENT_ALIAS, 'v'],
		);
	}

	override jsonElement(table: string, column: string, options: FnHelperOptions): Knex.Raw {
		this.assertJsonFilterSupported();

		const dbType = this.jsonFieldSchema(table, column, options).dbType;
		const element = { sql: '??.??', bindings: [JSON_ELEMENT_ALIAS, 'v'] };

		return this.typedJsonValue(
			element,
			options.jsonPath ?? '',
			options.jsonType ?? 'text',
			dbType === 'jsonb' ? 'jsonb' : 'json',
		);
	}

	/**
	 * Backoffice (spec 023, research R4): `CASE WHEN json_typeof(x #> path) = '<type>' THEN (x #>> path)::<cast> END`, NULL
	 * when the path is missing, JSON null or another type. `#>`/`#>>` with a text[] treat '0' as an array index.
	 */
	private typedJsonValue(ref: SqlPart, jsonPath: string, type: JsonFilterType, dbType: string | null): Knex.Raw {
		const typeOf = dbType === 'jsonb' ? 'jsonb_typeof' : 'json_typeof';
		const json = pathExpression(ref, jsonPath);
		const text = pathExpression(ref, jsonPath, '#>>');
		const [jsonType, cast] = POSTGRES_JSON_TYPES[type];

		return this.knex.raw(`CASE WHEN ${typeOf}(${json.sql}) = '${jsonType}' THEN (${text.sql})${cast} END`, [
			...json.bindings,
			...text.bindings,
		]);
	}

	private jsonFieldSchema(table: string, column: string, options: FnHelperOptions) {
		const collectionName = options?.originalCollectionName || table;
		const fieldSchema = this.schema.collections?.[collectionName]?.fields?.[column];

		if (!fieldSchema || fieldSchema.type !== 'json') {
			throw new InvalidQueryError({ reason: `${collectionName}.${column} is not a JSON field` });
		}

		return fieldSchema;
	}
}

type SqlPart = { sql: string; bindings: unknown[] };

const POSTGRES_JSON_TYPES: Record<JsonFilterType, [string, string]> = {
	text: ['string', ''],
	number: ['number', '::numeric'],
	boolean: ['boolean', '::boolean'],
};

// Backoffice (spec 023): json/jsonb columns are used as they are, so an expression index on the same text matches.
function columnRef(table: string, column: string, dbType: string | null): SqlPart {
	return { sql: dbType === 'json' || dbType === 'jsonb' ? '??.??' : '??.??::json', bindings: [table, column] };
}

function pathExpression(ref: SqlPart, jsonPath: string, operator: '#>' | '#>>' = '#>'): SqlPart {
	const parts = toPath(jsonPath.startsWith('.') ? jsonPath.slice(1) : jsonPath).map(String);

	if (parts.length === 0) {
		return operator === '#>' ? ref : { sql: `${ref.sql} #>> '{}'`, bindings: ref.bindings };
	}

	return {
		sql: `${ref.sql} ${operator} ARRAY[${parts.map(() => '?').join(', ')}]::text[]`,
		bindings: [...ref.bindings, ...parts],
	};
}

/**
 * Build a parameterized PostgreSQL JSON path using -> operators.
 * Returns a template string containing only operators and ? placeholders,
 * plus a bindings array with the actual values.
 *
 * @example ".color" → { template: "->?", bindings: ["color"] }
 * @example ".items[0].name" → { template: "->?->?->?", bindings: ["items", 0, "name"] }
 */
export function buildPostgresJsonPath(path: string): { template: string; bindings: (string | number)[] } {
	const parts = toPath(path.startsWith('.') ? path.slice(1) : path);

	let template = '';
	const bindings: (string | number)[] = [];

	for (let i = 0; i < parts.length; i++) {
		const num = Number(parts[i]);

		template += '->?';

		if (!isNaN(num) && num >= 0 && Number.isInteger(num)) {
			bindings.push(num);
		} else {
			bindings.push(parts[i]!);
		}
	}

	return { template, bindings };
}
