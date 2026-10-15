<!-- Ported from directus/app/src/modules/content/components/navigation-bookmark.vue -->
<script setup lang="ts">
// Backoffice: recipe layout-patterns §9, a bookmark is a child row of its collection in the tree. This part lists the
// bookmark and links to it; the active state is the Directus `query` match of v-list-item (same collection and
// `?bookmark=<id>`), computed by ContentNavigation.
// T053: the row menu (more_vert, or lock with the `cannot_edit_<scope>_bookmarks` tooltip), the edit dialog and the
// delete confirmation (useEditBookmark, useDeleteBookmark).
import { computed, inject } from 'vue';
import { RouterLink } from 'vue-router';
import { getCollectionRoute } from '../../../utils/get-item-route.ts';
import { translate } from '../../../utils/translate-object-values.ts';
import { navigationContextKey, type NavigationNode } from '../composables/use-navigation.ts';
import NavigationItemContent from './NavigationItemContent.vue';

const { node } = defineProps<{ node: NavigationNode }>();

const nav = inject(navigationContextKey)!;

const bookmark = computed(() => node.bookmark!);
const name = computed(() => translate(bookmark.value.bookmark ?? ''));
const active = computed(() => nav.isActive(node));
</script>

<template>
	<li role="treeitem" :data-key="node.key" :aria-level="node.level" :aria-selected="active">
		<div
			class="menu-dropdown-item gap-2 py-1 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-500 dark:has-focus-visible:outline-brand-400"
			:class="[
				active ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive',
				nav.dense.value ? 'min-h-8 text-theme-sm' : 'min-h-9 text-sm',
			]"
		>
			<RouterLink
				:to="`${getCollectionRoute(bookmark.collection)}?bookmark=${bookmark.id}`"
				data-nav-row
				:tabindex="nav.tabStop.value === node.key ? 0 : -1"
				:aria-current="active ? 'page' : undefined"
				class="flex min-w-0 flex-1 items-center gap-2 no-underline outline-hidden after:absolute after:inset-0 after:rounded-lg"
			>
				<NavigationItemContent :name="name" :icon="bookmark.icon ?? 'bookmark'" :color="bookmark.color" />
			</RouterLink>
		</div>
	</li>
</template>
