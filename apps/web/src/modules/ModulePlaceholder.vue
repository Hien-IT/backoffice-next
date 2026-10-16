<script setup lang="ts">
// Frame of a module route in 012 (D-40, FR-023): the private view with the module name and icon, and an empty state
// saying the content comes later, in the blank page card of the design-system (component-specs Card). Modules 013-018 replace it with their own routes.
// Feature 016: the Settings routes that still show the frame (flows until 017, D-92) keep the Settings sub-menu.
import { computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import BoIcon from '../components/BoIcon.vue';
import PrivateView from '../layout/PrivateView.vue';
import { translate } from '../utils/translate-object-values.ts';
import { getInternalModules } from './index.ts';

const route = useRoute();

const module = computed(() => getInternalModules().find((module) => module.id === route.meta.module));
const title = computed(() => (module.value ? translate({ name: module.value.name }).name : ''));

const NAVIGATION: Record<string, ReturnType<typeof defineAsyncComponent>> = {
	settings: defineAsyncComponent(() => import('./settings/components/SettingsNavigation.vue')),
};
</script>

<template>
	<PrivateView :title="title" :icon="module?.icon">
		<template v-if="NAVIGATION[module?.id ?? '']" #navigation>
			<component :is="NAVIGATION[module!.id]" />
		</template>

		<div
			class="flex flex-col items-center justify-center gap-4 text-center rounded-2xl border border-gray-200 bg-white px-5 py-7 xl:px-10 xl:py-12 dark:border-gray-800 dark:bg-white/[0.03]"
		>
			<span class="text-gray-500 dark:text-gray-400"><BoIcon :name="module?.icon ?? 'box'" size="lg" /></span>
			<p class="m-0 max-w-md text-gray-500 dark:text-gray-400">{{ $t('module_placeholder') }}</p>
		</div>
	</PrivateView>
</template>
