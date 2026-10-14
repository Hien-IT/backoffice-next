// Ported from directus/app/src/utils/extract-field-from-function.ts
import type { FieldFunction } from '@directus/types';

// Backoffice: @directus/constants is not a dependency of apps/web; the constant is copied from its regex.ts.
const REGEX_BETWEEN_PARENS = /\(([^()]+)\)/;

/**
 * Extracts the function and field name of a field wrapped in a function
 *
 * @param fieldKey - Field in function, for example `year(date_created)`
 * @return Object of function name and field key
 *
 * @example
 * ```js
 * extractFieldFromFunction('year(date_created)');
 * // => { fn: 'year', field: 'date_created' }
 * ```
 */
export function extractFieldFromFunction(fieldKey: string): { fn: FieldFunction | null; field: string } {
	let functionName;

	if (fieldKey.includes('(') && fieldKey.includes(')')) {
		functionName = fieldKey.split('(')[0] as FieldFunction | undefined;
		const match = fieldKey.match(REGEX_BETWEEN_PARENS);
		if (match) fieldKey = match[1] as string;
	}

	return { fn: functionName ?? null, field: fieldKey };
}
