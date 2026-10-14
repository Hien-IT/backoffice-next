// Ported from directus/app/src/utils/get-related-collection.test.ts
import { beforeEach, expect, type Mock, test, vi } from 'vitest';
import { useRelationsStore } from '../stores/relations.ts';
import { getLocalTypeForField } from './get-local-type.ts';
import { getRelatedCollection } from './get-related-collection.ts';

// Backoffice: no @pinia/testing in apps/web; the stores are replaced by objects of spies.
const { mockFieldsStore, mockRelationsStore } = vi.hoisted(() => ({
	mockFieldsStore: { getField: vi.fn() },
	mockRelationsStore: { getRelationsForField: vi.fn() },
}));

vi.mock('../stores/fields.ts', () => ({ useFieldsStore: () => mockFieldsStore }));
vi.mock('../stores/relations.ts', () => ({ useRelationsStore: () => mockRelationsStore }));

beforeEach(() => {
	vi.resetAllMocks();
});

vi.mock('./get-local-type.ts');

test('Returns M2M as related + junction', () => {
	const relationsStore = useRelationsStore();

	(relationsStore.getRelationsForField as Mock).mockReturnValue([
		{
			collection: 'articles_categories',
			field: 'articles_id',
			related_collection: 'articles',
		},
		{
			collection: 'articles_categories',
			field: 'categories_id',
			related_collection: 'categories',
		},
	]);

	(getLocalTypeForField as Mock).mockReturnValue('m2m');

	expect(getRelatedCollection('articles', 'categories')).toEqual({
		relatedCollection: 'categories',
		junctionCollection: 'articles_categories',
		path: ['categories_id'],
	});
});

test('Returns other O2M as just related', () => {
	const relationsStore = useRelationsStore();

	(relationsStore.getRelationsForField as Mock).mockReturnValue([
		{
			collection: 'users',
			field: 'favorite_article',
			related_collection: 'articles',
		},
	]);

	(getLocalTypeForField as Mock).mockReturnValue('o2m');

	expect(getRelatedCollection('articles', 'favorited_by')).toEqual({
		relatedCollection: 'users',
	});
});

test('Returns M2O from related_collection rather than collection', () => {
	const relationsStore = useRelationsStore();

	(relationsStore.getRelationsForField as Mock).mockReturnValue([
		{
			collection: 'users',
			field: 'favorite_article',
			related_collection: 'articles',
		},
	]);

	(getLocalTypeForField as Mock).mockReturnValue('m2o');

	expect(getRelatedCollection('users', 'favorite_article')).toEqual({
		relatedCollection: 'articles',
	});
});

test('Returns null if no relation exists in the relationsStore', () => {
	const relationsStore = useRelationsStore();

	(relationsStore.getRelationsForField as Mock).mockReturnValue([]);

	expect(getRelatedCollection('users', 'favorite_article')).toEqual(null);
});
