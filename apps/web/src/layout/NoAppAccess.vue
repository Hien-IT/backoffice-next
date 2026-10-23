<!-- Ported from directus/app/src/views/private/private-view/components/private-view-no-app-access.vue -->
<script setup lang="ts">
// Backoffice: the v-info layout as a centred full-screen page with the design-system theme (layout-patterns §6); the
// button says sign_out (DR: switch_user) and goes to /logout like DR.
import BoButton from '../components/BoButton.vue';
import BoIcon from '../components/BoIcon.vue';
</script>

<template>
	<main
		id="main-content"
		tabindex="-1"
		class="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center"
	>
		<span class="text-error-600 dark:text-error-400"><BoIcon name="block" size="lg" /></span>
		<h1 class="m-0 text-xl font-semibold text-gray-800 dark:text-white/90">{{ $t('no_app_access') }}</h1>
		<p class="m-0 max-w-md text-gray-500 dark:text-gray-400">{{ $t('no_app_access_copy') }}</p>
		<BoButton to="/logout">{{ $t('sign_out') }}</BoButton>
	</main>
</template>
