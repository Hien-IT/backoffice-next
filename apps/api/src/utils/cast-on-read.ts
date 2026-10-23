// Ported from directus/api/src/services/payload.ts (read side of the cast-boolean, cast-json and cast-csv
// transformers). Used where feature 001 reads system rows with knex instead of ItemsService (research R16).
import { parseJSON } from '@backoffice/utils';

/** cast-boolean: 1/'1'/true → true, 0/'0'/false → false, null/'' → null, anything else unchanged. */
export function castBoolean(value: unknown): unknown {
	if (value === true || value === 1 || value === '1') {
		return true;
	} else if (value === false || value === 0 || value === '0') {
		return false;
	} else if (value === null || value === '') {
		return null;
	}

	return value;
}

/** cast-json: strings are parsed (no `__proto__`); invalid JSON keeps the string. */
export function castJson(value: unknown): unknown {
	if (typeof value === 'string') {
		try {
			return parseJSON(value);
		} catch {
			return value;
		}
	}

	return value;
}

/** cast-csv: arrays unchanged, '' → [], strings split on ','; other values unchanged (DR returns undefined, which keeps the value). */
export function castCsv(value: unknown): unknown {
	if (Array.isArray(value) === false && typeof value !== 'string') return value;
	if (Array.isArray(value)) return value;
	if (value === '') return [];
	return (value as string).split(',');
}
