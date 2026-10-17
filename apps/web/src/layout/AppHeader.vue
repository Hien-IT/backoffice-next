<script setup lang="ts">
// TailAdmin AppHeader (design-system layout-patterns §4, D-52): the sidebar toggle and the user menu. From `xl` the
// toggle collapses the inline sidebar to its rail (saved); below `xl` it opens the sidebar drawer, which takes focus
// and gives it back to this button on close. No search or theme toggle (D-45); the notifications bell comes before the
// user menu since 018 (FR-070, recipe Q-38).
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../components/BoButton.vue';
import NotificationsBell from './NotificationsBell.vue';
import { useNavBarStore } from './stores/nav-bar.ts';
import UserMenu from './UserMenu.vue';

const { t } = useI18n();
const navBarStore = useNavBarStore();

const toggle = computed(() =>
	navBarStore.inlineNav
		? { label: t('toggle_navigation'), expanded: !navBarStore.collapsed, onClick: navBarStore.toggle }
		: { label: t('open_navigation'), expanded: navBarStore.drawerOpen, onClick: () => (navBarStore.drawerOpen = true) },
);
</script>

<template>
	<header
		class="sticky top-0 z-999 flex w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
	>
		<div class="flex grow items-center justify-between gap-2 px-3 py-3 sm:gap-4 lg:py-4 xl:px-6">
			<BoButton
				variant="ghost"
				icon="menu"
				:aria-label="toggle.label"
				:aria-expanded="toggle.expanded"
				aria-controls="navigation"
				class="shrink-0"
				@click="toggle.onClick"
			/>

			<div class="flex items-center gap-3">
				<NotificationsBell />
				<UserMenu />
			</div>
		</div>
	</header>
</template>
