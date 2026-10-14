<!-- Ported from directus/app/src/views/private/private-view/components/private-view-header-bar.vue -->
<script setup lang="ts">
// Backoffice: the page header of the TailAdmin content area (layout-patterns §5, component-specs Breadcrumb): icon,
// h1 title and actions, then the toggle of the right detail panel (L-4). No back button, headline, title slots or
// breadcrumb yet; labelled buttons instead of clickable icons with tooltips (FR-027); the panel toggle is always
// shown, as the collapsed panel has no detail buttons to reopen it in 012 (D-45). The sidebar toggle is in AppHeader.
import BoButton from '../components/BoButton.vue';
import BoIcon from '../components/BoIcon.vue';
import { useSidebarStore } from './stores/sidebar.ts';

defineProps<{
	title?: string | undefined;
	icon?: string | undefined;
}>();

const sidebarStore = useSidebarStore();
</script>

<template>
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div class="flex min-w-0 items-center gap-3">
			<BoIcon v-if="icon" :name="icon" class="shrink-0 text-gray-500 dark:text-gray-400" />
			<h1 class="m-0 min-w-0 truncate text-xl font-semibold text-gray-800 dark:text-white/90">{{ title }}</h1>
		</div>

		<div class="flex shrink-0 items-center gap-3">
			<slot name="actions" />

			<BoButton
				variant="ghost"
				:icon="sidebarStore.collapsed ? 'right_panel_open' : 'right_panel_close'"
				:aria-label="$t(sidebarStore.collapsed ? 'open_sidebar' : 'close_sidebar')"
				:aria-expanded="!sidebarStore.collapsed"
				aria-controls="sidebar"
				@click="sidebarStore.toggle"
			/>
		</div>
	</div>
</template>
