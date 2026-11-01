// Backoffice (spec 028, D-206): the client copy of the `$FIELD(b)` grammar and type groups.
import { describe, expect, test } from 'vitest';
import { fieldCompareGroup, formatFieldCompare, isFieldCompareOperator, parseFieldCompare } from './field-compare.ts';

describe('parseFieldCompare', () => {
	test.each([
		['$FIELD(b)', 'b'],
		['$FIELD( paid_amount )', 'paid_amount'],
		['$FIELD(a.b)', 'a.b'],
		['$FIELD()', ''],
	])('%s → %s', (value, field) => {
		expect(parseFieldCompare(value)).toBe(field);
	});

	test.each([
		'$FIELD',
		'$FIELD(b',
		'$field(b)',
		'b',
		'$NOW(-1 day)',
		'$CURRENT_USER',
		1,
		null,
		undefined,
		['$FIELD(b)'],
	])('%s is a plain value', (value) => {
		expect(parseFieldCompare(value)).toBeNull();
	});
});

test('formatFieldCompare and parseFieldCompare are inverse', () => {
	expect(formatFieldCompare('paid_amount')).toBe('$FIELD(paid_amount)');
	expect(parseFieldCompare(formatFieldCompare('paid_amount'))).toBe('paid_amount');
});

test('isFieldCompareOperator: the six comparison operators only', () => {
	expect(['_eq', '_neq', '_gt', '_gte', '_lt', '_lte'].every(isFieldCompareOperator)).toBe(true);
	expect(['_in', '_contains', '_null', '_between', '_starts_with'].some(isFieldCompareOperator)).toBe(false);
});

describe('fieldCompareGroup', () => {
	test.each([
		['integer', 'number'],
		['bigInteger', 'number'],
		['float', 'number'],
		['decimal', 'number'],
		['string', 'string'],
		['text', 'string'],
		['boolean', 'boolean'],
		['uuid', 'uuid'],
		['date', 'date'],
		['dateTime', 'dateTime'],
		['timestamp', 'timestamp'],
	])('%s → %s', (type, group) => {
		expect(fieldCompareGroup(type)).toBe(group);
	});

	test.each(['time', 'hash', 'json', 'csv', 'geometry.Point', 'binary', 'alias', 'unknown', undefined])(
		'%s has no group',
		(type) => {
			expect(fieldCompareGroup(type)).toBeNull();
		},
	);
});
