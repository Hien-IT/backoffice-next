<!-- Ported from directus/app/src/views/private/private-view/components/private-view-sidebar.vue -->
<script setup lang="ts">
// Backoffice: no accordion of sidebar details or AI panel (D-45, D-41); a collapsed inline sidebar is hidden (Directus
// keeps a 54 px strip of detail icons) and opens again from the header toggle; below `lg` it is a drawer (Reka
// Dialog: focus trap, Esc, focus back to the opener), as private-view-main.vue does on small screens.
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

// The file name follows the layout areas of contracts/ui-routes §4; the component name is multi-word.
defineOptions({ name: 'PrivateViewSidebar' });

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
			<DialogOverlay class="fixed inset-0 z-40 bg-eh-neutral-900/50" />
			<DialogContent
				id="sidebar"
				:aria-describedby="undefined"
				class="fixed inset-y-0 end-0 z-50 flex w-[19rem] max-w-full flex-col bg-bo-sidebar text-eh-text-primary shadow-eh-sm"
			>
				<div class="flex h-eh-12 shrink-0 items-center justify-between border-b border-eh-border ps-eh-4 pe-eh-1">
					<DialogTitle class="m-0 text-eh-sm font-semibold">{{ $t('sidebar') }}</DialogTitle>
					<DialogClose
						:aria-label="$t('close_sidebar')"
						class="inline-flex size-eh-10 cursor-pointer items-center justify-center rounded-eh-md border-0 bg-transparent text-eh-text-primary hover:bg-eh-surface-subtle"
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

	<CollapsibleRoot v-else :open="!sidebarStore.collapsed" class="flex h-full shrink-0" @update:open="onOpen">
		<CollapsibleContent class="relative h-full shrink-0" :style="{ width: `${sidebarStore.size}px` }">
			<aside
				id="sidebar"
				:aria-label="$t('sidebar')"
				class="h-full overflow-y-auto border-s border-eh-border bg-bo-sidebar"
			>
				<slot />
			</aside>
			<ResizeHandle v-model="sidebarStore.size" :min="MIN_SIZE" :max="MAX_SIZE" location="end" :label="$t('sidebar')" />
		</CollapsibleContent>
	</CollapsibleRoot>
</template>
