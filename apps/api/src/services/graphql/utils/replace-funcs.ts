// Ported from directus/api/src/services/graphql/utils/replace-funcs.ts
import { FUNCTIONS } from '@backoffice/constants';
import { InvalidQueryError } from '@backoffice/errors';
import type { Filter } from '@backoffice/types';
import { isPlainObject, transform } from 'lodash-es';
import { JSON_FILTER_TYPES } from '../../../database/helpers/fn/json/parse-function.js';

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

/** Backoffice (spec 023, D-186): the query (or field arguments) with its `<f>_json` filter inputs as json(...) keys. */
export function withJsonPaths<T extends { filter?: unknown }>(query: T): T {
	return query.filter ? { ...query, filter: replaceJsonPaths(query.filter) } : query;
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
