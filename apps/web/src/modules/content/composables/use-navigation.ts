// Ported from directus/app/src/modules/content/composables/use-navigation.ts
import type { Preset } from '@directus/types';
import { groupBy, isNil } from 'lodash-es';
import { type InjectionKey, type Ref, ref, watch } from 'vue';
import { type Collection, useCollectionsStore } from '../../../stores/collections.ts';

let showHidden: Ref<boolean>;
let activeGroups: Ref<string[]>;

export function useNavigation(currentCollection?: Ref<string | undefined>) {
	const collectionsStore = useCollectionsStore();

	if (!activeGroups) {
		activeGroups = ref(
			collectionsStore.sortedCollections
				.filter((collection) => collection.meta?.collapse === 'open' || collection.meta?.collapse === 'locked')
				.map(({ collection }) => collection),
		);
	}

	if (showHidden === undefined) {
		showHidden = ref(false);
	}

	if (currentCollection) {
		watch(
			currentCollection,
			(collectionKey) => {
				if (collectionKey === undefined) return;

				let collection = collectionsStore.getCollection(collectionKey);

				const collectionsToAdd: string[] = [];

				while (collection?.meta?.group) {
					if (activeGroups.value.includes(collection.meta.group) === false) {
						collectionsToAdd.push(collection.meta.group);
					}

					collection = collectionsStore.getCollection(collection.meta.group);
				}

				activeGroups.value = [...activeGroups.value, ...collectionsToAdd];
			},
			{ immediate: true },
		);
	}

	return { showHidden, activeGroups };
}

// Backoffice: the tree of navigation.vue and NavigationItem.vue (root items, getChildCollections,
// getChildBookmarks, isGroup, matchesSearch) is built once for the whole tree instead of in each NavigationItem, so
// ContentNavigation knows the visible rows for the WAI-ARIA tree keyboard (FR-004b, layout-patterns §9).
export interface NavigationNode {
	/** Collection name, or `bookmark:<id>` for a bookmark row. */
	key: string;
	/** aria-level, 1 for root items. */
	level: number;
	parent: NavigationNode | null;
	/** The collection of the row (of the bookmark for a bookmark row). */
	collection: Collection;
	bookmark?: Preset;
	children: NavigationNode[];
	/** Has child collections or bookmarks (DR `isGroup`, before the search filter). */
	group: boolean;
}

export interface NavigationContext {
	dense: Ref<boolean>;
	/** Key of the row that has tabindex 0 (roving tabindex). */
	tabStop: Ref<string | null>;
	isOpen(node: NavigationNode): boolean;
	isActive(node: NavigationNode): boolean;
	toggle(node: NavigationNode): void;
}

export const navigationContextKey: InjectionKey<NavigationContext> = Symbol('content-navigation');

export function buildNavigationTree({
	rootCollections,
	sortedCollections,
	bookmarks,
	showHidden,
	search,
}: {
	rootCollections: Collection[];
	sortedCollections: Collection[];
	bookmarks: Preset[];
	showHidden: boolean;
	search: string;
}): NavigationNode[] {
	const childCollections = groupBy(
		sortedCollections.filter(
			(collection) => !isNil(collection.meta?.group) && (showHidden || collection.meta?.hidden !== true),
		),
		'meta.group',
	);

	const childBookmarks = groupBy(bookmarks, 'collection');
	const searchQuery = search.length < 3 ? null : search.toLowerCase();

	return rootCollections.map((collection) => build(collection, null)).filter((node) => node !== null);

	function build(collection: Collection, parent: NavigationNode | null): NavigationNode | null {
		const collections = childCollections[collection.collection] ?? [];
		const presets = childBookmarks[collection.collection] ?? [];

		const node: NavigationNode = {
			key: collection.collection,
			level: (parent?.level ?? 0) + 1,
			parent,
			collection,
			children: [],
			group: collections.length > 0 || presets.length > 0,
		};

		const collectionNodes = collections.map((child) => build(child, node)).filter((child) => child !== null);

		// A group that matches lists all its bookmarks (navigation-bookmark.vue has no search filter).
		const bookmarkNodes = presets.map((bookmark) => ({
			key: `bookmark:${bookmark.id}`,
			level: node.level + 1,
			parent: node,
			collection,
			bookmark,
			children: [],
			group: false,
		}));

		node.children = [...collectionNodes, ...bookmarkNodes];

		if (
			searchQuery &&
			!collection.collection.includes(searchQuery) &&
			!collection.name.toLowerCase().includes(searchQuery) &&
			!presets.some((bookmark) => bookmark.bookmark?.toLowerCase().includes(searchQuery)) &&
			collectionNodes.length === 0
		) {
			return null;
		}

		return node;
	}
}
