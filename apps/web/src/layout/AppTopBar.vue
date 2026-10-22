<script setup lang="ts">
// Backoffice (owner 2026-10-22, D-157, layout-patterns §2): the top bar across the window, 64 px: the logo, the module
// tabs (ModuleTabs), then the notifications bell and the user menu (under the sidebar logo since D-127 until then). The
// tabs scroll sideways below `xl` too; the module navigation is the sidebar under it, a drawer below `xl`.
import NotificationsBell from './NotificationsBell.vue';
import ModuleTabs from './ModuleTabs.vue';
import SidebarLogo from './SidebarLogo.vue';
import UserMenu from './UserMenu.vue';
</script>

<template>
	<!-- The banner landmark of the page; the page header in main is not one. -->
	<header
		class="fixed inset-x-0 top-0 z-1000 flex h-16 items-center gap-3 border-b border-gray-200 bg-white ps-4 pe-3 sm:gap-6 xl:ps-6 dark:border-gray-800 dark:bg-gray-900"
	>
		<SidebarLogo />
		<div class="h-full min-w-0 flex-1"><ModuleTabs /></div>
		<div class="flex shrink-0 items-center gap-3">
			<NotificationsBell />
			<UserMenu />
		</div>
	</header>
</template>
