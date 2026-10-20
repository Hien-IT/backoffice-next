<script setup lang="ts">
// TailAdmin AppHeader (design-system layout-patterns §4, D-52): the sidebar toggle, then the page header of the
// default slot (owner 2026-10-20: one sticky band instead of the header plus the page header under it). From `xl` the
// toggle collapses the inline sidebar to its rail (saved); below `xl` it opens the sidebar drawer, which takes focus
// and gives it back to this button on close. No search or theme toggle (D-45); the notifications bell and the user menu
// moved under the sidebar logo (owner 2026-10-20, AppSidebar.vue). Below `xl` the sidebar is a closed drawer, so the
// bell stays at the end of this row there: its badge, live region and recount are always mounted.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../components/BoButton.vue';
import NotificationsBell from './NotificationsBell.vue';
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

			<NotificationsBell v-if="!navBarStore.inlineNav" />
		</div>
	</header>
</template>
