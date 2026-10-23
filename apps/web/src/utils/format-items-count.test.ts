import { describe, expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import { formatItemsCountPaginated, formatItemsCountRelative } from './format-items-count.ts';

const { t, n } = i18n.global;
const i18nArg = { t, n };

describe('formatItemsCountPaginated', () => {
	test('one page', () => {
		expect(formatItemsCountPaginated({ currentItems: 0, currentPage: 1, perPage: 25, i18n: i18nArg })).toBe('No Items');
		expect(formatItemsCountPaginated({ currentItems: 1, currentPage: 1, perPage: 25, i18n: i18nArg })).toBe('One Item');
		expect(formatItemsCountPaginated({ currentItems: 7, currentPage: 1, perPage: 25, i18n: i18nArg })).toBe('7 Items');
	});

	test('several pages', () => {
		expect(formatItemsCountPaginated({ currentItems: 60, currentPage: 3, perPage: 25, i18n: i18nArg })).toBe(
			'51-60 of 60 Items',
		);
	});

	test('filtered, one page and several pages', () => {
		const filtered = { isFiltered: true, totalItems: 100, currentPage: 1, perPage: 25, i18n: i18nArg };
		expect(formatItemsCountPaginated({ ...filtered, currentItems: 3 })).toBe('3 Filtered Items');
		expect(formatItemsCountPaginated({ ...filtered, currentItems: 40 })).toBe('1-25 of 40 Filtered Items');
	});

	test('a filter that keeps every item counts as no filter', () => {
		expect(
			formatItemsCountPaginated({
				currentItems: 7,
				totalItems: 7,
				isFiltered: true,
				currentPage: 1,
				perPage: 25,
				i18n: i18nArg,
			}),
		).toBe('7 Items');
	});
});

describe('formatItemsCountRelative', () => {
	test('filtered', () => {
		expect(formatItemsCountRelative({ totalItems: 10, currentItems: 4, isFiltered: true, i18n: i18nArg })).toBe(
			'4 Filtered Items',
		);
	});

	test('count_of_total_items when fewer items than the total', () => {
		expect(formatItemsCountRelative({ totalItems: 8, currentItems: 4, i18n: i18nArg })).toBe('4 of 8 Items');
	});

	test('item_count of the total otherwise', () => {
		expect(formatItemsCountRelative({ totalItems: 8, currentItems: 8, i18n: i18nArg })).toBe('8 Items');
		expect(formatItemsCountRelative({ totalItems: 8, currentItems: 8, isFiltered: true, i18n: i18nArg })).toBe(
			'8 Items',
		);
	});

	// DR compares the formatted strings, so "10" > "9" is false and item_count shows {count}.
	test('compares the formatted strings like Directus', () => {
		expect(formatItemsCountRelative({ totalItems: 10, currentItems: 9, i18n: i18nArg })).toBe('9 Items');
	});
});
