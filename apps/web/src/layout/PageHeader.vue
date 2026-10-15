<!-- Ported from directus/app/src/views/private/private-view/components/private-view-header-bar.vue -->
<script setup lang="ts">
// Backoffice: the page header of the TailAdmin content area (layout-patterns §5, component-specs Breadcrumb): icon,
// h1 title and actions, then the toggle of the right detail panel (L-4). Feature 014: the Directus `headline` breadcrumb
// (component-specs Breadcrumb) above the title, the icon color of the collection and the `title-outer:append` slot as
// `title-append`. No back button; labelled buttons instead of clickable icons with tooltips (FR-027); the panel toggle is always
// shown, as the collapsed panel has no detail buttons to reopen it in 012 (D-45). The sidebar toggle is in AppHeader.
import { RouterLink, type RouteLocationRaw, useRouter } from 'vue-router';
import BoButton from '../components/BoButton.vue';
import BoIcon from '../components/BoIcon.vue';
import { useSidebarStore } from './stores/sidebar.ts';

defineProps<{
	title?: string | undefined;
	icon?: string | undefined;
	/** Data color of the icon (collection color, Q-C of 013), as an inline style. */
	iconColor?: string | null | undefined;
	/** Parent pages, shown as links above the title (Directus v-breadcrumb in the `headline` slot). */
	breadcrumb?: { name: string; to: RouteLocationRaw }[] | undefined;
	/** Back button before the title (Directus `show-back`): a route, or `true` for the browser history. */
	back?: RouteLocationRaw | true | undefined;
}>();

const router = useRouter();

const sidebarStore = useSidebarStore();
</script>

<template>
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div class="flex min-w-0 flex-col gap-1">
			<div v-if="breadcrumb?.length || $slots['headline-append']" class="flex flex-wrap items-center gap-2">
				<nav v-if="breadcrumb?.length" aria-label="Breadcrumb">
					<ol class="m-0 flex list-none items-center gap-1.5 p-0">
						<li v-for="crumb in breadcrumb" :key="crumb.name" class="flex items-center gap-1.5">
							<RouterLink
								:to="crumb.to"
								class="inline-flex items-center gap-1.5 rounded text-sm text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400"
							>
								{{ crumb.name }}
							</RouterLink>
							<BoIcon name="chevron_right" size="sm" class="text-gray-500 dark:text-gray-400" aria-hidden="true" />
						</li>
					</ol>
				</nav>
				<!-- The Directus headline: the version menu of the item page after the breadcrumb (recipe Q-8). -->
				<slot name="headline-append" />
			</div>
			<div class="flex min-w-0 items-center gap-3">
				<BoButton
					v-if="back"
					variant="ghost"
					icon="arrow_back"
					:aria-label="$t('back')"
					v-bind="back === true ? {} : { to: back }"
					@click="back === true && router.back()"
				/>
				<BoIcon
					v-if="icon"
					:name="icon"
					class="shrink-0"
					:class="iconColor ? '' : 'text-gray-500 dark:text-gray-400'"
					:style="iconColor ? { color: iconColor } : undefined"
				/>
				<h1 class="m-0 min-w-0 truncate text-xl font-semibold text-gray-800 dark:text-white/90">
					<slot name="title">{{ title }}</slot>
				</h1>
				<slot name="title-append" />
			</div>
		</div>

		<div class="flex shrink-0 items-center gap-3">
			<slot name="actions" />

			<BoButton
				variant="ghost"
				:icon="sidebarStore.collapsed ? 'right_panel_open' : 'right_panel_close'"
				:aria-label="$t(sidebarStore.collapsed ? 'open_sidebar' : 'close_sidebar')"
				:aria-expanded="!sidebarStore.collapsed"
				aria-controls="sidebar"
				@click="sidebarStore.toggle"
			/>
		</div>
	</div>
</template>
