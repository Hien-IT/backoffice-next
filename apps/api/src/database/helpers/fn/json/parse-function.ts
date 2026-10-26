// Ported from directus/api/src/database/helpers/fn/json/parse-function.ts
import { useEnv } from '@backoffice/env';
import { InvalidQueryError } from '@backoffice/errors';
import type { Type } from '@backoffice/types';

// Backoffice (spec 023, D-184): type of the value at the path in json(field, path, type).
export const JSON_FILTER_TYPES = ['text', 'number', 'boolean'] as const;

export type JsonFilterType = (typeof JSON_FILTER_TYPES)[number];

export type ParsedJsonFunction = { field: string; path: string; type?: JsonFilterType };

export type ParseJsonFunctionOptions = {
	/** Backoffice (spec 023): a filter key; one `[*]` allowed, the type defaults to text and must be known. */
	filter?: boolean;
};

// Backoffice (spec 023): `.key`, `[n]` or `[*]` segments only, so `items[` or `a..b` are refused in filters; a key
// has no `"` (SQLite reads `$."...` as a quoted label and fails on an unterminated one).
const FILTER_PATH_REGEX = /^(?:\.[^.[\]"]+|\[(?:\d+|\*)\])+$/;

/**
 * Calculates the depth of a JSON path by counting the number of property accesses and array accesses.
 * @example .color → 1
 * @example .settings.theme → 2
 * @example .items[0].name → 3
 * @example [0] → 1
 */
export function calculateJsonPathDepth(path: string): number {
	let depth = 0;

	for (let i = 0; i < path.length; i++) {
		if (path[i] === '.' || path[i] === '[') {
			depth++;
		}
	}

	return depth;
}

/**
 * Parses a json function selection into its field and path components.
 * Expects relational prefixes to have already been extracted by parseFilterFunctionPath,
 * so the field should always be a simple column name.
 * @example json(metadata, color) → { field: 'metadata', path: '.color' }
 * @example json(data, items[0].name) → { field: 'data', path: '.items[0].name' }
 */
export function parseJsonFunction(functionString: string, options: ParseJsonFunctionOptions = {}): ParsedJsonFunction {
	if (!functionString.startsWith('json(') || !functionString.endsWith(')')) {
		throw new InvalidQueryError({ reason: 'Invalid json() syntax' });
	}

	// Extract content between parentheses
	const content = functionString.substring('json('.length, functionString.length - 1).trim();

	if (!content) {
		throw new InvalidQueryError({ reason: 'Invalid json() syntax' });
	}

	// Split on comma to separate field from path
	const commaIndex = content.indexOf(',');

	if (commaIndex === -1) {
		throw new InvalidQueryError({ reason: 'Invalid json() syntax: requires json(field, path) format' });
	}

	if (commaIndex === 0) {
		throw new InvalidQueryError({ reason: 'Invalid json() syntax: missing field name' });
	}

	const field = content.substring(0, commaIndex).trim();
	let pathContent = content.substring(commaIndex + 1).trim();
	let type: JsonFilterType | undefined;

	// Backoffice (spec 023, FR-001): an optional third argument names the type of the value at the path. Outside filters
	// an unknown third part stays in the path, as in DR.
	const lastComma = pathContent.lastIndexOf(',');

	if (lastComma !== -1) {
		const candidate = pathContent.substring(lastComma + 1).trim();

		if ((JSON_FILTER_TYPES as readonly string[]).includes(candidate)) {
			type = candidate as JsonFilterType;
			pathContent = pathContent.substring(0, lastComma).trim();
		} else if (options.filter) {
			throw new InvalidQueryError({ reason: `Invalid json() syntax: unknown type "${candidate}"` });
		}
	}

	if (!pathContent) {
		throw new InvalidQueryError({ reason: 'Invalid json() syntax: missing path' });
	}

	const wildcards = pathContent.split('[*]').length - 1;

	if (options.filter && wildcards > 1) {
		throw new InvalidQueryError({ reason: 'Invalid json() syntax: only one [*] is allowed' });
	}

	// Backoffice (spec 023, FR-002): one `[*]` is allowed in filters only.
	const checked = options.filter ? pathContent.replace('[*]', '[0]') : pathContent;

	if (checked.includes('[]') || /[*?@$]/.test(checked)) {
		throw new InvalidQueryError({ reason: 'Invalid json() syntax: unsupported path expression' });
	}

	// Normalize path to always start with dot or bracket
	const path = pathContent.startsWith('[') ? pathContent : '.' + pathContent;

	if (options.filter && !FILTER_PATH_REGEX.test(path)) {
		throw new InvalidQueryError({ reason: 'Invalid json() syntax: unsupported path expression' });
	}

	// Validate JSON path depth
	// Backoffice: env is read when called, not when the module loads (convention of feature 001).
	const MAX_JSON_QUERY_DEPTH = Number(useEnv()['MAX_JSON_QUERY_DEPTH']);
	const depth = calculateJsonPathDepth(path);

	if (depth > MAX_JSON_QUERY_DEPTH) {
		throw new InvalidQueryError({
			reason: `JSON path depth (${depth}) exceeds allowed maximum of ${MAX_JSON_QUERY_DEPTH}`,
		});
	}

	if (options.filter) return { field, path, type: type ?? 'text' };

	return type ? { field, path, type } : { field, path };
}

/**
 * Backoffice (spec 023, FR-002): splits a path at its `[*]`.
 * @example .items[*].sku → { before: '.items', after: '.sku' }
 * @example [*] → { before: '', after: '' }
 */
export function splitWildcard(path: string): { before: string; after: string } | null {
	const index = path.indexOf('[*]');

	if (index === -1) return null;

	return { before: path.substring(0, index), after: path.substring(index + 3) };
}

/** Backoffice (spec 023, FR-003): the field type whose operators apply to a json path of the given type. */
export function jsonFilterType(type: JsonFilterType): Type {
	if (type === 'number') return 'float';
	if (type === 'boolean') return 'boolean';
	return 'string';
}
