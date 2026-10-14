<!-- Ported from directus/app/src/routes/logout.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { logout } from '../auth.ts';
import BoProgressCircular from '../components/BoProgressCircular.vue';

onMounted(() => {
	logout();
});
</script>

<template>
	<div
		class="flex h-dvh w-full items-center justify-center bg-white text-3xl text-brand-500 dark:bg-gray-900 dark:text-brand-400"
		aria-busy="true"
	>
		<BoProgressCircular indeterminate :aria-label="$t('loading')" />
	</div>
</template>
