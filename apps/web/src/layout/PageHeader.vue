<!-- Ported from directus/app/src/views/private/private-view/components/private-view-header-bar.vue -->
<script setup lang="ts">
// Backoffice: the page header of the TailAdmin content area (layout-patterns §5, component-specs Breadcrumb): icon,
// h1 title and actions, then the toggle of the right detail panel (L-4, a popover since 2026-10-20: DetailPanel.vue). Feature 014: the DR `headline` row above
// the title (its breadcrumb is not shown, D-101 of 016; the version menu moved to the title row, owner 2026-10-22), the icon color of the collection and the `title-outer:append` slot as
// `title-append`, and the back button of the item page (`back`, DR `show-back`); labelled buttons instead of clickable icons with tooltips (FR-027); the panel toggle shows when
// the page has details (the `sidebar` slot). The sidebar toggle is in AppHeader.
import { type RouteLocationRaw, useRouter } from 'vue-router';
import BoButton from '../components/BoButton.vue';
import BoIcon from '../components/BoIcon.vue';
import DetailPanel from './DetailPanel.vue';

defineProps<{
	title?: string | undefined;
	icon?: string | undefined;
	/** Data color of the icon (collection color, Q-C of 013), as an inline style. */
	iconColor?: string | null | undefined;
	/**
	 * Parent pages (DR v-breadcrumb in the `headline` slot). Not shown (D-101, owner 2026-10-17); the pages keep
	 * passing it, so the breadcrumb can come back in one place.
	 */
	breadcrumb?: { name: string; to: RouteLocationRaw }[] | undefined;
	/** Back button before the title (DR `show-back`): a route, or `true` for the browser history. */
	back?: RouteLocationRaw | true | undefined;
}>();

const router = useRouter();
</script>

<template>
	<div data-page-header class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex min-w-0 flex-col gap-1">
			<!-- D-101: no breadcrumb above the title (owner, 2026-10-17); the headline row is left for the extension `headline` slot. -->
			<div v-if="$slots['headline-append']" class="flex flex-wrap items-center gap-2">
				<!-- The DR headline (extension views); the item page version menu is in `title-append` since 2026-10-22. -->
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
				<!-- Spec 020 (Q-45): the DR title slots of extension views; `heading` replaces the h1 (DR `title`). -->
				<slot v-if="!back && !icon" name="title-outer:prepend" />
				<slot name="heading">
					<slot name="title:prepend" />
					<h1 class="m-0 min-w-0 truncate text-xl font-semibold text-gray-800 dark:text-white/90">
						<slot name="title">{{ title }}</slot>
					</h1>
					<slot name="title:append" />
				</slot>
				<slot name="title-append" />
			</div>
		</div>

		<div class="flex shrink-0 items-center gap-3">
			<slot name="actions:prepend" />
			<slot name="actions" />
			<slot name="actions:append" />

			<DetailPanel v-if="$slots['sidebar']"><slot name="sidebar" /></DetailPanel>
		</div>
	</div>
</template>
