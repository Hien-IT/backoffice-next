// Directus has no test for use-relation-m2m.ts: relation info of the fixture m2m fields (data-model §2), and the m2m
// path of useRelationMultiple / useRelationPermissionsM2M on the fixture API (FR-040, FR-041, contracts/api-calls.md).
import type { ContentVersion } from '@directus/types';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { replaceQueue } from '../api/sdk.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { usePermissionsStore } from '../stores/permissions.ts';
import { useRelationsStore } from '../stores/relations.ts';
import type { FixtureUser } from '../test-utils/fixtures.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { useRelationM2M } from './use-relation-m2m.ts';
import { type RelationQueryMultiple, useRelationMultiple } from './use-relation-multiple.ts';
import { useRelationPermissionsM2M } from './use-relation-permissions.ts';

let fetch: ReturnType<typeof mockFixtureApi>;

async function setup(user: FixtureUser = 'admin') {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot(), { user });

	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
}

beforeEach(() => setup());

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
});

describe('useRelationM2M', () => {
	test('m2m: junction and related collection', () => {
		const { relationInfo } = useRelationM2M(ref('bo_rel'), ref('m2m_list'));
		const info = relationInfo.value!;

		expect(info.type).toBe('m2m');
		expect(info.junctionCollection.collection).toBe('bo_junction_m2m_list');
		expect(info.junctionPrimaryKeyField.field).toBe('id');
		expect(info.junctionField.field).toBe('bo_rel_target_id');
		expect(info.reverseJunctionField.field).toBe('bo_rel_id');
		expect(info.relatedCollection.collection).toBe('bo_rel_target');
		expect(info.relatedPrimaryKeyField.field).toBe('id');
		expect(info.junction.field).toBe('bo_rel_id');
		expect(info.relation.field).toBe('bo_rel_target_id');
		expect(info.sortField).toBe('sort');
	});

	test('translations are an m2m to the languages collection', () => {
		const { relationInfo } = useRelationM2M(ref('bo_translations'), ref('translations'));

		expect(relationInfo.value?.junctionCollection.collection).toBe('bo_translations_translations');
		expect(relationInfo.value?.junctionField.field).toBe('bo_languages_code');
		expect(relationInfo.value?.relatedCollection.collection).toBe('bo_languages');
		expect(relationInfo.value?.sortField).toBeUndefined();
	});

	test('undefined for an m2o or o2m field', () => {
		expect(useRelationM2M(ref('bo_rel'), ref('m2o')).relationInfo.value).toBeUndefined();
		expect(useRelationM2M(ref('bo_rel'), ref('o2m_list')).relationInfo.value).toBeUndefined();
	});
});

describe('useRelationMultiple on m2m (fixture API)', () => {
	const query = ref<RelationQueryMultiple>({ page: 1, limit: 15, fields: ['id', 'bo_rel_target_id.name'] });

	function use(version: ContentVersion | null = null) {
		const value = ref<Record<string, any> | any[] | undefined | null>(undefined);
		const { relationInfo } = useRelationM2M(ref('bo_rel'), ref('m2m_list'));
		return { value, ...useRelationMultiple(value, query, relationInfo, ref(1), ref(version)) };
	}

	test('loads the junction rows of the item, sorted by the sort field', async () => {
		const { displayItems, totalItemCount } = use();
		await flushPromises();

		expect(displayItems.value.map((item) => [item['id'], item['bo_rel_target_id'].name])).toEqual([
			[1, 'Target one'],
			[2, 'Target one'],
			[3, 'Target five'],
		]);

		expect(totalItemCount.value).toBe(3);

		expect(calls(fetch).filter((c) => c.startsWith('GET /items/bo_junction_m2m_list'))).toHaveLength(2);
	});

	test('select creates junction rows in the Directus shape and loads their display', async () => {
		const { value, select, displayItems } = use();
		await flushPromises();

		select([2]);
		await flushPromises();

		expect(value.value).toEqual({
			create: [{ bo_rel_id: 1, bo_rel_target_id: { id: 2 } }],
			update: [],
			delete: [],
		});

		expect(displayItems.value.at(-1)).toMatchObject({
			$type: 'created',
			$index: 0,
			bo_rel_target_id: { id: 2, name: 'Target two' },
		});

		expect(calls(fetch)).toContain('GET /items/bo_rel_target?fields=name,id&filter={"id":{"_in":[2]}}&limit=-1');
	});

	test('no changes left: undefined, or the primary keys with a version (FR-040)', async () => {
		const plain = use();
		await flushPromises();
		plain.remove({ id: 3 });
		expect(plain.value.value).toEqual({ create: [], update: [], delete: [3] });
		plain.remove({ ...plain.displayItems.value.find((item) => item['id'] === 3)! });
		expect(plain.value.value).toBeUndefined();

		const versioned = use({ id: 'v1' } as ContentVersion);
		await flushPromises();
		versioned.remove({ id: 3 });
		versioned.remove({ ...versioned.displayItems.value.find((item) => item['id'] === 3)! });
		expect(versioned.value.value).toEqual([1, 2, 3]);
	});
});

describe('useRelationPermissionsM2M (fixture /permissions/me)', () => {
	test('admin may create, select, update and deselect', () => {
		const { relationInfo } = useRelationM2M(ref('bo_rel'), ref('m2m_list'));
		const permissions = useRelationPermissionsM2M(relationInfo);

		expect(permissions.createAllowed.value).toBe(true);
		expect(permissions.selectAllowed.value).toBe(true);
		expect(permissions.updateAllowed.value).toBe(true);
		expect(permissions.deleteAllowed.value).toBe(true);
	});

	test('a read-only user may do none of them', async () => {
		await setup('bo-viewer');

		const { relationInfo } = useRelationM2M(ref('bo_rel'), ref('m2m_list'));
		const permissions = useRelationPermissionsM2M(relationInfo);

		expect(permissions.createAllowed.value).toBe(false);
		expect(permissions.selectAllowed.value).toBe(false);
		expect(permissions.updateAllowed.value).toBe(false);
		expect(permissions.deleteAllowed.value).toBe(false);
	});
});
