// Feature 016 (FR-010 to FR-013): what the collection list page gives the rows of its tree (CollectionItem.vue): the
// sort, the keyboard moves of D-96, the row menu and the visibility under a search. Directus passes the same through
// props and events of CollectionItem.vue; here one injection replaces the event chain of the recursive rows.
import type { InjectionKey } from 'vue';
import type { BoMenuItem } from '../../../../../components/BoMenu.vue';
import type { Collection } from '../../../../../stores/collections.ts';

export interface CollectionTreeContext {
	/** Collections with meta, translated, in sort order (Directus `collections` of collections.vue). */
	collections: () => Collection[];
	/** Children of `parent` (null = root), in sort order. */
	childrenOf: (parent: string | null) => Collection[];
	/** Shown under the current search (the collection or one of its descendants matches). */
	visible: (collection: string) => boolean;
	search: () => string | null;
	isCollapsed: (collection: string) => boolean;
	toggleCollapse: (collection: string) => void;
	/** Saves the order of `list`, all of them in `parent` (Directus onSort): sort = index + 1, group = parent. */
	sortList: (list: Collection[], parent: string | null) => void;
	/** A row dropped by mouse from another list into the children of `parent` (vuedraggable `added`). */
	dropInto: (parent: string | null, added: { newIndex: number; element: Collection }) => void;
	/** Moves `collection` into the collection above it in its list (D-96 "into the group above"). */
	indent: (list: Collection[], index: number, parent: string | null) => void;
	/** Moves `collection` out of `parent`, right after it (D-96 "out of the group"). */
	outdent: (list: Collection[], index: number, parent: string | null) => void;
	/** The row menu of a collection (collection-options.vue). */
	optionsFor: (collection: Collection, hasNested: boolean) => BoMenuItem[];
	editFolder: (collection: Collection) => void;
}

export const COLLECTION_TREE: InjectionKey<CollectionTreeContext> = Symbol('collection-tree');
