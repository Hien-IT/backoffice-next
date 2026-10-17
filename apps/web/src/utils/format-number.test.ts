import { describe, expect, test } from 'vitest';
import { formatNumber, isUnit } from './format-number.ts';

describe('formatNumber', () => {
	test('formats with the given locale', () => {
		expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5');
		expect(formatNumber(1234.5, 'vi-VN')).toBe('1.234,5');
	});

	test('compact notation and fraction digits', () => {
		expect(formatNumber(12345, 'en-US', { notation: 'compact' })).toBe('12K');
		expect(formatNumber(1.5, 'en-US', { minimumFractionDigits: 2 })).toBe('1.50');
	});

	test('drops a unit or currency that does not match the style', () => {
		expect(formatNumber(3, 'en-US', { style: 'decimal', unit: 'meter' } as never)).toBe('3');
		expect(formatNumber(3, 'en-US', { style: 'unit', unit: 'meter' })).toBe('3 m');
		expect(formatNumber(3, 'en-US', { style: 'currency', currency: 'USD' })).toBe('$3.00');
	});

	test('falls back to the plain value on an invalid option', () => {
		expect(formatNumber(3, 'en-US', { style: 'currency', currency: 'not-a-code' })).toBe('3');
	});
});

test('isUnit accepts simple and per units', () => {
	expect(isUnit('meter')).toBe(true);
	expect(isUnit('kilometer-per-hour')).toBe(true);
	expect(isUnit('parsec')).toBe(false);
});
