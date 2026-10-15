// The guards of directus/app/src/modules/content/index.ts (no Directus test): system collections, bookmark kept on
// item routes, archive query, and the /content redirect (last accessed collection, then the first root collection).
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';
import { useCollectionsStore, type Collection } from '../stores/collections.ts';
import { checkForSystem, getArchiveValue, LAST_ACCESSED_COLLECTION, redirectToFirstCollection } from './content.ts';
import { useNavigation } from './content/composables/use-navigation.ts';

const route = (params: Record<string, string>, query: Record<string, string> = {}, fullPath = '/') =>
	({ params, query, fullPath }) as unknown as RouteLocationNormalized;

const guard = (to: RouteLocationNormalized, from: RouteLocationNormalized) =>
	(checkForSystem as (to: RouteLocationNormalized, from: RouteLocationNormalized) => unknown)(to, from);

const collection = (name: string, meta: Partial<NonNullable<Collection['meta']>> = {}, schema = true) =>
	({
		collection: name,
		name,
		schema: schema ? { name } : null,
		meta: { hidden: false, sort: null, group: null, ...meta },
	}) as unknown as Collection;

beforeEach(() => {
	setActivePinia(createPinia());
	localStorage.clear();
	useNavigation().activeGroups.value = [];
});

describe('checkForSystem', () => {
	test('system collections go to their module, items to their item route', () => {
		expect(guard(route({ collection: 'directus_users' }), route({}))).toBe('/users');
		expect(guard(route({ collection: 'directus_users', primaryKey: 'u1' }), route({}))).toBe('/users/u1');
		expect(guard(route({ collection: 'directus_settings', primaryKey: '1' }), route({}))).toBe('/settings/project');
	});

	test('a system collection without a module route stays (the page shows not found)', () => {
		expect(guard(route({ collection: 'directus_revisions' }), route({}))).toBeUndefined();
	});

	test('the bookmark query follows from the collection to its items', () => {
		const from = route({ collection: 'articles' }, { bookmark: '4' });

		expect(guard(route({ collection: 'articles', primaryKey: '1' }, {}, '/content/articles/1'), from)).toBe(
			'/content/articles/1?bookmark=4',
		);
		expect(guard(route({ collection: 'articles', primaryKey: '1' }, { bookmark: '5' }), from)).toBeUndefined();
		expect(guard(route({ collection: 'other', primaryKey: '1' }), from)).toBeUndefined();
		expect(guard(route({ collection: 'articles' }), from)).toBeUndefined();
		expect(guard(route({}), from)).toBeUndefined();
	});
});

test('getArchiveValue', () => {
	expect(getArchiveValue({ all: null })).toBe('all');
	expect(getArchiveValue({ archived: null })).toBe('archived');
	expect(getArchiveValue({})).toBeNull();
});

describe('redirectToFirstCollection', () => {
	test('no visible collection: stay on the no-collections page', () => {
		expect(redirectToFirstCollection()).toBeUndefined();
	});

	test('the last accessed collection when still visible', () => {
		useCollectionsStore().collections = [collection('a'), collection('b')];
		localStorage.setItem(LAST_ACCESSED_COLLECTION, 'b');
		expect(redirectToFirstCollection()).toBe('/content/b');

		localStorage.setItem(LAST_ACCESSED_COLLECTION, 'gone');
		expect(redirectToFirstCollection()).toBe('/content/a');
	});

	test('the first root collection, looking inside folders (open or closed)', () => {
		useCollectionsStore().collections = [
			collection('folder', {}, false),
			collection('inside', { group: 'folder' }),
			collection('z_root'),
		];
		expect(redirectToFirstCollection()).toBe('/content/inside');

		useNavigation().activeGroups.value = ['folder'];
		expect(redirectToFirstCollection()).toBe('/content/inside');
	});
});
