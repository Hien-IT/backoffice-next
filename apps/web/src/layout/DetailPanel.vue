<!-- Ported from directus/app/src/views/private/private-view/components/private-view-sidebar.vue -->
<script setup lang="ts">
// Backoffice: the right detail panel of design-system layout-patterns (L-4, D-52). No accordion of sidebar details or
// AI panel (D-45, D-41). Owner 2026-10-20: a popover under its page header toggle on every screen, instead of the
// resizable inline column (from `xl`) and the end drawer (below `xl`). Reka Popover: Esc and a click outside close it,
// focus goes back to the toggle. Focus moving out does not close it: a dialog opened from a detail would unmount with
// the detail. Open state is the sidebar store (`collapsed` = closed), closed again on every page (PrivateView).
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import BoButton from '../components/BoButton.vue';
import { useSidebarStore } from './stores/sidebar.ts';

const sidebarStore = useSidebarStore();

function onOpen(open: boolean) {
	if (open) sidebarStore.expand();
	else sidebarStore.collapse();
}
</script>

<template>
	<PopoverRoot :open="!sidebarStore.collapsed" @update:open="onOpen">
		<PopoverTrigger as-child>
			<!-- Owner 2026-10-22 (D-161): the `info` icon in both states (DR right_panel_open/close); the open state
			     is the brand tint of the button (Reka data-state). -->
			<BoButton
				variant="ghost"
				icon="info"
				:aria-label="$t(sidebarStore.collapsed ? 'open_sidebar' : 'close_sidebar')"
				class="data-[state=open]:bg-brand-500/[0.08] data-[state=open]:text-brand-600 dark:data-[state=open]:text-brand-400"
			/>
		</PopoverTrigger>
		<PopoverPortal>
			<PopoverContent
				side="bottom"
				align="end"
				:side-offset="8"
				:collision-padding="16"
				class="z-99999 max-h-(--reka-popover-content-available-height) w-[333px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white text-gray-800 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark dark:text-white/90"
				@focus-outside.prevent
			>
				<aside id="sidebar" :aria-label="$t('sidebar')">
					<slot />
				</aside>
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>
