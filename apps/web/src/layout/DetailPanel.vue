<!-- Ported from directus/app/src/views/private/private-view/components/private-view-sidebar.vue -->
<script setup lang="ts">
// Backoffice: the right detail panel of design-system layout-patterns (L-4, D-52). No accordion of sidebar details or
// AI panel (D-45, D-41). From `xl` inline at the end of the content row, open by default, resizable like Directus
// (333 px default); a collapsed panel is hidden (Directus keeps a 54 px strip of detail icons) and opens again from
// the page header toggle. Below `xl` a drawer from the end side (Reka Dialog: backdrop, focus trap, Esc, focus back
// to the opener), as private-view-main.vue does on small screens.
import {
	CollapsibleContent,
	CollapsibleRoot,
	DialogClose,
	DialogContent,
	DialogOverlay,
	DialogPortal,
	DialogRoot,
	DialogTitle,
} from 'reka-ui';
import BoIcon from '../components/BoIcon.vue';
import ResizeHandle from './ResizeHandle.vue';
import { useSidebarStore } from './stores/sidebar.ts';

const { drawer = false } = defineProps<{ drawer?: boolean }>();

const sidebarStore = useSidebarStore();

// Size limits of the sidebar split panel in private-view-main.vue.
const MIN_SIZE = 252;
const MAX_SIZE = 540;

function onOpen(open: boolean) {
	if (open) sidebarStore.expand();
	else sidebarStore.collapse();
}
</script>

<template>
	<DialogRoot v-if="drawer" :open="!sidebarStore.collapsed" @update:open="onOpen">
		<DialogPortal>
			<DialogOverlay class="fixed inset-0 z-9999 bg-gray-900/50" />
			<DialogContent
				id="sidebar"
				:aria-describedby="undefined"
				class="fixed inset-y-0 end-0 z-99999 flex w-[333px] max-w-[calc(100vw-2rem)] flex-col bg-white text-gray-800 shadow-theme-xl dark:bg-gray-900 dark:text-white/90"
			>
				<div
					class="flex shrink-0 items-center justify-between border-b border-gray-200 py-2 ps-5 pe-2 dark:border-gray-800"
				>
					<DialogTitle class="m-0 text-theme-sm font-medium">{{ $t('sidebar') }}</DialogTitle>
					<DialogClose
						:aria-label="$t('close_sidebar')"
						class="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400"
					>
						<BoIcon name="right_panel_close" size="sm" />
					</DialogClose>
				</div>
				<aside :aria-label="$t('sidebar')" class="grow overflow-y-auto">
					<slot />
				</aside>
			</DialogContent>
		</DialogPortal>
	</DialogRoot>

	<CollapsibleRoot v-else :open="!sidebarStore.collapsed" class="flex shrink-0" @update:open="onOpen">
		<CollapsibleContent class="relative h-full shrink-0" :style="{ width: `${sidebarStore.size}px` }">
			<aside
				id="sidebar"
				:aria-label="$t('sidebar')"
				class="h-full overflow-y-auto border-s border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
			>
				<slot />
			</aside>
			<ResizeHandle v-model="sidebarStore.size" :min="MIN_SIZE" :max="MAX_SIZE" location="end" :label="$t('sidebar')" />
		</CollapsibleContent>
	</CollapsibleRoot>
</template>
