// Ported from directus/app/src/utils/format-field-function.test.ts
// Backoffice: a real pinia with getField spied instead of @pinia/testing (not a dependency); no crypto stub needed.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, type Mock, test, vi } from 'vitest';
import { useFieldsStore } from '../../../stores/fields.ts';
import { formatFieldFunction } from './format-field-function.ts';

beforeEach(() => {
	setActivePinia(createPinia());
	vi.spyOn(useFieldsStore(), 'getField').mockReturnValue(null);
});

test('Returns original field key if no function is passed, and field cannot be found', () => {
	expect(formatFieldFunction('articles', 'date_created')).toBe('date_created');
});

test('Returns translated field key if no function is passed', () => {
	(useFieldsStore().getField as Mock).mockReturnValueOnce({ name: 'Date Created' });
	expect(formatFieldFunction('articles', 'date_created')).toBe('Date Created');
});

test('Returns translated function with field key if field cannot be found in store', () => {
	expect(formatFieldFunction('articles', 'year(date_created)')).toBe('Year (date_created)');
});

test('Returns translated field key and function', () => {
	(useFieldsStore().getField as Mock).mockReturnValueOnce({ name: 'Date Created' });
	expect(formatFieldFunction('articles', 'year(date_created)')).toBe('Year (Date Created)');
});
