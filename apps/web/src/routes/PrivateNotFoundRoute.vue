<!-- Ported from directus/app/src/routes/private-not-found.vue -->
<script setup lang="ts">
// Backoffice: the page title is set by PrivateView (useHead with the title prop); v-info with design-system tokens.
import BoIcon from '../components/BoIcon.vue';
import PrivateView from '../layout/PrivateView.vue';
</script>

<template>
	<PrivateView :title="$t('page_not_found')">
		<div class="flex flex-col items-center justify-center gap-eh-4 px-eh-6 py-[20vh] text-center">
			<span class="text-eh-text-secondary"><BoIcon name="not_interested" size="lg" /></span>
			<h2 class="m-0 text-eh-xl font-semibold">{{ $t('page_not_found') }}</h2>
			<p class="m-0 max-w-md text-eh-text-secondary">{{ $t('page_not_found_body') }}</p>
		</div>
	</PrivateView>
</template>
