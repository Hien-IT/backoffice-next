// Ported from directus/api/src/database/run-ast/lib/apply-query/filter/operator.ts
import { InvalidQueryError } from '@backoffice/errors';
import type { FieldFunction, SchemaOverview } from '@backoffice/types';
import { getOutputTypeForFunction } from '@backoffice/utils';
import type { Knex } from 'knex';
import { parseJsonFunction, splitWildcard } from '../../../../helpers/fn/json/parse-function.js';
import type { FnHelperOptions } from '../../../../helpers/fn/types.js';
import { getFunctions, getHelpers } from '../../../../helpers/index.js';
import { getColumn } from '../../../utils/get-column.js';

function castToNumber(value: any): any {
	if (Array.isArray(value)) {
		return value.map((val) => {
			const num = Number(val);
			if (Number.isNaN(num)) throw new InvalidQueryError({ reason: `Invalid numeric value` });
			return num;
		});
	}

	const num = Number(value);
	if (Number.isNaN(num)) throw new InvalidQueryError({ reason: `Invalid numeric value` });
	return num;
}

type Helpers = ReturnType<typeof getHelpers>;

export function applyOperator(
	knex: Knex,
	dbQuery: Knex.QueryBuilder,
	schema: SchemaOverview,
	key: string,
	operator: string,
	compareValue: any,
	logical: 'and' | 'or' = 'and',
	originalCollectionName?: string,
) {
	const helpers = getHelpers(knex);
	// Backoffice (spec 023, research R3): split at the first dot only, a json path may contain dots.
	const dot = key.indexOf('.');
	const table = key.substring(0, dot);
	const column = key.substring(dot + 1);

	// Backoffice (spec 023, D-184): json(field, path[, type]) filters on the typed value at the path.
	const json = column.startsWith('json(') ? parseJsonFunction(column, { filter: true }) : undefined;

	const cast = (value: any) => {
		// Cast filter value (compareValue) based on function used
		if (json) return json.type === 'number' ? castToNumber(value) : value;

		if (column.includes('(') && column.includes(')')) {
			const functionName = column.split('(')[0] as FieldFunction;
			const type = getOutputTypeForFunction(functionName);

			if (['integer', 'float', 'decimal'].includes(type)) {
				value = castToNumber(value);
			}
		}

		// Cast filter value (compareValue) based on type of field being filtered against
		const mappedCollection = originalCollectionName || table;

		if (mappedCollection in schema.collections && column in schema.collections[mappedCollection]!.fields) {
			const type = schema.collections[mappedCollection]!.fields[column]!.type;

			if (['date', 'dateTime', 'time', 'timestamp'].includes(type)) {
				if (Array.isArray(value)) {
					value = value.map((val) => helpers.date.parse(val));
				} else {
					value = helpers.date.parse(value);
				}
			}

			if (['integer', 'float', 'decimal'].includes(type)) {
				value = castToNumber(value);
			}
		}

		return value;
	};

	const wildcard = json ? splitWildcard(json.path) : null;

	// Backoffice (spec 023, FR-002): `[*]` matches when at least one array element satisfies the operator.
	if (json && wildcard) {
		if (!addsCondition(operator, compareValue)) return;

		const fn = getFunctions(knex, schema);

		const options = (jsonPath: string): FnHelperOptions => ({
			type: 'json',
			originalCollectionName,
			relationalCountOptions: undefined,
			jsonPath,
			jsonType: json.type,
		});

		dbQuery[logical].whereExists(function () {
			this.select(knex.raw('1')).from(fn.jsonArrayElements(table, json.field, options(wildcard.before)));
			applyWhere(
				this,
				fn.jsonElement(table, json.field, options(wildcard.after)),
				key,
				operator,
				compareValue,
				'and',
				helpers,
				cast,
			);
		});

		return;
	}

	// Is processed through Knex.Raw, so should be safe to string-inject into these where queries
	const selectionRaw = getColumn(knex, table, column, false, schema, {
		originalCollectionName,
		jsonFilter: !!json,
	}) as any;

	applyWhere(dbQuery, selectionRaw, key, operator, compareValue, logical, helpers, cast);
}

