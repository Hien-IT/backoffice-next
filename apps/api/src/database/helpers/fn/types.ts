// Ported from directus/api/src/database/helpers/fn/types.ts
import { InvalidQueryError } from '@backoffice/errors';
import type { Filter, Permission, Query, SchemaOverview } from '@backoffice/types';
import { parseJSON } from '@backoffice/utils';
import type { Knex } from 'knex';
import type { AliasMap } from '../../../utils/get-column-path.js';
import { applyFilter } from '../../run-ast/lib/apply-query/filter/index.js';
import { generateRelationalQueryAlias } from '../../run-ast/utils/generate-alias.js';
import { DatabaseHelper } from '../types.js';
import type { JsonFilterType } from './json/parse-function.js';

export type FnHelperOptions = {
	type: string | undefined;
	originalCollectionName: string | undefined;
	relationalCountOptions:
		| {
				query: Query;
				cases: Filter[];
				permissions: Permission[];
		  }
		| undefined;
	jsonPath: string | undefined;
	/** Backoffice (spec 023, D-184): with a type, json() returns the value at the path typed, or NULL. */
	jsonType?: JsonFilterType | undefined;
};

// Backoffice (spec 023): the names of getDatabaseClient (database/index.ts imports these helpers, so not imported here).
const KNEX_CLIENTS: Record<string, string> = {
	Client_PG: 'postgres',
	Client_SQLite3: 'sqlite',
	Client_MySQL2: 'mysql',
	Client_CockroachDB: 'cockroachdb',
	Client_Oracledb: 'oracle',
	Client_Oracle: 'oracle',
	Client_MSSQL: 'mssql',
	Client_Redshift: 'redshift',
};

/** Backoffice (spec 023, D-184): alias of the array element row of a `[*]` filter. */
export const JSON_ELEMENT_ALIAS = 'bo_json_elem';

export abstract class FnHelper extends DatabaseHelper {
	constructor(
		knex: Knex,
		protected schema: SchemaOverview,
	) {
		super(knex);
		this.schema = schema;
	}

	abstract year(table: string, column: string, options?: FnHelperOptions): Knex.Raw;
	abstract month(table: string, column: string, options?: FnHelperOptions): Knex.Raw;
	abstract week(table: string, column: string, options?: FnHelperOptions): Knex.Raw;
	abstract day(table: string, column: string, options?: FnHelperOptions): Knex.Raw;
	abstract weekday(table: string, column: string, options?: FnHelperOptions): Knex.Raw;
	abstract hour(table: string, column: string, options?: FnHelperOptions): Knex.Raw;
	abstract minute(table: string, column: string, options?: FnHelperOptions): Knex.Raw;
	abstract second(table: string, column: string, options?: FnHelperOptions): Knex.Raw;
	abstract count(table: string, column: string, options?: FnHelperOptions): Knex.Raw;
	abstract json(table: string, column: string, options?: FnHelperOptions): Knex.Raw;

	/**
	 * Parse a value returned from a json() function query.
	 * Most databases return objects/arrays as stringified JSON — override this to skip parsing
	 * for drivers that already deserialize the result (e.g. the pg driver for PostgreSQL).
	 */
	parseJsonResult(value: unknown, type?: JsonFilterType): unknown {
		if (type) return normalizeTypedJsonValue(value, type);

		if (typeof value !== 'string') return value;

		try {
			const parsed = parseJSON(value);
			if (typeof parsed === 'object' && parsed !== null) return parsed;
		} catch {
			// keep original string value (e.g. actual string data in the JSON path)
		}

		return value;
	}

	/**
	 * Backoffice (spec 023, FR-002): FROM source of the array at `jsonPath` for a `[*]` filter, one row per element under
	 * JSON_ELEMENT_ALIAS; no row when the value is not an array. Postgres and SQLite only.
	 */
	jsonArrayElements(_table: string, _column: string, _options: FnHelperOptions): Knex.Raw {
		this.assertJsonFilterSupported();
		throw new InvalidQueryError({ reason: 'Filtering by a JSON path is not supported' });
	}

	/** Backoffice (spec 023, FR-002): typed value at `jsonPath` inside the current JSON_ELEMENT_ALIAS element. */
	jsonElement(_table: string, _column: string, _options: FnHelperOptions): Knex.Raw {
		this.assertJsonFilterSupported();
		throw new InvalidQueryError({ reason: 'Filtering by a JSON path is not supported' });
	}

	/** Backoffice (spec 023, FR-008): typed json paths run on Postgres and SQLite only (CockroachDB, Redshift excluded). */
	protected assertJsonFilterSupported(): void {
		const client = KNEX_CLIENTS[this.knex.client.constructor.name] ?? this.knex.client.constructor.name;

		if (client !== 'postgres' && client !== 'sqlite') {
			throw new InvalidQueryError({ reason: `Filtering by a JSON path is not supported on ${client}` });
		}
	}

	protected _relationalCount(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		const collectionName = options?.originalCollectionName || table;

		const relation = this.schema.relations.find(
			(relation) => relation.related_collection === collectionName && relation?.meta?.one_field === column,
		);

		const currentPrimary = this.schema.collections[collectionName]!.primary;

		if (!relation) {
			throw new Error(`Field ${collectionName}.${column} isn't a nested relational collection`);
		}

		// generate a unique alias for the relation collection, to prevent collisions in self referencing relations
		const alias = generateRelationalQueryAlias(table, column, collectionName, options);

		let countQuery = this.knex
			.count('*')
			.from({ [alias]: relation.collection })
			.where(this.knex.raw(`??.??`, [alias, relation.field]), '=', this.knex.raw(`??.??`, [table, currentPrimary]));

		if (options?.relationalCountOptions?.query.filter) {
			// set the newly aliased collection in the alias map as the default parent collection, indicated by '', for any nested filters
			const aliasMap: AliasMap = {
				'': {
					alias,
					collection: relation.collection,
				},
			};

			countQuery = applyFilter(
				this.knex,
				this.schema,
				countQuery,
				options.relationalCountOptions.query.filter,
				relation.collection,
				aliasMap,
				options.relationalCountOptions.cases,
				options.relationalCountOptions.permissions,
			).query;
		}

		const { sql, bindings } = countQuery.toSQL();
		return this.knex.raw(`(${sql})`, bindings);
	}
}

/** Backoffice (spec 023, D-184.2): `fields`/`sort` values of json(field, path, type) as JSON scalars on every vendor. */
export function normalizeTypedJsonValue(value: unknown, type: JsonFilterType): unknown {
	if (value === null || value === undefined) return null;

	if (type === 'number') return typeof value === 'number' ? value : Number(value);

	if (type === 'boolean') return value === true || value === 1 || value === '1' || value === 'true' || value === 't';

	return String(value);
}
