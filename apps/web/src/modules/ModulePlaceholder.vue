<script setup lang="ts">
// Frame of a module route in 012 (D-40, FR-023): the private view with the module name and icon, and an empty state
// saying the content comes later. Modules 013-018 replace it with their own routes.
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import BoIcon from '../components/BoIcon.vue';
import PrivateView from '../layout/PrivateView.vue';
import { translate } from '../utils/translate-object-values.ts';
import { getInternalModules } from './index.ts';

const route = useRoute();

const module = computed(() => getInternalModules().find((module) => module.id === route.meta.module));
const title = computed(() => (module.value ? translate({ name: module.value.name }).name : ''));
</script>

<template>
	<PrivateView :title="title" :icon="module?.icon">
		<div class="flex flex-col items-center justify-center gap-eh-4 px-eh-6 py-[20vh] text-center">
			<span class="text-eh-text-secondary"><BoIcon :name="module?.icon ?? 'box'" size="lg" /></span>
			<p class="m-0 max-w-md text-eh-text-secondary">{{ $t('module_placeholder') }}</p>
		</div>
	</PrivateView>
</template>
