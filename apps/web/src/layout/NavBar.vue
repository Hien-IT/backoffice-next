<!-- Ported from directus/app/src/views/private/private-view/components/private-view-nav.vue -->
<script setup lang="ts">
// Backoffice: one component for the inline column (resizable, collapsible) and the drawer (Reka Dialog: focus trap,
// Esc, focus back to the opener), which private-view-root.vue and private-view-drawer.vue do in Directus. The
// drawer also holds the module bar (slot `prepend`), like Directus below the inline breakpoint.
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import ProjectName from './ProjectName.vue';
import ResizeHandle from './ResizeHandle.vue';
import { useNavBarStore } from './stores/nav-bar.ts';

const { drawer = false } = defineProps<{ drawer?: boolean }>();

const navBarStore = useNavBarStore();

// Size limits of the nav split panel in private-view-root.vue.
const MIN_SIZE = 198;
const MAX_SIZE = 306;

function onOpen(open: boolean) {
	if (open) navBarStore.expand();
	else navBarStore.collapse();
}
</script>

<template>
	<DialogRoot v-if="drawer" :open="!navBarStore.collapsed" @update:open="onOpen">
		<DialogPortal>
			<DialogOverlay class="fixed inset-0 z-40 bg-eh-neutral-900/50" />
			<DialogContent
				:aria-describedby="undefined"
				class="fixed inset-y-0 start-0 z-50 flex max-w-full bg-bo-navigation text-eh-text-primary shadow-eh-sm"
			>
				<DialogTitle class="sr-only">{{ $t('navigation') }}</DialogTitle>
				<slot name="prepend" />
				<aside :aria-label="$t('navigation')" class="flex w-[16rem] max-w-full flex-col">
					<ProjectName />
					<div class="grow overflow-y-auto"><slot /></div>
				</aside>
			</DialogContent>
		</DialogPortal>
	</DialogRoot>

	<div v-else-if="!navBarStore.collapsed" class="relative h-full shrink-0" :style="{ width: `${navBarStore.size}px` }">
		<aside :aria-label="$t('navigation')" class="flex h-full flex-col border-e border-eh-border bg-bo-navigation">
			<ProjectName />
			<div class="grow overflow-y-auto"><slot /></div>
		</aside>
		<ResizeHandle v-model="navBarStore.size" :min="MIN_SIZE" :max="MAX_SIZE" :label="$t('navigation')" />
	</div>
</template>
