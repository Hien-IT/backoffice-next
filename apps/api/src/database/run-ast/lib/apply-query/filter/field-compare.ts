// Backoffice (spec 028, D-203): the dynamic filter value `$FIELD(<b>)` compares the filtered field with field b of the
// same item and collection (research R1, R2). DR has no such value; it would compare with the literal string.
import { InvalidQueryError } from '@backoffice/errors';
import type { SchemaOverview, Type } from '@backoffice/types';

export const FIELD_COMPARE_OPERATORS = ['_eq', '_neq', '_gt', '_gte', '_lt', '_lte'] as const;

export type FieldCompareOperator = (typeof FIELD_COMPARE_OPERATORS)[number];

export const FIELD_COMPARE_SQL: Record<FieldCompareOperator, '=' | '<>' | '>' | '>=' | '<' | '<='> = {
	_eq: '=',
	_neq: '<>',
	_gt: '>',
	_gte: '>=',
	_lt: '<',
	_lte: '<=',
};

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
const NAME = /^[^\s().,]+$/;

export function isFieldCompareOperator(operator: string): operator is FieldCompareOperator {
	return (FIELD_COMPARE_OPERATORS as readonly string[]).includes(operator);
}

/** A field key of the same collection: no dot (relation), parenthesis, comma or space. */
export function isFieldCompareName(name: string): boolean {
	return NAME.test(name);
}

/** The field name inside `$FIELD(...)`, trimmed and not yet checked; null for any other value. */
export function parseFieldCompare(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const match = VALUE.exec(value);
	return match ? match[1]!.trim() : null;
}

export function fieldCompareGroup(type: Type | undefined): FieldCompareGroup | null {
	return (type && GROUPS[type]) || null;
}

/** 400 unless field b is a column of the collection in the type group of field a (FR-003, FR-007). */
export function assertFieldCompare(schema: SchemaOverview, collection: string, fieldA: string, fieldB: string): void {
	const raw = `"$FIELD(${fieldB})"`;

	if (!isFieldCompareName(fieldB)) {
		throw new InvalidQueryError({
			reason: `${raw}: a field of the same collection is expected (no relation, no spaces)`,
		});
	}

	const fields = schema.collections[collection]?.fields ?? {};
	const b = fields[fieldB];

	if (!b) {
		throw new InvalidQueryError({ reason: `${raw}: unknown field "${fieldB}" in collection "${collection}"` });
	}

	if (b.alias || b.type === 'alias') {
		throw new InvalidQueryError({ reason: `${raw} must be a column field` });
	}

	const a = fields[fieldA];
	const groupA = fieldCompareGroup(a?.type);

	if (!groupA) {
		throw new InvalidQueryError({
			reason: `${raw}: "${fieldA}" (${a?.type ?? 'unknown'}) cannot be compared with another field`,
		});
	}

	if (fieldCompareGroup(b.type) !== groupA) {
		throw new InvalidQueryError({ reason: `${raw} must be a ${groupA} field like "${fieldA}" (got ${b.type})` });
	}
}

/** Whether a filter compares two fields anywhere (D-204: refused in permissions). */
export function hasFieldCompare(filter: unknown): boolean {
	if (Array.isArray(filter)) return filter.some(hasFieldCompare);
	if (typeof filter !== 'object' || filter === null) return false;

	return Object.entries(filter).some(([key, value]) =>
		isFieldCompareOperator(key) ? parseFieldCompare(value) !== null : hasFieldCompare(value),
	);
}
