<!-- Ported from directus/app/src/modules/content/components/NavigationItem.vue -->
<script setup lang="ts">
// Backoffice: recipe layout-patterns §9. The node (child collections, bookmarks, search match) comes from
// buildNavigationTree; the open state, active state and roving tabindex from ContentNavigation (provide/inject in place
// of the useGroupable scope `content-navigation` of v-list-group). The admin `edit_collection` context menu is the one
// menu of ContentNavigation. A group row has its toggle first (Directus: arrow after); a folder (no schema) is not a
// link and toggles on click like v-list-group without `to`.
import { computed, inject } from 'vue';
import { RouterLink } from 'vue-router';
import BoIcon from '../../../components/BoIcon.vue';
import { getCollectionRoute } from '../../../utils/get-item-route.ts';
import { navigationContextKey, type NavigationNode } from '../composables/use-navigation.ts';
import NavigationBookmark from './NavigationBookmark.vue';
import NavigationItemContent from './NavigationItemContent.vue';

const { node } = defineProps<{ node: NavigationNode }>();

const nav = inject(navigationContextKey)!;

const collection = computed(() => node.collection);
const locked = computed(() => collection.value.meta?.collapse === 'locked');
const open = computed(() => node.group && nav.isOpen(node));
const active = computed(() => nav.isActive(node));
const hidden = computed(() => collection.value.meta?.hidden === true);
const to = computed(() => (collection.value.schema ? getCollectionRoute(collection.value.collection) : ''));
const tabindex = computed(() => (nav.tabStop.value === node.key ? 0 : -1));

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';

function onFolderClick() {
	if (node.group && !locked.value) nav.toggle(node);
}
</script>

<template>
	<li
		role="treeitem"
		:data-key="node.key"
		:aria-level="node.level"
		:aria-expanded="node.group ? open : undefined"
		:aria-selected="active"
	>
		<div
			class="menu-dropdown-item gap-2 py-1 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-500 dark:has-focus-visible:outline-brand-400"
			:class="[
				active
					? 'menu-dropdown-item-active'
					: hidden
						? 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
						: 'menu-dropdown-item-inactive',
				nav.dense.value ? 'min-h-8 text-theme-sm' : 'min-h-9 text-sm',
			]"
		>
			<button
				v-if="node.group && !locked"
				type="button"
				tabindex="-1"
				class="relative z-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded"
				:class="FOCUS"
				:aria-label="`${open ? $t('collapse') : $t('expand')} ${collection.name}`"
				@click="nav.toggle(node)"
			>
				<BoIcon
					name="chevron_right"
					size="sm"
					class="transition-transform motion-reduce:transition-none"
					:class="{ 'rotate-90': open }"
				/>
			</button>

			<RouterLink
				v-if="to"
				:to="to"
				data-nav-row
				:tabindex="tabindex"
				:aria-current="active ? 'page' : undefined"
				class="flex min-w-0 flex-1 items-center gap-2 no-underline outline-hidden after:absolute after:inset-0 after:rounded-lg"
			>
				<NavigationItemContent
					:name="collection.name"
					:icon="collection.icon"
					:color="collection.color"
					:hidden="hidden"
				/>
			</RouterLink>
			<div
				v-else
				data-nav-row
				:tabindex="tabindex"
				class="flex min-w-0 flex-1 items-center gap-2 outline-hidden"
				:class="{ 'cursor-pointer': node.group && !locked }"
				@click="onFolderClick"
			>
				<NavigationItemContent
					:name="collection.name"
					:icon="collection.icon"
					:color="collection.color"
					:hidden="hidden"
				/>
			</div>
		</div>

		<ul v-if="open" role="group" class="m-0 mt-1 flex list-none flex-col gap-1 p-0 ps-4">
			<template v-for="child in node.children" :key="child.key">
				<NavigationBookmark v-if="child.bookmark" :node="child" />
				<NavigationItem v-else :node="child" />
			</template>
		</ul>
	</li>
</template>
