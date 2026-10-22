<!-- Ported from directus/app/src/modules/content/components/navigation.vue -->
<script setup lang="ts">
// Backoffice: recipe layout-patterns §9, rendered in the `navigation` slot of AppSidebar (FR-004). The tree is built
// once here (buildNavigationTree) and walked with the WAI-ARIA tree keyboard (FR-004b): one roving tabindex over the
// visible rows, Up/Down/Home/End move, Right opens or goes to the first child, Left closes or goes to the parent,
// Enter follows the link (or toggles a folder). The Directus context menus are one Reka ContextMenu: `edit_collection`
// on a table row for admins, otherwise show/hide hidden collections; a bookmark row keeps the browser menu
// (Directus `@contextmenu.stop`). The hidden toggle is also a button with aria-pressed (keyboard path), and an
// empty search result is announced (`no_results`).
import { isNil, orderBy } from 'lodash-es';
import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui';
import { computed, nextTick, onMounted, provide, ref, toRefs, useTemplateRef } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import BoButton from '../../../components/BoButton.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoInput from '../../../components/BoInput.vue';
import { type Collection, useCollectionsStore } from '../../../stores/collections.ts';
import { usePresetsStore } from '../../../stores/presets.ts';
import { useUserStore } from '../../../stores/user.ts';
import {
	buildNavigationTree,
	navigationContextKey,
	type NavigationNode,
	useNavigation,
} from '../composables/use-navigation.ts';
import NavigationItem from './NavigationItem.vue';

const props = defineProps<{
	currentCollection?: string;
}>();

const { currentCollection } = toRefs(props);
const { activeGroups, showHidden } = useNavigation(currentCollection);

const search = ref('');

const route = useRoute();
const collectionsStore = useCollectionsStore();
const presetsStore = usePresetsStore();
const userStore = useUserStore();

const rootItems = computed(() => {
	const shownCollections = showHidden.value ? collectionsStore.allCollections : collectionsStore.visibleCollections;
	return orderBy(
		shownCollections.filter((collection) => {
			return isNil(collection?.meta?.group);
		}),
		['meta.sort', 'collection'],
	);
});

const dense = computed(() => collectionsStore.visibleCollections.length > 5);
const showSearch = computed(() => collectionsStore.visibleCollections.length > 20);

// The hidden-collections toggle sits in the sidebar title row (AppSidebar `module-actions-content`, D-157); without
// that row (e.g. mounted alone) it stays above the tree.
const actionsTarget = ref<HTMLElement | null>(null);
onMounted(() => (actionsTarget.value = document.getElementById('module-actions-content')));

const hasHiddenCollections = computed(
	() => collectionsStore.allCollections.length > collectionsStore.visibleCollections.length,
);

const rootNodes = computed(() =>
	buildNavigationTree({
		rootCollections: rootItems.value,
		sortedCollections: collectionsStore.sortedCollections,
		bookmarks: presetsStore.bookmarks,
		showHidden: showHidden.value,
		search: search.value,
	}),
);

const noResults = computed(() => search.value.length >= 3 && rootNodes.value.length === 0);

const { rows, tabStop, focusKey, isOpen, isActive, toggle } = useTreeState();
const { onKeydown, onFocusin } = useTreeKeyboard();
const { contextCollection, onContextMenu } = useContextMenu();

provide(navigationContextKey, { dense, tabStop, isOpen, isActive, toggle });

function useTreeState() {
	const focusKey = ref<string | null>(null);

	// Rows in display order whose parents are all open.
	const rows = computed(() => {
		const result: NavigationNode[] = [];

		const walk = (nodes: NavigationNode[]) => {
			for (const node of nodes) {
				result.push(node);
				if (node.group && isOpen(node)) walk(node.children);
			}
		};

		walk(rootNodes.value);
		return result;
	});

	const tabStop = computed(() => {
		const keys = rows.value.map((row) => row.key);
		if (focusKey.value !== null && keys.includes(focusKey.value)) return focusKey.value;
		return rows.value.find((row) => isActive(row))?.key ?? keys[0] ?? null;
	});

	return { rows, tabStop, focusKey, isOpen, isActive, toggle };

	function isOpen(node: NavigationNode) {
		return node.collection.meta?.collapse === 'locked' || activeGroups.value.includes(node.key);
	}

	// v-list-item `to` matching: a collection row is active on its collection and item routes, except when one of its
	// bookmarks is active and the group is open (v-list-group `query`); a bookmark row needs `?bookmark=<id>` too.
	function isActive(node: NavigationNode) {
		if (route.params['collection'] !== node.collection.collection) return false;
		if (node.bookmark) return String(route.query['bookmark']) === String(node.bookmark.id);
		if (!node.collection.schema) return false;
		return !(node.group && isOpen(node) && 'bookmark' in route.query);
	}

	function toggle(node: NavigationNode) {
		activeGroups.value = activeGroups.value.includes(node.key)
			? activeGroups.value.filter((group) => group !== node.key)
			: [...activeGroups.value, node.key];
	}
}