/** Backoffice (spec 023): whether applyWhere adds a condition, so an empty `whereExists` is never added. */
function addsCondition(operator: string, compareValue: any): boolean {
	if (['_null', '_nnull', '_empty', '_nempty'].includes(operator)) return true;
	if (compareValue === undefined) return false;

	if (['_between', '_nbetween'].includes(operator)) {
		const value = typeof compareValue === 'string' ? compareValue.split(',') : compareValue;
		return Array.isArray(value) && value.length === 2;
	}

	return true;
}

// Backoffice (spec 023, research R3): the operator part of the DR applyOperator, on any selection and query builder
// (the `[*]` filter runs it inside `whereExists`). `_empty`, `_starts_with`, `_ends_with` and their negations use the
// selection like the other operators (DR used the key string, which gives the same SQL for a plain column).
function applyWhere(
	dbQuery: Knex.QueryBuilder,
	selectionRaw: any,
	key: string,
	operator: string,
	compareValue: any,
	logical: 'and' | 'or',
	helpers: Helpers,
	cast: (value: any) => any,
) {
	// Knex supports "raw" in the columnName parameter, but isn't typed as such. Too bad..
	// See https://github.com/knex/knex/issues/4518 @TODO remove as any once knex is updated

	// These operators don't rely on a value, and can thus be used without one (eg `?filter[field][_null]`)
	if (
		(operator === '_null' && compareValue !== false) ||
		(operator === '_nnull' && compareValue === false) ||
		(operator === '_eq' && compareValue === null)
	) {
		dbQuery[logical].whereNull(selectionRaw);
		return;
	}

	if (
		(operator === '_nnull' && compareValue !== false) ||
		(operator === '_null' && compareValue === false) ||
		(operator === '_neq' && compareValue === null)
	) {
		dbQuery[logical].whereNotNull(selectionRaw);
		return;
	}

	if ((operator === '_empty' && compareValue !== false) || (operator === '_nempty' && compareValue === false)) {
		dbQuery[logical].andWhere((query) => {
			query.whereNull(selectionRaw).orWhere(selectionRaw, '=', '');
		});
	}

	if ((operator === '_nempty' && compareValue !== false) || (operator === '_empty' && compareValue === false)) {
		dbQuery[logical].andWhere((query) => {
			query.whereNotNull(selectionRaw).andWhere(selectionRaw, '!=', '');
		});
	}

	// The following fields however, require a value to be run. If no value is passed, we
	// ignore them. This allows easier use in GraphQL, where you wouldn't be able to
	// conditionally build out your filter structure (#4471)
	if (compareValue === undefined) return;

	if (Array.isArray(compareValue)) {
		// Tip: when using a `[Type]` type in GraphQL, but don't provide the variable, it'll be
		// reported as [undefined].
		// We need to remove any undefined values, as they are useless
		compareValue = compareValue.filter((val) => val !== undefined);
	}

	compareValue = cast(compareValue);

	if (operator === '_eq') {
		dbQuery[logical].where(selectionRaw, '=', compareValue);
	}

	if (operator === '_neq') {
		dbQuery[logical].whereNot(selectionRaw, compareValue);
	}

	if (operator === '_ieq') {
		dbQuery[logical].whereRaw(`LOWER(??) = ?`, [selectionRaw, `${compareValue.toLowerCase()}`]);
	}

	if (operator === '_nieq') {
		dbQuery[logical].whereRaw(`LOWER(??) <> ?`, [selectionRaw, `${compareValue.toLowerCase()}`]);
	}

	if (operator === '_contains') {
		dbQuery[logical].where(selectionRaw, 'like', `%${compareValue}%`);
	}

	if (operator === '_ncontains') {
		dbQuery[logical].whereNot(selectionRaw, 'like', `%${compareValue}%`);
	}

	if (operator === '_icontains') {
		dbQuery[logical].whereRaw(`LOWER(??) LIKE ?`, [selectionRaw, `%${compareValue.toLowerCase()}%`]);
	}

	if (operator === '_nicontains') {
		dbQuery[logical].whereRaw(`LOWER(??) NOT LIKE ?`, [selectionRaw, `%${compareValue.toLowerCase()}%`]);
	}

	if (operator === '_starts_with') {
		dbQuery[logical].where(selectionRaw, 'like', `${compareValue}%`);
	}

	if (operator === '_nstarts_with') {
		dbQuery[logical].whereNot(selectionRaw, 'like', `${compareValue}%`);
	}

	if (operator === '_istarts_with') {
		dbQuery[logical].whereRaw(`LOWER(??) LIKE ?`, [selectionRaw, `${compareValue.toLowerCase()}%`]);
	}

	if (operator === '_nistarts_with') {
		dbQuery[logical].whereRaw(`LOWER(??) NOT LIKE ?`, [selectionRaw, `${compareValue.toLowerCase()}%`]);
	}

	if (operator === '_ends_with') {
		dbQuery[logical].where(selectionRaw, 'like', `%${compareValue}`);
	}

	if (operator === '_nends_with') {
		dbQuery[logical].whereNot(selectionRaw, 'like', `%${compareValue}`);
	}

	if (operator === '_iends_with') {
		dbQuery[logical].whereRaw(`LOWER(??) LIKE ?`, [selectionRaw, `%${compareValue.toLowerCase()}`]);
	}

	if (operator === '_niends_with') {
		dbQuery[logical].whereRaw(`LOWER(??) NOT LIKE ?`, [selectionRaw, `%${compareValue.toLowerCase()}`]);
	}

	if (operator === '_gt') {
		dbQuery[logical].where(selectionRaw, '>', compareValue);
	}

	if (operator === '_gte') {
		dbQuery[logical].where(selectionRaw, '>=', compareValue);
	}

	if (operator === '_lt') {
		dbQuery[logical].where(selectionRaw, '<', compareValue);
	}

	if (operator === '_lte') {
		dbQuery[logical].where(selectionRaw, '<=', compareValue);
	}

	if (operator === '_in') {
		let value = compareValue;
		if (typeof value === 'string') value = value.split(',');

		whereIn(dbQuery, logical, selectionRaw, value as string[], false);
	}

	if (operator === '_nin') {
		let value = compareValue;
		if (typeof value === 'string') value = value.split(',');

		whereIn(dbQuery, logical, selectionRaw, value as string[], true);
	}

	if (operator === '_between') {
		let value = compareValue;
		if (typeof value === 'string') value = value.split(',');

		if (value.length !== 2) return;

		dbQuery[logical].whereBetween(selectionRaw, value);
	}

	if (operator === '_nbetween') {
		let value = compareValue;
		if (typeof value === 'string') value = value.split(',');

		if (value.length !== 2) return;

		dbQuery[logical].whereNotBetween(selectionRaw, value);
	}

	if (operator == '_intersects') {
		dbQuery[logical].whereRaw(helpers.st.intersects(key, compareValue));
	}

	if (operator == '_nintersects') {
		dbQuery[logical].whereRaw(helpers.st.nintersects(key, compareValue));
	}

	if (operator == '_intersects_bbox') {
		dbQuery[logical].whereRaw(helpers.st.intersects_bbox(key, compareValue));
	}

	if (operator == '_nintersects_bbox') {
		dbQuery[logical].whereRaw(helpers.st.nintersects_bbox(key, compareValue));
	}
}

/**
 * Backoffice (spec 023): knex puts the bindings of a raw column (the json path of a typed json value) after the values
 * of whereIn, so `?` placeholders get the wrong values; spell the list out for such a column. Plain columns and
 * functions without bindings keep whereIn (same SQL as DR).
 */
function whereIn(
	dbQuery: Knex.QueryBuilder,
	logical: 'and' | 'or',
	selectionRaw: any,
	values: unknown[],
	not: boolean,
) {
	if (values.length > 0 && typeof selectionRaw?.toSQL === 'function' && selectionRaw.toSQL().bindings.length > 0) {
		dbQuery[logical].whereRaw(`? ${not ? 'not in' : 'in'} (${values.map(() => '?').join(', ')})`, [
			selectionRaw,
			...values,
		]);
		return;
	}

	dbQuery[logical][not ? 'whereNotIn' : 'whereIn'](selectionRaw, values as string[]);
}
