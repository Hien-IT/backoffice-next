<script setup lang="ts">
// Backoffice: the TailAdmin sidebar (design-system layout-patterns §2, D-52) next to the module rail. Since 2026-10-22
// (owner, D-157) the modules are the icon tabs of the rail (AppModuleBar, D-144 Extensions included), and the sidebar
// holds the navigation of the open module only, like the second column of Directus: its name, the actions it
// teleports to `module-actions-<id>` (the Content hidden-collections toggle), then the `navigation` slot. From `xl` it
// is fixed inline, 290 px, and the header toggle hides it (saved); below `xl` it is a drawer next to the rail (Reka
// Dialog: backdrop, focus trap, Esc, focus back to the opener). The layout leaves it out for a module without navigation.
import { createReusableTemplate } from '@vueuse/core';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import BoIcon from '../components/BoIcon.vue';
import { useModuleBar } from './composables/use-module-bar.ts';
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
			:aria-label="currentModule?.name ?? $t('navigation')"
			class="flex h-full flex-col border-e border-gray-200 bg-white px-5 text-gray-900 dark:border-gray-800 dark:bg-gray-900"
			:class="drawer ? 'w-full' : 'fixed inset-y-0 start-16 z-999 w-[290px]'"
		>
			<div v-if="currentModule" class="flex items-center gap-2 pt-5 pb-3">
				<BoIcon :name="currentModule.icon" class="shrink-0 text-gray-500 dark:text-gray-400" />
				<h2 class="m-0 min-w-0 flex-1 truncate text-base font-semibold text-gray-800 dark:text-white/90">
					{{ currentModule.name }}
				</h2>
				<div :id="`module-actions-${currentModule.id}`" class="flex items-center empty:hidden" />
			</div>

			<div class="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pb-6" data-module-navigation>
				<slot name="navigation" />
			</div>
		</aside>
	</DefineSidebar>

	<DialogRoot v-if="drawer" v-model:open="navBarStore.drawerOpen">
		<DialogPortal>
			<DialogOverlay class="fixed inset-0 z-9999 bg-gray-900/50" />
			<DialogContent :aria-describedby="undefined" class="fixed inset-y-0 start-16 z-99999 w-[290px] max-w-[calc(100%-4rem)]">
				<DialogTitle class="sr-only">{{ $t('navigation') }}</DialogTitle>
				<ReuseSidebar />
			</DialogContent>
		</DialogPortal>
	</DialogRoot>

	<ReuseSidebar v-else-if="!navBarStore.collapsed" />
</template>