function useTreeKeyboard() {
	const tree = useTemplateRef<HTMLElement>('tree');

	return { onKeydown, onFocusin };

	function rowKey(event: Event) {
		return (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')?.dataset['key'];
	}

	function onFocusin(event: FocusEvent) {
		const key = rowKey(event);
		if (key !== undefined) focusKey.value = key;
	}

	function onKeydown(event: KeyboardEvent) {
		const index = rows.value.findIndex((row) => row.key === rowKey(event));
		const node = rows.value[index];
		if (!node) return;

		const canToggle = node.group && node.collection.meta?.collapse !== 'locked';
		let target: NavigationNode | null | undefined;

		switch (event.key) {
			case 'ArrowDown':
				target = rows.value[index + 1];
				break;
			case 'ArrowUp':
				target = rows.value[index - 1];
				break;
			case 'Home':
				target = rows.value[0];
				break;
			case 'End':
				target = rows.value.at(-1);
				break;
			case 'ArrowRight':
				if (!node.group) break;
				if (isOpen(node)) target = node.children[0];
				else toggle(node);
				break;
			case 'ArrowLeft':
				if (canToggle && isOpen(node)) toggle(node);
				else target = node.parent;
				break;
			case 'Enter':
				// Links follow natively; a folder row is not a link.
				if (node.collection.schema || node.bookmark) return;
				if (canToggle) toggle(node);
				break;
			default:
				return;
		}

		event.preventDefault();
		if (target) focusRow(target.key);
	}

	async function focusRow(key: string) {
		focusKey.value = key;
		await nextTick();

		const item = [...(tree.value?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])].find(
			(element) => element.dataset['key'] === key,
		);

		item?.querySelector<HTMLElement>('[data-nav-row]')?.focus();
	}
}

function useContextMenu() {
	const contextCollection = ref<Collection | null>(null);

	return { contextCollection, onContextMenu };

	// Capture phase: picks the menu of the row before the Reka trigger opens it; no menu keeps the browser one.
	function onContextMenu(event: MouseEvent) {
		const key = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')?.dataset['key'];
		const node = rows.value.find((row) => row.key === key);

		contextCollection.value =
			node && !node.bookmark && userStore.isAdmin && node.collection.type === 'table' ? node.collection : null;

		if (node?.bookmark || (contextCollection.value === null && !hasHiddenCollections.value)) {
			event.stopPropagation();
		}
	}
}

const MENU_ITEM =
	'flex w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 no-underline outline-hidden data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 dark:text-gray-400 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300';
</script>

<template>
	<div class="flex flex-col" @contextmenu.capture="onContextMenu">
		<!-- Without the sidebar row (mounted alone), the toggle renders here, before the search. -->
		<Teleport v-if="hasHiddenCollections" :to="actionsTarget ?? 'body'" :disabled="!actionsTarget">
			<BoButton
				variant="ghost"
				class="ms-auto shrink-0"
				:class="{ 'size-8!': actionsTarget }"
				:icon="showHidden ? 'visibility_off' : 'visibility'"
				:aria-label="$t('show_hidden_collections')"
				:aria-pressed="showHidden"
				@click="showHidden = !showHidden"
			/>
		</Teleport>

		<!-- z-2: above the row chevrons of the tree (NavigationItem `relative z-1`), which scroll under it. -->
		<div v-if="showSearch" class="sticky top-0 z-2 flex items-center gap-2 bg-white pb-2 dark:bg-gray-900">
			<div v-if="showSearch" class="min-w-0 flex-1">
				<BoInput
					v-model="search"
					type="search"
					class="h-9!"
					:placeholder="$t('search_collection')"
					:aria-label="$t('search_collection')"
				/>
			</div>
		</div>

		<BoButton
			v-if="userStore.isAdmin && collectionsStore.allCollections.length === 0"
			variant="secondary"
			full-width
			to="/settings/data-model/+"
		>
			{{ $t('create_collection') }}
		</BoButton>

		<ContextMenuRoot v-if="rootNodes.length > 0">
			<ContextMenuTrigger as-child>
				<ul
					ref="tree"
					role="tree"
					:aria-label="$t('collections')"
					class="m-0 flex list-none flex-col gap-1 p-0"
					@keydown="onKeydown"
					@focusin="onFocusin"
				>
					<NavigationItem v-for="node in rootNodes" :key="node.key" :node="node" />
				</ul>
			</ContextMenuTrigger>
			<ContextMenuPortal>
				<ContextMenuContent
					class="z-99999 min-w-40 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
				>
					<ContextMenuItem v-if="contextCollection" as-child :class="MENU_ITEM">
						<RouterLink :to="`/settings/data-model/${contextCollection.collection}`">
							<BoIcon name="database" size="sm" class="text-gray-500 dark:text-gray-400" />
							{{ $t('edit_collection') }}
						</RouterLink>
					</ContextMenuItem>
					<ContextMenuItem v-else :class="MENU_ITEM" @select="showHidden = !showHidden">
						<BoIcon
							:name="showHidden ? 'visibility_off' : 'visibility'"
							size="sm"
							class="text-gray-500 dark:text-gray-400"
						/>
						{{ showHidden ? $t('hide_hidden_collections') : $t('show_hidden_collections') }}
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenuPortal>
		</ContextMenuRoot>

		<p role="status" class="sr-only">{{ noResults ? $t('no_results') : '' }}</p>
		<p v-if="noResults" aria-hidden="true" class="px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400">
			{{ $t('no_results') }}
		</p>
	</div>
</template>
