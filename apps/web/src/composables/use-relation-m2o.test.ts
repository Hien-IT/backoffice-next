// Directus has no test for use-relation-m2o.ts: relation info of the fixture m2o fields (data-model §2).
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { replaceQueue } from '../api/sdk.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { useRelationM2O } from './use-relation-m2o.ts';

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	mockFixtureApi(loadSnapshot());
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
});

test('m2o field: related collection and its primary key', () => {
	const { relationInfo } = useRelationM2O(ref('bo_rel'), ref('m2o'));

	expect(relationInfo.value?.type).toBe('m2o');
	expect(relationInfo.value?.relation.field).toBe('m2o');
	expect(relationInfo.value?.relatedCollection.collection).toBe('bo_rel_target');
	expect(relationInfo.value?.relatedPrimaryKeyField.field).toBe('id');
});

test('m2o to a system collection', () => {
	const { relationInfo } = useRelationM2O(ref('bo_rel'), ref('owner'));

	expect(relationInfo.value?.relatedCollection.collection).toBe('directus_users');
	expect(relationInfo.value?.relatedPrimaryKeyField.field).toBe('id');
});

test('follows the field ref and is undefined without a relation', () => {
	const field = ref('m2o');
	const { relationInfo } = useRelationM2O(ref('bo_rel'), field);

	field.value = 'title';
	expect(relationInfo.value).toBeUndefined();

	field.value = 'file';
	expect(relationInfo.value?.relatedCollection.collection).toBe('directus_files');
});
