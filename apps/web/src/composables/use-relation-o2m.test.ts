// DR has no test for use-relation-o2m.ts: relation info of the fixture o2m fields (data-model §2).
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { replaceQueue } from '../api/sdk.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { useRelationO2M } from './use-relation-o2m.ts';

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	mockFixtureApi(loadSnapshot());
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
});

test('o2m with a sort field', () => {
	const { relationInfo } = useRelationO2M(ref('bo_rel'), ref('o2m_list'));

	expect(relationInfo.value?.type).toBe('o2m');
	expect(relationInfo.value?.relatedCollection.collection).toBe('bo_rel_target');
	expect(relationInfo.value?.relatedPrimaryKeyField.field).toBe('id');
	expect(relationInfo.value?.reverseJunctionField.field).toBe('o2m_list_parent');
	expect(relationInfo.value?.sortField).toBe('sort');
	expect(relationInfo.value?.relation.meta?.one_deselect_action).toBe('nullify');
});

test('o2m without a sort field, deselect action delete', () => {
	const { relationInfo } = useRelationO2M(ref('bo_rel'), ref('o2m_table'));

	expect(relationInfo.value?.reverseJunctionField.field).toBe('o2m_table_parent');
	expect(relationInfo.value?.sortField).toBeUndefined();
	expect(relationInfo.value?.relation.meta?.one_deselect_action).toBe('delete');
});

test('undefined unless the field has exactly one relation', () => {
	expect(useRelationO2M(ref('bo_rel'), ref('m2m_list')).relationInfo.value).toBeUndefined();
	expect(useRelationO2M(ref('bo_rel'), ref('title')).relationInfo.value).toBeUndefined();
});
