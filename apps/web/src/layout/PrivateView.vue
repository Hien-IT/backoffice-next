<!-- Ported from directus/app/src/views/private/private-view/components/private-view.vue -->
<script setup lang="ts">
// Backoffice: private-view.vue, private-view-root.vue and private-view-main.vue in one flex layout (no
// @directus/vue-split-panel): module bar, nav, header, main and sidebar. Breakpoints of FR-028: from `xl` three
// columns; from `lg` the sidebar starts collapsed; below `lg` nav (with the module bar) and sidebar are drawers.
// No license banner, notifications drawer or dialogs (D-38, D-45). The page title goes through useHead; the
// `%s · project` template is in theme/use-app-head.ts.
import { useHead } from '@unhead/vue';
import { computed, watch } from 'vue';
import BoSkipMenu from '../components/BoSkipMenu.vue';
import { useLayoutBreakpoints } from '../composables/use-media-query.ts';
import { useUserStore } from '../stores/user.ts';
import HeaderBar from './HeaderBar.vue';
import MainContent from './MainContent.vue';
import ModuleBar from './ModuleBar.vue';
import NavBar from './NavBar.vue';
import NoAppAccess from './NoAppAccess.vue';
import Sidebar from './Sidebar.vue';
import { useNavBarStore } from './stores/nav-bar.ts';
import { useSidebarStore } from './stores/sidebar.ts';

const props = defineProps<{
	/** Title to show in the header bar and the browser tab */
	title?: string | undefined;

	/** Render an icon before the title */
	icon?: string | undefined;
}>();

const userStore = useUserStore();

const appAccess = computed(() => {
	if (!userStore.currentUser) return true;
	// Backoffice: share users have no app_access field to check (FR-002, CHK006).
	if ('share' in userStore.currentUser) return true;
	return userStore.currentUser?.app_access || false;
});

useHead({ title: () => props.title ?? null });

const { lg, xl } = useLayoutBreakpoints();
const navBarStore = useNavBarStore();
const sidebarStore = useSidebarStore();

// private-view-main.vue collapses the sidebar on small screens; here below `xl` (FR-028: collapsed from `lg` to `xl`,
// drawer below `lg`).
watch(
	xl,
	(wide) => {
		if (!wide) sidebarStore.collapse();
	},
	{ immediate: true },
);

// From private-view-root.vue. Backoffice: also on mount, so a nav saved open is not a drawer opened on load; a
// collapsed inline nav stays collapsed after reload (US2-4).
watch(
	() => navBarStore.inlineNav,
	(inline, wasInline) => {
		if (!inline) navBarStore.collapse();
		else if (wasInline === false) navBarStore.expand();
	},
	{ immediate: true },
);
</script>

<template>
	<NoAppAccess v-if="appAccess === false" />
	<div v-else class="flex h-dvh overflow-hidden bg-eh-surface-default text-eh-text-primary">
		<BoSkipMenu />

		<div v-if="lg" id="navigation" tabindex="-1" class="flex h-full shrink-0">
			<ModuleBar />
			<NavBar v-if="navBarStore.inlineNav">
				<slot name="navigation" />
			</NavBar>
		</div>

		<NavBar v-if="!navBarStore.inlineNav" drawer>
			<template #prepend><ModuleBar /></template>
			<slot name="navigation" />
		</NavBar>

		<div class="flex h-full min-w-0 grow flex-col overflow-y-auto">
			<HeaderBar :title="title" :icon="icon">
				<template v-if="$slots['actions']" #actions><slot name="actions" /></template>
			</HeaderBar>
			<MainContent>
				<slot />
			</MainContent>
		</div>

		<Sidebar :drawer="!lg">
			<slot name="sidebar" />
		</Sidebar>
	</div>
</template>
