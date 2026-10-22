<!-- Ported from directus/app/src/views/private/components/module-bar.vue -->
<script setup lang="ts">
// Backoffice (owner 2026-10-22, D-157, layout-patterns §2): the module bar as a vertical rail on the project color at
// the start of the window, 64 px, like the Directus module bar: the logo, the module tabs (ModuleTabs), then at the
// bottom the notifications bell and the user menu (Directus module-bar-avatar.vue). It stays at every width; the module
// navigation is the sidebar next to it, a drawer below `xl`. White icons on the project color: a very light project
// color lowers their contrast (data color, like the logo background).
import NotificationsBell from './NotificationsBell.vue';
import ModuleTabs from './ModuleTabs.vue';
import SidebarLogo from './SidebarLogo.vue';
import UserMenu from './UserMenu.vue';
</script>

<template>
	<div
		data-testid="module-rail"
		class="fixed inset-y-0 start-0 z-1000 flex w-16 flex-col items-center gap-4 bg-(--project-color) py-3 dark:border-e dark:border-gray-800"
	>
		<SidebarLogo />
		<ModuleTabs class="flex-1" />
		<div class="flex flex-col items-center gap-3">
			<NotificationsBell />
			<UserMenu />
		</div>
	</div>
</template>
