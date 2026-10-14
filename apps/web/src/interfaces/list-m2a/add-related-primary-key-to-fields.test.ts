// Ported from directus/app/src/utils/add-related-primary-key-to-fields.test.ts
// Backoffice: no @pinia/testing in apps/web; the fields store is mocked with vi.mock.
import { afterEach, expect, test, vi } from 'vitest';
import { useFieldsStore } from '../../stores/fields.ts';
import { addRelatedPrimaryKeyToFields } from './add-related-primary-key-to-fields.ts';

vi.mock('../../stores/fields.ts', () => {
	const store = { getField: vi.fn(), getPrimaryKeyFieldForCollection: vi.fn() };
	return { useFieldsStore: () => store };
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
	vi.mocked(store.getField).mockReturnValueOnce({ collection: 'test' } as never);
	vi.mocked(store.getPrimaryKeyFieldForCollection).mockReturnValueOnce({ field: 'test_pk' } as never);

	const output = addRelatedPrimaryKeyToFields('articles', ['id', 'title', 'author.name']);
	expect(output).toEqual(['id', 'title', 'author.name', 'author.test_pk']);
});

test('Ignores adding primary key related collection cannot be found', () => {
	const store = useFieldsStore();
	vi.mocked(store.getField).mockReturnValueOnce(undefined as never);

	const output = addRelatedPrimaryKeyToFields('articles', ['id', 'title', 'author.name']);
	expect(output).toEqual(['id', 'title', 'author.name']);
});

test('Ignores adding primary key if it already exists', () => {
	const store = useFieldsStore();
	vi.mocked(store.getField).mockReturnValueOnce({ collection: 'test' } as never);
	vi.mocked(store.getPrimaryKeyFieldForCollection).mockReturnValueOnce({ field: 'test_pk' } as never);

	const output = addRelatedPrimaryKeyToFields('articles', ['id', 'title', 'author.name', 'author.title']);
	expect(output).toEqual(['id', 'title', 'author.name', 'author.test_pk', 'author.title']);
});

afterEach(() => {
	vi.clearAllMocks();
});
