<!-- Ported from directus/app/src/routes/private-not-found.vue -->
<script setup lang="ts">
// Backoffice: the page title is set by PrivateView (useHead with the title prop); v-info in the blank page card of the design-system.
import BoIcon from '../components/BoIcon.vue';
import PrivateView from '../layout/PrivateView.vue';
</script>

<template>
	<PrivateView :title="$t('page_not_found')">
		<div
			class="flex flex-col items-center justify-center gap-4 text-center rounded-2xl border border-gray-200 bg-white px-5 py-7 xl:px-10 xl:py-12 dark:border-gray-800 dark:bg-white/[0.03]"
		>
			<span class="text-gray-500 dark:text-gray-400"><BoIcon name="not_interested" size="lg" /></span>
			<h2 class="m-0 text-xl font-semibold text-gray-800 dark:text-white/90">{{ $t('page_not_found') }}</h2>
			<p class="m-0 max-w-md text-gray-500 dark:text-gray-400">{{ $t('page_not_found_body') }}</p>
		</div>
	</PrivateView>
</template>
