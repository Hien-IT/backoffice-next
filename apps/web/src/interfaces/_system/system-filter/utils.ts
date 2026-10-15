// Ported from directus/app/src/interfaces/_system/system-filter/utils.ts; Ported from directus/app/src/utils/extract-field-from-function.ts
import type { FieldFunction, Filter } from '@directus/types';
import { get, isPlainObject } from 'lodash-es';

export function getNodeName(node: Filter): string {
	if (!node) return '';
	return Object.keys(node)[0]!;
}

export function getField(node: Record<string, any>): string {
	const name = getNodeName(node);
	if (name.startsWith('_')) return '';
	if (!isPlainObject(node[name])) return '';

	const subFields = getField(node[name]);
	return subFields !== '' ? `${name}.${subFields}` : name;
}

export function fieldHasFunction(field: string) {
	return field.includes('(') && field.includes(')');
}

export function getComparator(node: Record<string, any>): string {
	return getNodeName(get(node, getField(node)));
}

export function fieldToFilter(field: string, operator: string, value: any): Record<string, any> {
	return fieldToFilterR(field.split('.'));

	function fieldToFilterR(sections: string[]): Record<string, any> {
		const section = sections.shift();

		if (section !== undefined) {
			return {
				[section]: fieldToFilterR(sections),
			};
		} else {
			return {
				[operator]: value,
			};
		}
	}
}

// Backoffice: REGEX_BETWEEN_PARENS of @directus/constants (not a dependency of apps/web), same pattern.
const REGEX_BETWEEN_PARENS = /\(([^()]+)\)/;

/** Function and field of a field wrapped in a function, `year(date_created)` → `{ fn: 'year', field: 'date_created' }`. */
export function extractFieldFromFunction(fieldKey: string): { fn: FieldFunction | null; field: string } {
	let functionName;

	if (fieldKey.includes('(') && fieldKey.includes(')')) {
		functionName = fieldKey.split('(')[0] as FieldFunction | undefined;
		const match = fieldKey.match(REGEX_BETWEEN_PARENS);
		if (match) fieldKey = match[1] as string;
	}

	return { fn: functionName ?? null, field: fieldKey };
}
