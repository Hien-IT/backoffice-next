// Backoffice: no DR source (DR trees are mouse lists). The WAI-ARIA tree keyboard of layout-patterns §9
// and §11 for the folder tree, the folder picker and the role tree (feature 015): one roving tabindex over the visible
// rows, Up/Down/Home/End move, Right opens a closed parent or goes to its first child, Left closes an open parent or
// goes to the parent, Enter is left to the row (links follow natively). The Content tree of 014 has its own copy.
import { computed, nextTick, type Ref, ref } from 'vue';

export interface TreeRow {
	key: string;
	parent: string | null;
	/** Child keys in display order (empty: a leaf). */
	children: string[];
}

export function useTreeKeyboard(options: {
	/** Visible rows in display order (children of closed parents left out). */
	rows: Ref<TreeRow[]>;
	isOpen: (key: string) => boolean;
	toggle: (key: string) => void;
	/** Row to focus first when no row had focus yet (the current one). */
	activeKey: Ref<string | null>;
	tree: Ref<HTMLElement | null>;
}) {
	const focusKey = ref<string | null>(null);

	const tabStop = computed(() => {
		const keys = options.rows.value.map((row) => row.key);
		if (focusKey.value !== null && keys.includes(focusKey.value)) return focusKey.value;
		if (options.activeKey.value !== null && keys.includes(options.activeKey.value)) return options.activeKey.value;
		return keys[0] ?? null;
	});

	return { tabStop, onKeydown, onFocusin, focusRow };

	function rowKey(event: Event) {
		return (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')?.dataset['key'];
	}

	function onFocusin(event: FocusEvent) {
		const key = rowKey(event);
		if (key !== undefined) focusKey.value = key;
	}

	function onKeydown(event: KeyboardEvent) {
		// Keys typed in a row menu or button inside the row are theirs.
		if ((event.target as HTMLElement).closest('[data-tree-ignore]')) return;

		const rows = options.rows.value;
		const index = rows.findIndex((row) => row.key === rowKey(event));
		const row = rows[index];
		if (!row) return;

		let target: string | null | undefined;

		switch (event.key) {
			case 'ArrowDown':
				target = rows[index + 1]?.key;
				break;
			case 'ArrowUp':
				target = rows[index - 1]?.key;
				break;
			case 'Home':
				target = rows[0]?.key;
				break;
			case 'End':
				target = rows.at(-1)?.key;
				break;
			case 'ArrowRight':
				if (row.children.length === 0) break;
				if (options.isOpen(row.key)) target = row.children[0];
				else options.toggle(row.key);
				break;
			case 'ArrowLeft':
				if (row.children.length > 0 && options.isOpen(row.key)) options.toggle(row.key);
				else target = row.parent;
				break;
			default:
				return;
		}

		event.preventDefault();
		if (target) focusRow(target);
	}

	async function focusRow(key: string) {
		focusKey.value = key;
		await nextTick();

		const item = [...(options.tree.value?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])].find(
			(element) => element.dataset['key'] === key,
		);

		item?.querySelector<HTMLElement>('[data-tree-row]')?.focus();
	}
}
