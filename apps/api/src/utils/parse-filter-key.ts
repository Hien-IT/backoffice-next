// Ported from directus/api/src/utils/parse-filter-key.ts
/**
 * Result for keys with a function (e.g. `year(date_created)`):
 * - Group 1: Function (`year`)
 * - Group 3: Field (`date_created`)
 *
 * If group 3 is undefined, it is a key without a function.
 */
const FILTER_KEY_REGEX = /^([^()]+)(\(([^)]+)\))?/;

/**
 * Parses a filter key, returning its field name and function name (if defined) separately.
 *
 * Backoffice (spec 023, research R1): for `json(field, path[, type])` the field name is the json field itself, so the
 * read permission is checked on it; `jsonBaseField: false` keeps the DR result (the whole argument list).
 */
export function parseFilterKey(key: string, options: { jsonBaseField?: boolean } = {}) {
	const match = key.match(FILTER_KEY_REGEX);

	const fieldNameWithFunction = match?.[3]?.trim();
	const functionName = fieldNameWithFunction ? match?.[1]?.trim() : undefined;

	let fieldName = fieldNameWithFunction || key.trim();

	if (functionName === 'json' && options.jsonBaseField !== false) {
		fieldName = fieldName.split(',')[0]!.trim();
	}

	return { fieldName, functionName };
}
