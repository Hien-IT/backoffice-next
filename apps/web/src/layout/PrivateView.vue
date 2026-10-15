<!-- Ported from directus/app/src/views/private/private-view/components/private-view.vue -->
<script setup lang="ts">
// Backoffice: the TailAdmin AdminLayout of design-system layout-patterns (D-52) instead of private-view-root.vue and
// private-view-main.vue: sidebar (modules, the `navigation` slot as the current module's sub-menu), header (sidebar
// toggle, user menu), content with the page header (title, icon, `actions`) and the right detail panel (`sidebar`
// slot). One breakpoint, `xl` (L-1): from `xl` sidebar and panel are inline, below `xl` both are drawers. No license
// banner, notifications drawer or dialogs (D-38, D-45). The page title goes through useHead; the `%s · project`
// template is in theme/use-app-head.ts.
import { useHead } from '@unhead/vue';
import { computed, watch } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import BoSkipMenu from '../components/BoSkipMenu.vue';
import NoticeStack from '../components/NoticeStack.vue';
import { useLayoutBreakpoints } from '../composables/use-media-query.ts';
import { useUserStore } from '../stores/user.ts';
import AppHeader from './AppHeader.vue';
import AppSidebar from './AppSidebar.vue';
import DetailPanel from './DetailPanel.vue';
import MainContent from './MainContent.vue';
import NoAppAccess from './NoAppAccess.vue';
import PageHeader from './PageHeader.vue';
import { useNavBarStore } from './stores/nav-bar.ts';
import { useSidebarStore } from './stores/sidebar.ts';

const props = defineProps<{
	/** Title to show in the page header and the browser tab */
	title?: string | undefined;

	/** Render an icon before the title */
	icon?: string | undefined;

	/** Color of the icon (collection color) */
	iconColor?: string | null | undefined;

	/** Parent pages above the title (the Directus `headline` breadcrumb) */
	breadcrumb?: { name: string; to: RouteLocationRaw }[] | undefined;

	/** Back button before the title: a route, or `true` for the browser history */
	back?: RouteLocationRaw | true | undefined;

	/** Browser tab title when it differs from the page title (the item page, FR-051) */
	tabTitle?: string | undefined;
}>();

const userStore = useUserStore();

const appAccess = computed(() => {
	if (!userStore.currentUser) return true;
	// Backoffice: share users have no app_access field to check (FR-002, CHK006).
	if ('share' in userStore.currentUser) return true;
	return userStore.currentUser?.app_access || false;
});

useHead({ title: () => props.tabTitle ?? props.title ?? null });

const { xl } = useLayoutBreakpoints();
const navBarStore = useNavBarStore();
const sidebarStore = useSidebarStore();

// private-view-main.vue collapses the sidebar on small screens; here the detail panel below `xl` (closed drawer).
watch(
	xl,
	(wide) => {
		if (!wide) sidebarStore.collapse();
	},
	{ immediate: true },
);
</script>

<template>
	<NoAppAccess v-if="appAccess === false" />
	<div v-else class="min-h-screen xl:flex">
		<BoSkipMenu />

		<AppSidebar :drawer="!xl">
			<template v-if="$slots['navigation']" #navigation><slot name="navigation" /></template>
		</AppSidebar>

		<div
			class="flex min-h-screen min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out motion-reduce:transition-none"
			:class="navBarStore.collapsed ? 'xl:ms-[90px]' : 'xl:ms-[290px]'"
		>
			<AppHeader />

			<div class="flex min-w-0 flex-1">
				<MainContent class="mx-auto w-full max-w-(--breakpoint-2xl) p-4 pb-20 md:p-6 md:pb-6">
					<PageHeader :title="title" :icon="icon" :icon-color="iconColor" :breadcrumb="breadcrumb" :back="back">
						<template v-if="$slots['title']" #title><slot name="title" /></template>
						<template v-if="$slots['headline-append']" #headline-append><slot name="headline-append" /></template>
						<template v-if="$slots['title-append']" #title-append><slot name="title-append" /></template>
						<template v-if="$slots['actions']" #actions><slot name="actions" /></template>
					</PageHeader>
					<!-- Backoffice: in-place notices and error dialogs of feature 014 (D-66, FR-054b). -->
					<NoticeStack />
					<slot />
				</MainContent>

				<DetailPanel :drawer="!xl">
					<slot name="sidebar" />
				</DetailPanel>
			</div>
		</div>
	</div>
</template>
