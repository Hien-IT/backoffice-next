<!-- Ported from directus/app/src/modules/content/routes/not-found.vue; Ported from directus/app/src/modules/files/routes/not-found.vue -->
<script setup lang="ts">
// Backoffice: v-info in the blank page card of the design-system, as PrivateNotFoundRoute. Feature 015 (FR-001,
// FR-054): the same page serves the Files and Users modules, `module` picks the sub-menu (Directus has one not-found
// route per module, with the same content). Feature 016 adds the Settings module, 018 Insights and Activity (Activity has
// no sub-menu until its navigation exists).
import { type Component, defineAsyncComponent } from 'vue';
import BoIcon from '../../../components/BoIcon.vue';
import PrivateView from '../../../layout/PrivateView.vue';
import ContentNavigation from '../components/ContentNavigation.vue';

const { module = 'content' } = defineProps<{
	module?: 'content' | 'files' | 'users' | 'settings' | 'insights' | 'activity';
}>();

const NAVIGATION: Partial<Record<typeof module, Component>> = {
	content: ContentNavigation,
	files: defineAsyncComponent(() => import('../../../components/files/FilesNavigation.vue')),
	users: defineAsyncComponent(() => import('../../users/components/UsersNavigation.vue')),
	settings: defineAsyncComponent(() => import('../../settings/components/SettingsNavigation.vue')),
	insights: defineAsyncComponent(() => import('../../insights/components/InsightsNavigation.vue')),
};
</script>

<template>
	<PrivateView :title="$t('page_not_found')">
		<template v-if="NAVIGATION[module]" #navigation>
			<component :is="NAVIGATION[module]" />
		</template>

		<div
			class="flex flex-col items-center justify-center gap-4 text-center rounded-2xl border border-gray-200 bg-white px-5 py-7 xl:px-10 xl:py-12 dark:border-gray-800 dark:bg-white/[0.03]"
		>
			<span class="text-gray-500 dark:text-gray-400"><BoIcon name="not_interested" size="lg" /></span>
			<h2 class="m-0 text-xl font-semibold text-gray-800 dark:text-white/90">{{ $t('page_not_found') }}</h2>
			<p class="m-0 max-w-md text-gray-500 dark:text-gray-400">{{ $t('page_not_found_body') }}</p>
		</div>
	</PrivateView>
</template>
