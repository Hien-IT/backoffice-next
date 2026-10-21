<!-- Ported from directus/app/src/views/shared/shared-view.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7, Q-45): the Directus shared view of extensions on the public layout of 012, like
// the share page (routes/SharedRoute.vue): the layout shows the project logo and name, then the `title` row. `inline`
// (the compact Directus card) keeps the default column; otherwise the 48.125rem Directus container, scrolling wide content.
import LayoutPublicView from '../../layout/PublicView.vue';

defineProps<{
	title?: string;
	inline?: boolean;
}>();
</script>

<template>
	<LayoutPublicView :shared="!inline">
		<slot name="title">
			<h1 class="type-title mb-5 sm:mb-8">{{ title ?? $t('share_access_page') }}</h1>
		</slot>
		<slot />
	</LayoutPublicView>
</template>
