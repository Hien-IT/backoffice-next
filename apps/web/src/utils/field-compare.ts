// Backoffice (spec 028, D-206): the `$FIELD(b)` filter value on the client. The grammar is a copy of
// apps/api/src/database/run-ast/lib/apply-query/filter/field-compare.ts (apps/web has no @backoffice/* dependency).
import type { Type } from '@directus/types';

export const FIELD_COMPARE_OPERATORS = ['_eq', '_neq', '_gt', '_gte', '_lt', '_lte'] as const;

export type FieldCompareOperator = (typeof FIELD_COMPARE_OPERATORS)[number];

/** Clarify 2026-11-01: numbers and strings compare across their stored types, date types only with the same one. */
export type FieldCompareGroup = 'number' | 'string' | 'boolean' | 'uuid' | 'date' | 'dateTime' | 'timestamp';

const GROUPS: Partial<Record<Type, FieldCompareGroup>> = {
	integer: 'number',
	bigInteger: 'number',
	float: 'number',
	decimal: 'number',
	string: 'string',
	text: 'string',
	boolean: 'boolean',
	uuid: 'uuid',
	date: 'date',
	dateTime: 'dateTime',
	timestamp: 'timestamp',
};

const VALUE = /^\$FIELD\((.*)\)$/s;

export function isFieldCompareOperator(operator: string): operator is FieldCompareOperator {
	return (FIELD_COMPARE_OPERATORS as readonly string[]).includes(operator);
}

/** The field name inside `$FIELD(...)`, trimmed; null for any other value. */
export function parseFieldCompare(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const match = VALUE.exec(value);
	return match ? match[1]!.trim() : null;
}

export function formatFieldCompare(field: string): string {
	return `$FIELD(${field})`;
}

export function fieldCompareGroup(type: Type | string | undefined): FieldCompareGroup | null {
	return (type && GROUPS[type as Type]) || null;
}
