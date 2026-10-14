// Ported from directus/app/src/utils/add-related-primary-key-to-fields.test.ts
// Backoffice: the real fields store with spies instead of @pinia/testing (not a dependency); no crypto stub needed.
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useFieldsStore } from '../stores/fields.ts';
import { addRelatedPrimaryKeyToFields } from './add-related-primary-key-to-fields.ts';

beforeEach(() => {
	setActivePinia(createPinia());
});

test('Returns empty array when empty array is passed', () => {
	const output = addRelatedPrimaryKeyToFields('articles', []);
	expect(output).toEqual([]);
});

test('Returns array as-is if no relational fields are passed', () => {
	const output = addRelatedPrimaryKeyToFields('articles', ['id', 'title']);
	expect(output).toEqual(['id', 'title']);
});

test('Retrieves related primary key from store and adds to array', () => {
	const store = useFieldsStore();
	vi.spyOn(store, 'getField').mockReturnValueOnce({ collection: 'test' } as any);
	vi.spyOn(store, 'getPrimaryKeyFieldForCollection').mockReturnValueOnce({ field: 'test_pk' } as any);

	const output = addRelatedPrimaryKeyToFields('articles', ['id', 'title', 'author.name']);
	expect(output).toEqual(['id', 'title', 'author.name', 'author.test_pk']);
});

test('Ignores adding primary key related collection cannot be found', () => {
	const store = useFieldsStore();
	vi.spyOn(store, 'getField').mockReturnValueOnce(null);

	const output = addRelatedPrimaryKeyToFields('articles', ['id', 'title', 'author.name']);
	expect(output).toEqual(['id', 'title', 'author.name']);
});

test('Ignores adding primary key if it already exists', () => {
	const store = useFieldsStore();
	vi.spyOn(store, 'getField').mockReturnValueOnce({ collection: 'test' } as any);
	vi.spyOn(store, 'getPrimaryKeyFieldForCollection').mockReturnValueOnce({ field: 'test_pk' } as any);

	const output = addRelatedPrimaryKeyToFields('articles', ['id', 'title', 'author.name', 'author.title']);
	expect(output).toEqual(['id', 'title', 'author.name', 'author.test_pk', 'author.title']);
});

afterEach(() => {
	vi.clearAllMocks();
});
