import type { Field, Relation } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { calls, mockApi } from '../test-utils/fetch.ts';
import { useFieldsStore } from './fields.ts';
import { useRelationsStore } from './relations.ts';

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());

const field = (collection: string, name: string) => ({ collection, field: name, name, meta: null }) as unknown as Field;

const relation = (collection: string, name: string, related: string | null, meta: Record<string, unknown> = {}) =>
	({
		collection,
		field: name,
		related_collection: related,
		meta: { one_field: null, junction_field: null, ...meta },
	}) as unknown as Relation;

const m2o = relation('articles', 'author', 'authors', { one_field: 'articles' });
const junctionToArticle = relation('articles_tags', 'articles_id', 'articles', {
	one_field: 'tags',
	junction_field: 'tags_id',
});
const junctionToTag = relation('articles_tags', 'tags_id', 'tags', { junction_field: 'articles_id' });

function setup() {
	const fieldsStore = useFieldsStore();
	const relationsStore = useRelationsStore();

	fieldsStore.fields = [field('articles', 'author'), field('articles', 'tags'), field('authors', 'articles')];
	relationsStore.relations = [m2o, junctionToArticle, junctionToTag, relation('other', 'x', 'others')];

	return relationsStore;
}

test('hydrate reads /relations and dehydrate empties the store', async () => {
	const fetch = mockApi({ 'GET /relations': [m2o] });
	const relationsStore = useRelationsStore();

	await relationsStore.hydrate();
	expect(calls(fetch)).toEqual(['GET /relations']);
	expect(relationsStore.relations).toEqual([m2o]);

	relationsStore.dehydrate();
	expect(relationsStore.relations).toEqual([]);
});

test('getRelationsForCollection returns relations on either side', () => {
	const relationsStore = setup();

	expect(relationsStore.getRelationsForCollection('articles')).toEqual([m2o, junctionToArticle]);
});

test('getRelationsForField returns the m2o, the o2m side and both m2m relations', () => {
	const relationsStore = setup();

	expect(relationsStore.getRelationsForField('articles', 'author')).toEqual([m2o]);
	expect(relationsStore.getRelationsForField('authors', 'articles')).toEqual([m2o]);
	expect(relationsStore.getRelationsForField('articles', 'tags')).toEqual([junctionToArticle, junctionToTag]);
	expect(relationsStore.getRelationsForField('articles', 'missing')).toEqual([]);
});

test('getRelationForField returns only the m2o of the field', () => {
	const relationsStore = setup();

	expect(relationsStore.getRelationForField('articles', 'author')).toEqual(m2o);
	expect(relationsStore.getRelationForField('articles', 'tags')).toBeNull();
	expect(relationsStore.getRelationForField('articles', 'missing')).toBeNull();
	expect(relationsStore.getRelationType).toBeTypeOf('function');
});

// Feature 016 T013: upsertRelation of DR stores/relations.ts.
describe('upsertRelation (016)', () => {
	test('POST /relations when the field has no relation, PATCH /relations/:c/:f when it has one', async () => {
		const fieldsStore = useFieldsStore();
		fieldsStore.fields = [{ collection: 'a', field: 'm2o', type: 'integer', meta: null, schema: {} }].map(
			fieldsStore.parseField as never,
		) as never;
		const store = useRelationsStore();
		const created = { collection: 'a', field: 'm2o', related_collection: 'b', meta: null, schema: {} };
		const fetch = mockApi({
			'POST /relations': created,
			'PATCH /relations/a/m2o': { ...created, schema: { on_delete: 'CASCADE' } },
		});

		await store.upsertRelation('a', 'm2o', created as never);
		await store.upsertRelation('a', 'm2o', { schema: { on_delete: 'CASCADE' } } as never);

		expect(calls(fetch)).toEqual(['POST /relations', 'PATCH /relations/a/m2o']);
		expect((store.relations[0]!.schema as { on_delete: string }).on_delete).toBe('CASCADE');
	});
});
