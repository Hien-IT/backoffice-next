<!-- Ported from directus/app/src/views/private/private-view/components/private-view.vue -->
<script setup lang="ts">
// Backoffice: the TailAdmin AdminLayout of design-system layout-patterns (D-52) instead of private-view-root.vue and
// private-view-main.vue: top bar (logo, module tabs, bell, user menu; owner 2026-10-22, D-157), sidebar (the
// `navigation` slot of the current module, left out when the page has none), header (sidebar toggle and the page header: title, icon, `actions`; owner 2026-10-20), content; the right
// detail panel (`sidebar` slot) is a popover of the page header (owner 2026-10-20). One breakpoint, `xl` (L-1): from
// `xl` the sidebar is inline, below `xl` a drawer. No license banner (D-38); the notifications drawer (018 FR-077) is
// mounted here once, as a lazy chunk (FR-109). The page title goes through useHead; the `%s · project` template is in theme/use-app-head.ts.
import { useHead } from '@unhead/vue';
import { computed, defineAsyncComponent, useTemplateRef } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import BoSkipMenu from '../components/BoSkipMenu.vue';
import NoticeStack from '../components/NoticeStack.vue';
import { useLayoutBreakpoints } from '../composables/use-media-query.ts';
import { useUserStore } from '../stores/user.ts';
import AppHeader from './AppHeader.vue';
import AppSidebar from './AppSidebar.vue';
import AppTopBar from './AppTopBar.vue';
import MainContent from './MainContent.vue';
import NoAppAccess from './NoAppAccess.vue';
import PageHeader from './PageHeader.vue';
import { useNavBarStore } from './stores/nav-bar.ts';
import { useSidebarStore } from './stores/sidebar.ts';

const NotificationsDrawer = defineAsyncComponent(() => import('../components/NotificationsDrawer.vue'));

const props = defineProps<{
	/** Title to show in the page header and the browser tab */
	title?: string | undefined;

	/** Render an icon before the title */
	icon?: string | undefined;

	/** Color of the icon (collection color) */
	iconColor?: string | null | undefined;

	/** Parent pages (the Directus `headline` breadcrumb); not shown, D-101 (PageHeader). */
	breadcrumb?: { name: string; to: RouteLocationRaw }[] | undefined;

	/** Back button before the title: a route, or `true` for the browser history */
	back?: RouteLocationRaw | true | undefined;

	/** Browser tab title when it differs from the page title (the item page, FR-051) */
	tabTitle?: string | undefined;

	/**
	 * Backoffice (016, user request): the page is as high as the window; the header and the page header stay, the
	 * content takes the rest and scrolls inside it (the table of a collection page keeps its header row on top).
	 */
	fill?: boolean;
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
const slots = defineSlots<Record<string, (() => unknown) | undefined>>();
// The inline sidebar from `xl`, unless the page has no navigation or the user hid it.
const inlineSidebar = computed(() => xl.value && !!slots['navigation'] && !navBarStore.collapsed);

// The detail popover starts closed on every page.
sidebarStore.collapse();

// Spec 020: the scrolling content of a `fill` page, the `main-element` of the extension view shim.
const scroll = useTemplateRef<HTMLElement>('scroll');
const scrollElement = computed(() => (props.fill ? scroll.value : null));
defineExpose({ scrollElement });
</script>

<template>
	<NoAppAccess v-if="appAccess === false" />
	<!-- `relative`: absolute descendants (sr-only labels in the table) would escape the clip and stretch the page. -->
	<div v-else class="pt-16 xl:flex" :class="fill ? 'relative h-dvh overflow-hidden' : 'min-h-screen'">
		<BoSkipMenu />

		<AppTopBar />

		<AppSidebar v-if="$slots['navigation']" :drawer="!xl">
			<template #navigation><slot name="navigation" /></template>
		</AppSidebar>

		<div
			class="flex min-w-0 flex-1 flex-col"
			:class="[{ 'xl:ms-[290px]': inlineSidebar }, fill ? 'h-[calc(100dvh-4rem)]' : 'min-h-[calc(100vh-4rem)]']"
		>
			<div class="flex min-w-0 flex-1" :class="{ 'min-h-0': fill }">
				<MainContent class="w-full p-4 pb-20 md:p-6 md:pb-6" :class="{ 'flex min-h-0 flex-col': fill }">
					<!-- In main, as the Directus header bar (the page title is `main h1`); sticky, so it stays on top while the
					     page scrolls. The negative margins span the content padding. -->
					<!-- `top`: under the top bar; on a `fill` page the scroll box already starts under it (its padding). -->
					<AppHeader
						:navigation="!!$slots['navigation']"
						class="-mx-4 -mt-4 mb-4 shrink-0 md:-mx-6 md:-mt-6 md:mb-6"
						:class="fill ? 'top-0' : 'top-16'"
					>
						<PageHeader :title="title" :icon="icon" :icon-color="iconColor" :breadcrumb="breadcrumb" :back="back">
							<template v-if="$slots['title']" #title><slot name="title" /></template>
							<!-- Spec 020 (Q-45): the extra title and action slots of the Directus view, for extensions. -->
							<template v-if="$slots['heading']" #heading><slot name="heading" /></template>
							<template v-if="$slots['title-outer:prepend']" #title-outer:prepend>
								<slot name="title-outer:prepend" />
							</template>
							<template v-if="$slots['title:prepend']" #title:prepend><slot name="title:prepend" /></template>
							<template v-if="$slots['title:append']" #title:append><slot name="title:append" /></template>
							<template v-if="$slots['actions:prepend']" #actions:prepend><slot name="actions:prepend" /></template>
							<template v-if="$slots['actions:append']" #actions:append><slot name="actions:append" /></template>
							<template v-if="$slots['headline-append']" #headline-append><slot name="headline-append" /></template>
							<template v-if="$slots['title-append']" #title-append><slot name="title-append" /></template>
							<template v-if="$slots['actions']" #actions><slot name="actions" /></template>
							<template v-if="$slots['sidebar']" #sidebar><slot name="sidebar" /></template>
						</PageHeader>
					</AppHeader>
					<!-- Backoffice: in-place notices and error dialogs of feature 014 (D-66, FR-054b). -->
					<NoticeStack />
					<!-- One element either way: switching `fill` (item page live preview) keeps the page mounted. -->
					<div ref="scroll" :class="fill ? 'flex min-h-0 flex-1 flex-col overflow-auto' : 'contents'">
						<slot />
					</div>
				</MainContent>
			</div>
		</div>

		<NotificationsDrawer />
	</div>
</template>
