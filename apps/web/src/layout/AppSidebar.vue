<!-- Ported from directus/app/src/views/private/components/module-bar.vue -->
<script setup lang="ts">
// Backoffice: the TailAdmin sidebar (design-system layout-patterns §2, D-52) holding the DR module bar and the
// module navigation in one column, in the manner of the Arc browser sidebar and the owner's mock-up (2026-10-22, D-157):
// a rounded card on the project color (flat; in dark mode the project color mixed into gray-900) with the logo, the
// project name and descriptor and the
// modules as a grid of icon-and-name tiles (ModuleTabs; the links and the D-144 extension modules in one menu tile,
// D-162), then the open module's name with the actions it teleports to
// `module-actions-<id>` (the Content hidden-collections toggle) and its `navigation` slot on white, then the notifications bell and the user menu at the
// bottom (DR module-bar-avatar.vue). From `xl` it is fixed inline, 290 px, and the header toggle hides it
// (saved); below `xl` it is a drawer (Reka Dialog: backdrop, focus trap, Esc, focus back to the opener).
import { createReusableTemplate } from '@vueuse/core';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import BoIcon from '../components/BoIcon.vue';
import { useModuleBar } from './composables/use-module-bar.ts';
import ModuleTabs from './ModuleTabs.vue';
import NotificationsBell from './NotificationsBell.vue';
import SidebarLogo from './SidebarLogo.vue';
import UserMenu from './UserMenu.vue';
import { useNavBarStore } from './stores/nav-bar.ts';

const { drawer = false } = defineProps<{ drawer?: boolean }>();

const navBarStore = useNavBarStore();
const { currentModule } = useModuleBar();

const [DefineSidebar, ReuseSidebar] = createReusableTemplate();
</script>

<template>
	<DefineSidebar>
		<aside
			id="navigation"
			tabindex="-1"
			:aria-label="$t('navigation')"
			class="flex h-full flex-col border-e border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-900"
			:class="drawer ? 'w-full' : 'fixed inset-y-0 start-0 z-999 w-[290px]'"
		>
			<div
				data-testid="module-rail"
				class="m-3 flex shrink-0 flex-col gap-4 rounded-2xl bg-(--project-color) p-4 shadow-theme-md dark:bg-[color-mix(in_srgb,var(--project-color)_30%,var(--color-gray-900))] dark:shadow-none dark:ring-1 dark:ring-white/10"
			>
				<SidebarLogo />
				<ModuleTabs />
			</div>

			<div v-if="currentModule" class="flex items-center gap-2 px-5 pt-5 pb-3">
				<BoIcon :name="currentModule.icon" class="shrink-0 text-gray-500 dark:text-gray-400" />
				<h2 class="m-0 min-w-0 flex-1 truncate text-base font-semibold text-gray-800 dark:text-white/90">
					{{ currentModule.name }}
				</h2>
				<div :id="`module-actions-${currentModule.id}`" class="flex items-center empty:hidden" />
			</div>

			<div class="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6" data-module-navigation>
				<slot name="navigation" />
			</div>

			<div
				class="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-800"
			>
				<UserMenu />
				<NotificationsBell />
			</div>
		</aside>
	</DefineSidebar>

	<DialogRoot v-if="drawer" v-model:open="navBarStore.drawerOpen">
		<DialogPortal>
			<DialogOverlay class="fixed inset-0 z-9999 bg-gray-900/50" />
			<DialogContent :aria-describedby="undefined" class="fixed inset-y-0 start-0 z-99999 w-[290px] max-w-full">
				<DialogTitle class="sr-only">{{ $t('navigation') }}</DialogTitle>
				<ReuseSidebar />
			</DialogContent>
		</DialogPortal>
	</DialogRoot>

	<ReuseSidebar v-else-if="!navBarStore.collapsed" />
</template>
