<!-- Ported from directus/app/src/views/private/components/module-bar.vue -->
<script setup lang="ts">
// Backoffice: the TailAdmin sidebar (design-system layout-patterns §2, D-52) holding the DR module bar and the
// module navigation in one column, in the manner of the Arc browser sidebar and the owner's mock-up (2026-10-22, D-157):
// a rounded card on the project color (flat; in dark mode the project color mixed into gray-900) with the logo, the
// project name and descriptor and the
// modules as a grid of icon-and-name tiles (ModuleTabs; the links and the D-144 extension modules in one menu tile,
// D-162), then the open module's name with the actions it teleports to
// `module-actions-<id>` (the Content hidden-collections toggle) and its `navigation` slot on white, then the notifications bell and the user menu at the
// bottom (DR module-bar-avatar.vue). From `xl` it is fixed inline, 290 px by default, and the header toggle hides it
// (saved); below `xl` it is a drawer (Reka Dialog: backdrop, focus trap, Esc, focus back to the opener). Owner
// 2026-10-28: the inline column is resizable (DR private-view-resize-handle.vue) by its end edge, with the pointer or
// the arrow keys (window splitter pattern); the drawer keeps 290 px. D-200 (owner 2026-10-31): a pressed toggle at the
// card's top end makes it compact (small logo, icon tiles), so a short screen keeps room for the module navigation.
import { createReusableTemplate } from '@vueuse/core';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import BoIcon from '../components/BoIcon.vue';
import { useModuleBar } from './composables/use-module-bar.ts';
import ModuleTabs from './ModuleTabs.vue';
import NotificationsBell from './NotificationsBell.vue';
import SidebarLogo from './SidebarLogo.vue';
import UserMenu from './UserMenu.vue';
import { NAV_BAR_SIZE, useNavBarStore } from './stores/nav-bar.ts';

const { drawer = false } = defineProps<{ drawer?: boolean }>();

const navBarStore = useNavBarStore();
const { currentModule } = useModuleBar();

const [DefineSidebar, ReuseSidebar] = createReusableTemplate();

// The column starts at the inline start edge: its width is the pointer distance from that edge (mirrored in RTL).
function startResize(event: PointerEvent) {
	if (event.button !== 0) return;
	event.preventDefault();

	const handle = event.currentTarget as HTMLElement;
	const aside = handle.parentElement!;
	const rtl = getComputedStyle(aside).direction === 'rtl';
	const { left, right } = aside.getBoundingClientRect();
	const move = (e: PointerEvent) => (navBarStore.size = rtl ? right - e.clientX : e.clientX - left);

	handle.setPointerCapture(event.pointerId);
	handle.addEventListener('pointermove', move);
	handle.addEventListener('lostpointercapture', () => handle.removeEventListener('pointermove', move), { once: true });
}

function resizeByKey(event: KeyboardEvent) {
	const step = { ArrowRight: 16, ArrowLeft: -16 }[event.key];
	if (!step) return;
	event.preventDefault();

	const rtl = getComputedStyle(event.currentTarget as Element).direction === 'rtl';
	navBarStore.size += rtl ? -step : step;
}
</script>

<template>
	<DefineSidebar>
		<aside
			id="navigation"
			tabindex="-1"
			:aria-label="$t('navigation')"
			class="flex h-full flex-col border-e border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-900"
			:class="drawer ? 'w-full' : 'fixed inset-y-0 start-0 z-999'"
			:style="drawer ? undefined : { width: `${navBarStore.size}px` }"
		>
			<div
				v-if="!drawer"
				role="separator"
				aria-orientation="vertical"
				tabindex="0"
				:aria-label="$t('resize_navigation')"
				:aria-valuenow="navBarStore.size"
				:aria-valuemin="NAV_BAR_SIZE.min"
				:aria-valuemax="NAV_BAR_SIZE.max"
				class="group absolute inset-y-0 -end-1 z-1 flex w-2 cursor-col-resize touch-none justify-center focus-visible:outline-none"
				@pointerdown="startResize"
				@keydown="resizeByKey"
			>
				<div
					class="h-full w-0.5 bg-brand-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100"
				/>
			</div>

			<div
				data-testid="module-rail"
				class="m-3 flex shrink-0 flex-col rounded-2xl bg-(--project-color) shadow-theme-md dark:bg-[color-mix(in_srgb,var(--project-color)_30%,var(--color-gray-900))] dark:shadow-none dark:ring-1 dark:ring-white/10"
				:class="navBarStore.modulesCompact ? 'gap-3 p-3' : 'gap-4 p-4'"
			>
				<div class="flex items-start gap-2">
					<SidebarLogo :compact="navBarStore.modulesCompact" class="flex-1" />
					<button
						type="button"
						:aria-pressed="navBarStore.modulesCompact"
						:aria-label="$t('compact_modules')"
						:title="$t('compact_modules')"
						class="flex size-8 shrink-0 items-center justify-center rounded-lg text-(--project-foreground) hover:bg-(--project-tile-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--project-foreground) dark:text-white dark:hover:bg-white/10 dark:focus-visible:outline-white"
						@click="navBarStore.modulesCompact = !navBarStore.modulesCompact"
					>
						<BoIcon :name="navBarStore.modulesCompact ? 'unfold_more' : 'unfold_less'" size="sm" />
					</button>
				</div>
				<ModuleTabs :compact="navBarStore.modulesCompact" />
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
