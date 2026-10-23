// DR has no test for use-relation-m2a.ts: relation info of the fixture m2a field (data-model §2).
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { replaceQueue } from '../api/sdk.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { useRelationM2A } from './use-relation-m2a.ts';

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	mockFixtureApi(loadSnapshot());
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
});

test('m2a: junction, collection field and the allowed collections with their primary keys', () => {
	const { relationInfo } = useRelationM2A(ref('bo_rel'), ref('m2a'));
	const info = relationInfo.value!;

	expect(info.type).toBe('m2a');
	expect(info.junctionCollection.collection).toBe('bo_junction_m2a');
	expect(info.junctionPrimaryKeyField.field).toBe('id');
	expect(info.junctionField.field).toBe('item');
	expect(info.reverseJunctionField.field).toBe('bo_rel_id');
	expect(info.collectionField.field).toBe('collection');
	expect(info.sortField).toBe('sort');
	expect(info.junction.field).toBe('bo_rel_id');
	expect(info.relation.field).toBe('item');
	expect(info.allowedCollections.map((c) => c.collection)).toEqual(['bo_m2a_a', 'bo_m2a_b']);
	expect(Object.fromEntries(Object.entries(info.relationPrimaryKeyFields).map(([c, f]) => [c, f.field]))).toEqual({
		bo_m2a_a: 'id',
		bo_m2a_b: 'id',
	});
});

test('an allowed collection missing from the collections store is left out', () => {
	useCollectionsStore().collections = useCollectionsStore().collections.filter((c) => c.collection !== 'bo_m2a_b');

	const { relationInfo } = useRelationM2A(ref('bo_rel'), ref('m2a'));

	expect(relationInfo.value?.allowedCollections.map((c) => c.collection)).toEqual(['bo_m2a_a']);
	expect(Object.keys(relationInfo.value!.relationPrimaryKeyFields)).toEqual(['bo_m2a_a']);
});

test('undefined for a field that is not an m2a/m2m alias', () => {
	expect(useRelationM2A(ref('bo_rel'), ref('m2o')).relationInfo.value).toBeUndefined();
	expect(useRelationM2A(ref('bo_rel'), ref('o2m_list')).relationInfo.value).toBeUndefined();
});
