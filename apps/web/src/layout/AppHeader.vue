<script setup lang="ts">
// TailAdmin AppHeader (design-system layout-patterns §4, D-52): the sidebar toggle, then the page header of the
// default slot (owner 2026-10-20: one sticky band instead of the header plus the page header under it), sticky at the
// top of the content. From `xl` the toggle hides the inline sidebar (saved);
// below `xl` it opens the sidebar drawer, which takes focus and gives it back to this button on close. No search or
// theme toggle (D-45); the bell and the user menu are at the bottom of the sidebar (D-157).
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../components/BoButton.vue';
import { useNavBarStore } from './stores/nav-bar.ts';

const { t } = useI18n();
const navBarStore = useNavBarStore();

const toggle = computed(() =>
	navBarStore.inlineNav
		? { label: t('toggle_navigation'), expanded: !navBarStore.collapsed, onClick: navBarStore.toggle }
		: { label: t('open_navigation'), expanded: navBarStore.drawerOpen, onClick: () => (navBarStore.drawerOpen = true) },
);
</script>

<template>
	<header class="sticky top-0 z-999 flex border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
		<div class="flex grow items-center gap-2 px-3 py-3 sm:gap-4 lg:py-4 xl:px-6">
			<BoButton
				variant="ghost"
				icon="menu"
				:aria-label="toggle.label"
				:aria-expanded="toggle.expanded"
				aria-controls="navigation"
				class="shrink-0"
				@click="toggle.onClick"
			/>

			<div class="min-w-0 flex-1"><slot /></div>
		</div>
	</header>
</template>
