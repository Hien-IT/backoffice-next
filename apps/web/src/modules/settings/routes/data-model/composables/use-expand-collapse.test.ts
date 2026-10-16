// Feature 016 T030: use-expand-collapse (no Directus test).
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import { useCollectionsStore } from '../../../../../stores/collections.ts';
import { useExpandCollapse } from './use-expand-collapse.ts';

beforeEach(() => {
	localStorage.clear();
	setActivePinia(createPinia());
	const store = useCollectionsStore();
	store.collections = [
		{ collection: 'folder', meta: { group: null }, schema: null },
		{ collection: 'child', meta: { group: 'folder' }, schema: {} },
	].map((c) => store.prepareCollectionForApp(c as never));
});

describe('useExpandCollapse', () => {
	test('collapse all, toggle one, expand all; kept in localStorage under the backoffice- key', async () => {
		const { collapsedIds, hasExpandableCollections, expandAll, collapseAll, toggleCollapse } = useExpandCollapse();

		expect(hasExpandableCollections.value).toBe(true);
		collapseAll();
		expect(collapsedIds.value).toEqual(['folder', 'child']);
		toggleCollapse('folder');
		expect(collapsedIds.value).toEqual(['child']);
		toggleCollapse('folder');
		expect(collapsedIds.value).toEqual(['child', 'folder']);
		await nextTick();
		expect(JSON.parse(localStorage.getItem('backoffice-collapsed-collection-ids')!)).toEqual(['child', 'folder']);
		expandAll();
		expect(collapsedIds.value).toEqual([]);
	});
});
