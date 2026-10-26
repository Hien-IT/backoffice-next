// Backoffice (spec 023, D-187): the json(field, path, type) filter key on the client. The grammar is a copy of
// apps/api/src/database/helpers/fn/json/parse-function.ts in filter mode (apps/web has no @backoffice/* dependency).
import type { Type } from '@directus/types';

export type JsonPathType = 'text' | 'number' | 'boolean';

export const JSON_PATH_TYPES: JsonPathType[] = ['text', 'number', 'boolean'];

// `.key`, `[n]` or `[*]` segments; a key has no `.`, brackets, `"`, comma or parenthesis (they would break the key).
const PATH_REGEX = /^(?:\.[^.[\]",()]+|\[(?:\d+|\*)\])+$/;
const MAX_DEPTH = 10;

export interface JsonPathKey {
	field: string;
	path: string;
	type: JsonPathType;
}

/** `json(meta, items[*].sku, text)` → `{ field: 'meta', path: 'items[*].sku', type: 'text' }`; null for anything else. */
export function parseJsonPathKey(key: string): JsonPathKey | null {
	const match = /^json\(([^,()]+),(.+)\)$/.exec(key.trim());
	if (!match) return null;

	const field = match[1]!.trim();
	let path = match[2]!.trim();
	let type: JsonPathType = 'text';
	const lastComma = path.lastIndexOf(',');

	if (lastComma !== -1) {
		const candidate = path.slice(lastComma + 1).trim();
		if (!(JSON_PATH_TYPES as string[]).includes(candidate)) return null;
		type = candidate as JsonPathType;
		path = path.slice(0, lastComma).trim();
	}

	return field && path ? { field, path, type } : null;
}

/** The FieldList placeholder of the "JSON path" entry: `json(meta)` or `json(author.tags)` (no path yet). */
export function isJsonPathPlaceholder(key: string): boolean {
	return /^json\([^,()]+\)$/.test(key.trim());
}

export function formatJsonPathKey(field: string, path: string, type: JsonPathType): string {
	return `json(${field}, ${path.trim()}, ${type})`;
}

/** Whether a path typed by the user is valid (same rules as the API in filters, plus no comma or parenthesis). */
export function isValidJsonPath(path: string): boolean {
	const trimmed = path.trim();
	if (!trimmed) return false;
	if (trimmed.split('[*]').length > 2) return false;
	if (/[*?@$]/.test(trimmed.replace('[*]', '[0]')) || trimmed.includes('[]')) return false;

	const normalized = trimmed.startsWith('[') ? trimmed : `.${trimmed}`;
	if (!PATH_REGEX.test(normalized)) return false;

	return [...normalized].filter((char) => char === '.' || char === '[').length <= MAX_DEPTH;
}

/** The field type whose filter operators apply to a json path of the given type (FR-003). */
export function jsonFilterType(type: JsonPathType): Type {
	if (type === 'number') return 'float';
	if (type === 'boolean') return 'boolean';
	return 'string';
}
