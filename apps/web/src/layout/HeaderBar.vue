<!-- Ported from directus/app/src/views/private/private-view/components/private-view-header-bar.vue -->
<script setup lang="ts">
// Backoffice: icon, title and actions only (no back button, headline or title slots yet); labelled buttons instead
// of clickable icons with tooltips (FR-027); the sidebar toggle is always shown, as the collapsed sidebar has no
// detail buttons to reopen it in 012 (D-45).
import { computed } from 'vue';
import BoButton from '../components/BoButton.vue';
import BoIcon from '../components/BoIcon.vue';
import { useNavBarStore } from './stores/nav-bar.ts';
import { useSidebarStore } from './stores/sidebar.ts';

defineProps<{
	title?: string | undefined;
	icon?: string | undefined;
}>();

const navBarStore = useNavBarStore();
const sidebarStore = useSidebarStore();

const showNavToggle = computed(() => {
	if (navBarStore.inlineNav) {
		return navBarStore.collapsed;
	}

	return true;
});
</script>

<template>
	<header
		class="sticky top-0 z-10 flex h-eh-12 shrink-0 items-center gap-eh-2 border-b border-eh-border bg-bo-header px-eh-2"
	>
		<BoButton
			v-if="showNavToggle"
			variant="ghost"
			icon="left_panel_open"
			:aria-label="$t('open_navigation')"
			class="shrink-0"
			@click="navBarStore.expand"
		/>

		<BoIcon v-if="icon" :name="icon" class="shrink-0 ps-eh-2" />

		<h1 class="m-0 min-w-0 truncate ps-eh-2 text-eh-xl font-semibold">{{ title }}</h1>

		<div class="grow" />

		<div v-if="$slots['actions']" class="flex shrink-0 items-center gap-eh-2">
			<slot name="actions" />
		</div>

		<BoButton
			variant="ghost"
			:icon="sidebarStore.collapsed ? 'right_panel_open' : 'right_panel_close'"
			:aria-label="$t(sidebarStore.collapsed ? 'open_sidebar' : 'close_sidebar')"
			:aria-expanded="!sidebarStore.collapsed"
			class="shrink-0"
			@click="sidebarStore.toggle"
		/>
	</header>
</template>
