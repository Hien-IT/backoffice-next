<!-- Ported from directus/app/src/views/private/private-view/components/private-view-no-app-access.vue -->
<script setup lang="ts">
// Backoffice: the v-info layout with design-system tokens; the button says sign_out (Directus: switch_user) and
// goes to /logout like Directus.
import BoButton from '../components/BoButton.vue';
import BoIcon from '../components/BoIcon.vue';
</script>

<template>
	<main
		id="main-content"
		tabindex="-1"
		class="flex min-h-dvh flex-col items-center justify-center gap-eh-4 p-eh-8 text-center"
	>
		<span class="text-eh-status-danger"><BoIcon name="block" size="lg" /></span>
		<h1 class="m-0 text-eh-xl font-semibold">{{ $t('no_app_access') }}</h1>
		<p class="m-0 max-w-md text-eh-text-secondary">{{ $t('no_app_access_copy') }}</p>
		<BoButton to="/logout">{{ $t('sign_out') }}</BoButton>
	</main>
</template>
