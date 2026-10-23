// Ported from directus/app/src/stores/collections.test.ts
// Backoffice: createPinia instead of @pinia/testing; tests after the DR ones cover hydrate and the getters.
import type { Collection as CollectionRaw } from '@directus/types';
import { merge } from 'lodash-es';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { i18n } from '../lang/index.ts';
import { calls, mockApi } from '../test-utils/fetch.ts';
import { type Collection, useCollectionsStore } from './collections.ts';

beforeEach(() => {
	setActivePinia(createPinia());
});

afterEach(() => vi.unstubAllGlobals());

const mockCollection = {
	collection: 'a',
	meta: {},
	schema: {},
} as Collection;

test('parseField action should translate field name when translations are added then removed', async () => {
	const collectionsStore = useCollectionsStore();

	const mockCollectionWithTranslations = merge({}, mockCollection, {
		meta: {
			translations: [
				{
					language: 'en-US',
					translation: 'Collection A en-US',
				},
			],
		},
	});

	collectionsStore.collections = [mockCollectionWithTranslations].map(collectionsStore.prepareCollectionForApp);
	expect(collectionsStore.collections[0]!.name).toEqual('Collection A en-US');
	expect(i18n.global.te(`collection_names.${mockCollection.collection}`)).toBe(true);

	const mockCollectionWithMissingTranslations = merge({}, mockCollection, {
		meta: {
			translations: [
				{
					language: 'zh-CN',
					translation: 'Collection A zh-CN',
				},
			],
		},
	});

	collectionsStore.collections = [mockCollectionWithMissingTranslations].map(collectionsStore.prepareCollectionForApp);
	expect(collectionsStore.collections[0]!.name).toEqual('A');
	expect(i18n.global.te(`collection_names.${mockCollection.collection}`)).toBe(false);
});

test('parseField action should translate field name when all translations are removed', async () => {
	const collectionsStore = useCollectionsStore();

	const mockCollectionWithTranslations = merge({}, mockCollection, {
		meta: {
			translations: [
				{
					language: 'en-US',
					translation: 'Collection A en-US',
				},
			],
		},
	});

	collectionsStore.collections = [mockCollectionWithTranslations].map(collectionsStore.prepareCollectionForApp);
	expect(collectionsStore.collections[0]!.name).toEqual('Collection A en-US');
	expect(i18n.global.te(`collection_names.${mockCollection.collection}`)).toBe(true);

	const mockCollectionWithoutTranslations = merge({}, mockCollection, {
		meta: {
			translations: null,
		},
	});

	collectionsStore.collections = [mockCollectionWithoutTranslations].map(collectionsStore.prepareCollectionForApp);
	expect(collectionsStore.collections[0]!.name).toEqual('A');
	expect(i18n.global.te(`collection_names.${mockCollection.collection}`)).toBe(false);
});

const raw = (collection: string, meta: Record<string, unknown> | null = {}, schema: unknown = {}) =>
	({ collection, meta, schema }) as CollectionRaw;

test('hydrate prepares /collections (name, icon, type) and dehydrate empties the store', async () => {
	const fetch = mockApi({
		'GET /collections': [raw('blog_posts', { icon: 'article', color: 'accent' }), raw('folder', {}, null)],
	});
	const collectionsStore = useCollectionsStore();

	await collectionsStore.hydrate();

	expect(calls(fetch)).toEqual(['GET /collections']);
	expect(collectionsStore.collections).toMatchObject([
		{ collection: 'blog_posts', name: 'Blog Posts', icon: 'article', color: 'accent', type: 'table' },
		{ collection: 'folder', name: 'Folder', icon: 'database', type: 'alias' },
	]);

	await collectionsStore.dehydrate();
	expect(collectionsStore.collections).toEqual([]);
});

