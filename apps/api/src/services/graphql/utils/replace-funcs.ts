// Ported from directus/api/src/services/graphql/utils/replace-funcs.ts
import { FUNCTIONS } from '@backoffice/constants';
import { InvalidQueryError } from '@backoffice/errors';
import type { Filter } from '@backoffice/types';
import { isPlainObject, transform } from 'lodash-es';
import { JSON_FILTER_TYPES } from '../../../database/helpers/fn/json/parse-function.js';
import { FIELD_COMPARE_OPERATORS } from '../../../database/run-ast/lib/apply-query/filter/field-compare.js';

/**
 * Backoffice (spec 023, D-186): `{ <f>_json: { path, text | number | boolean: operators } }` to the REST key
 * `json(<f>, <path>, <type>)`. Runs before sanitizeQuery, whose parseFilter would turn `path` into `{ _eq }`.
 * graphql-js argument objects have a null prototype, hence isPlainObject.
 */
export function replaceJsonPaths<T>(filter: T): T {
	if (Array.isArray(filter)) return filter.map((value) => replaceJsonPaths(value)) as T;
	if (!isPlainObject(filter)) return filter;

	return transform(
		filter as Record<string, any>,
		(result: Record<string, any>, value, key) => {
			if (key.endsWith('_json') && isPlainObject(value) && typeof value.path === 'string') {
				const types = JSON_FILTER_TYPES.filter((type) => value[type] !== undefined && value[type] !== null);

				if (types.length !== 1) {
					throw new InvalidQueryError({ reason: `"${key}" needs exactly one of ${JSON_FILTER_TYPES.join(', ')}` });
				}

				result[`json(${key.slice(0, -'_json'.length)}, ${value.path}, ${types[0]})`] = value[types[0]!];
				return;
			}

			result[key] = replaceJsonPaths(value);
		},
		{},
	) as T;
}

/**
 * Backoffice (spec 028, D-205): `{ <f>_field: { _gt: { field: 'b' } } }` to the REST value `{ <f>: { _gt: '$FIELD(b)' } }`,
 * merged into an existing `<f>` entry (the `_field` operator wins). The input is told from a real field named
 * `<f>_field` by its shape: every key one of the six operators and every value a `{ field }` object, which no scalar
 * operator input of a real field can be.
 */
export function replaceFieldCompares<T>(filter: T): T {
	if (Array.isArray(filter)) return filter.map((value) => replaceFieldCompares(value)) as T;
	if (!isPlainObject(filter)) return filter;

	return transform(
		filter as Record<string, any>,
		(result: Record<string, any>, value, key) => {
			if (key.endsWith('_field') && isFieldCompareInput(value)) {
				const field = key.slice(0, -'_field'.length);
				const compared = Object.fromEntries(
					Object.entries(value).map(([operator, ref]) => [operator, `$FIELD(${(ref as { field: string }).field})`]),
				);

				result[field] = isPlainObject(result[field]) ? { ...result[field], ...compared } : compared;
				return;
			}

			const replaced = replaceFieldCompares(value);
			// A `<f>` entry written before its `<f>_field` sibling keeps the compared operators.
			result[key] = isPlainObject(result[key]) && isPlainObject(replaced) ? { ...replaced, ...result[key] } : replaced;
		},
		{},
	) as T;
}

function isFieldCompareInput(value: unknown): value is Record<string, { field: string }> {
	if (!isPlainObject(value)) return false;
	const entries = Object.entries(value as Record<string, unknown>);

	return (
		entries.length > 0 &&
		entries.every(
			([operator, ref]) =>
				(FIELD_COMPARE_OPERATORS as readonly string[]).includes(operator) &&
				isPlainObject(ref) &&
				typeof (ref as { field?: unknown }).field === 'string',
		)
	);
}

/**
 * Backoffice (spec 023, D-186; spec 028, D-205): the query (or field arguments) with its `<f>_json` inputs as json(...)
 * keys and its `<f>_field` inputs as `$FIELD(b)` values, before sanitizeQuery.
 */
export function withBackofficeFilters<T extends { filter?: unknown }>(query: T): T {
	return query.filter ? { ...query, filter: replaceFieldCompares(replaceJsonPaths(query.filter)) } : query;
}

/**
 * Replace functions from GraphQL format to DR-Filter format
 */
export function replaceFuncs(filter: Filter): Filter {
	return replaceFuncDeep(filter);

	function replaceFuncDeep(filter: Record<string, any>) {
		return transform(filter, (result: Record<string, any>, value, key) => {
			const isFunctionKey =
				typeof key === 'string' && key.endsWith('_func') && FUNCTIONS.includes(Object.keys(value)[0]! as any);

			if (isFunctionKey) {
				const functionName = Object.keys(value)[0]!;
				const fieldName = key.slice(0, -5);

				result[`${functionName}(${fieldName})`] = Object.values(value)[0]!;
			} else {
				result[key] = value?.constructor === Object || value?.constructor === Array ? replaceFuncDeep(value) : value;
			}
		});
	}
}
