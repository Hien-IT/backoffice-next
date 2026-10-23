import type { Preset } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import type { Collection } from '../../../stores/collections.ts';
import type { NavigationNode } from './use-navigation.ts';

function collection(name: string, meta: Record<string, unknown> | null = {}, schema = true): Collection {
	return {
		collection: name,
		name: name.toUpperCase(),
		icon: 'database',
		type: schema ? 'table' : 'alias',
		meta:
			meta === null ? null : { collection: name, group: null, hidden: false, sort: null, collapse: 'open', ...meta },
		schema: schema ? { name } : null,
	} as unknown as Collection;
}

function bookmark(id: number, collectionName: string, name: string): Preset {
	return { id, collection: collectionName, bookmark: name, user: null, role: null } as Preset;
}

// Module-level refs (shared like DR): every test gets a fresh module and store.
async function load() {
	vi.resetModules();
	const { useCollectionsStore } = await import('../../../stores/collections.ts');
	const module = await import('./use-navigation.ts');
	setActivePinia(createPinia());
	return { store: useCollectionsStore(), ...module };
}

const keys = (nodes: NavigationNode[]): unknown[] =>
	nodes.map((node) => (node.children.length ? [node.key, keys(node.children)] : node.key));

describe('useNavigation', () => {
	beforeEach(() => localStorage.clear());

	test('starts with the open and locked groups, shares the refs between calls', async () => {
		const { store, useNavigation } = await load();
		store.collections = [
			collection('a', { collapse: 'open' }),
			collection('b', { collapse: 'closed' }),
			collection('c', { collapse: 'locked' }),
		];

		const first = useNavigation();
		const second = useNavigation();

		expect(first.activeGroups.value).toEqual(['a', 'c']);
		expect(first.showHidden.value).toBe(false);
		expect(second.activeGroups).toBe(first.activeGroups);
		expect(second.showHidden).toBe(first.showHidden);
	});

	test('opens every parent group of the current collection', async () => {
		const { store, useNavigation } = await load();
		store.collections = [
			collection('root', { collapse: 'closed' }),
			collection('mid', { group: 'root', collapse: 'closed' }),
			collection('leaf', { group: 'mid' }),
			collection('other', { collapse: 'closed' }),
		];

		const current = ref<string | undefined>(undefined);
		const { activeGroups } = useNavigation(current);
		expect(activeGroups.value).toEqual(['leaf']);

		current.value = 'leaf';
		await nextTick();
		expect(activeGroups.value).toEqual(['leaf', 'mid', 'root']);

		current.value = 'mid';
		await nextTick();
		expect(activeGroups.value).toEqual(['leaf', 'mid', 'root']);
	});
});

describe('buildNavigationTree', () => {
	const collections = [
		collection('articles', { sort: 2 }),
		collection('folder', { sort: 1 }, false),
		collection('pages', { group: 'folder', sort: 2 }),
		collection('authors', { group: 'folder', sort: 1 }),
		collection('drafts', { group: 'pages', hidden: true }),
		collection('empty', { sort: 3 }),
	];

	const bookmarks = [bookmark(1, 'articles', 'Published'), bookmark(2, 'pages', 'Mine')];

	async function build(search = '', showHidden = false) {
		const { store, buildNavigationTree } = await load();
		store.collections = collections;
		const roots = store.sortedCollections.filter((c) => c.meta?.group === null);
		return buildNavigationTree({
			rootCollections: roots,
			sortedCollections: store.sortedCollections,
			bookmarks,
			showHidden,
			search,
		});
	}

	test('nests child collections then bookmarks, with levels and parents', async () => {
		const tree = await build();

		expect(keys(tree)).toEqual([
			['folder', ['authors', ['pages', ['bookmark:2']]]],
			['articles', ['bookmark:1']],
			'empty',
		]);

		const pages = tree[0]!.children[1]!;
		expect(pages.level).toBe(2);
		expect(pages.parent).toBe(tree[0]);
		expect(pages.children[0]!.level).toBe(3);
		expect(pages.children[0]!.bookmark?.bookmark).toBe('Mine');
		expect(tree.map((node) => node.group)).toEqual([true, true, false]);
	});

	test('hidden children only with showHidden', async () => {
		const tree = await build('', true);
		expect(keys([tree[0]!.children[1]!])).toEqual([['pages', ['drafts', 'bookmark:2']]]);
	});

	test('search filters from 3 characters on name, key and bookmarks, keeping the parents', async () => {
		expect(keys(await build('au'))).toHaveLength(3);
		expect(keys(await build('aut'))).toEqual([['folder', ['authors']]]);
		expect(keys(await build('PAGES'))).toEqual([['folder', [['pages', ['bookmark:2']]]]]);
		expect(keys(await build('publ'))).toEqual([['articles', ['bookmark:1']]]);
		expect(keys(await build('mine'))).toEqual([['folder', [['pages', ['bookmark:2']]]]]);
		expect(await build('zzz')).toEqual([]);
	});
});