test('getters split system, configured, visible and database collections in group order', () => {
	const collectionsStore = useCollectionsStore();

	collectionsStore.collections = [
		raw('directus_users'),
		raw('directus_settings'),
		raw('b', { sort: 2 }),
		raw('a_child', { group: 'a', sort: 1 }),
		raw('a', { sort: 1 }),
		raw('hidden', { hidden: true, sort: 3 }),
		raw('unconfigured', null),
		raw('folder', { sort: 4 }, null),
	].map(collectionsStore.prepareCollectionForApp);

	const keys = (list: Collection[]) => list.map(({ collection }) => collection);

	expect(keys(collectionsStore.sortedCollections)).toEqual([
		'a',
		'a_child',
		'b',
		'hidden',
		'folder',
		'directus_settings',
		'directus_users',
		'unconfigured',
	]);
	expect(keys(collectionsStore.systemCollections)).toEqual(['directus_settings', 'directus_users']);
	expect(keys(collectionsStore.allCollections)).toEqual(['a', 'a_child', 'b', 'hidden', 'folder', 'unconfigured']);
	expect(keys(collectionsStore.configuredCollections)).toEqual(['a', 'a_child', 'b', 'hidden', 'folder']);
	expect(keys(collectionsStore.visibleCollections)).toEqual(['a', 'a_child', 'b', 'folder']);
	expect(keys(collectionsStore.databaseCollections)).toEqual(['a', 'a_child', 'b', 'hidden', 'unconfigured']);
	expect(keys(collectionsStore.crudSafeSystemCollections)).toEqual(['directus_users']);
	expect(collectionsStore.getCollection('b')?.name).toBe('B');
	expect(collectionsStore.getCollection('nope')).toBeNull();
});

test('translateCollections renames after the locale changes', () => {
	const collectionsStore = useCollectionsStore();

	collectionsStore.collections = [
		raw('posts', { translations: [{ language: 'vi-VN', translation: 'Bài viết', singular: 'Bài', plural: 'Các bài' }] }),
	].map(collectionsStore.prepareCollectionForApp);

	expect(collectionsStore.collections[0]!.name).toBe('Posts');
	expect(i18n.global.t('collection_names_plural.posts', {}, { locale: 'vi-VN' })).toBe('Các bài');

	i18n.global.locale.value = 'vi-VN';

	try {
		collectionsStore.translateCollections();
		expect(collectionsStore.collections[0]!.name).toBe('Bài viết');
	} finally {
		i18n.global.locale.value = 'en-US';
	}
});

// Feature 016 T013: the write actions of DR stores/collections.ts.
test('upsertCollection: POST without app-only keys when new, PATCH when existing, nothing when equal', async () => {
	const store = useCollectionsStore();
	const fetch = mockApi({
		'POST /collections': { collection: 'c', meta: { icon: 'box' }, schema: {} },
		'PATCH /collections/c': { collection: 'c', meta: { icon: 'star' }, schema: {} },
	});

	await store.upsertCollection('c', { collection: 'c', meta: { icon: 'box' }, name: 'C', icon: 'x' } as never);
	expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({ collection: 'c', meta: { icon: 'box' } });
	await store.upsertCollection('c', { meta: { icon: 'star' } } as never);

	expect(calls(fetch)).toEqual(['POST /collections', 'PATCH /collections/c']);
	expect(store.getCollection('c')!.meta!.icon).toBe('star');
});

test('updateCollection and deleteCollection: request, then hydrate (deleteCollection also relations)', async () => {
	const store = useCollectionsStore();
	const fetch = mockApi({
		'PATCH /collections/c': {},
		'DELETE /collections/c': () => new Response(null, { status: 204 }),
		'GET /collections': [],
		'GET /relations': [],
	});

	await store.updateCollection('c', { meta: { hidden: true } } as never);
	await store.deleteCollection('c');

	expect(calls(fetch)).toEqual([
		'PATCH /collections/c',
		'GET /collections',
		'DELETE /collections/c',
		'GET /collections',
		'GET /relations',
	]);
});

// Feature 018 D-117 (owner 2026-10-18, branding D-51): a system collection is named without the `directus_` prefix.
test('system collection names drop the directus_ prefix; user collections keep their title', () => {
	const collectionsStore = useCollectionsStore();
	const [users, content] = [
		{ collection: 'directus_users', meta: null, schema: null },
		{ collection: 'bo_content', meta: null, schema: null },
	].map((raw) => collectionsStore.prepareCollectionForApp(raw as never));

	expect(users!.name).toBe('Users');
	expect(content!.name).toBe('Bo Content');
});
