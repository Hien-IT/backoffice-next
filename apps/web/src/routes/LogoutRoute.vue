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
	<div class="flex h-dvh w-full items-center justify-center text-eh-3xl text-eh-action-primary" aria-busy="true">
		<BoProgressCircular indeterminate :aria-label="$t('loading')" />
	</div>
</template>
