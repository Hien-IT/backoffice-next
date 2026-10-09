<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServerStore } from './stores/server.ts';

const props = defineProps<{ apiUrl: string }>();

const { t } = useI18n();
const server = useServerStore();

const label = computed(() => {
	if (server.status === 'loading' || server.status === 'idle') return t('loading');
	if (server.status === 'success') return t('success');
	return t('unexpected_error');
});

onMounted(() => server.ping(props.apiUrl));
</script>

<template>
	<main class="app">
		<h1>Backoffice</h1>
		<p>
			GET /server/ping · {{ t('status') }}:
			<span :class="['status', server.status]" data-testid="ping-status">{{ label }}</span>
			<code v-if="server.result" data-testid="ping-result">{{ server.result }}</code>
		</p>
		<RouterView />
	</main>
</template>

<style scoped>
.app {
	font-family: system-ui, sans-serif;
	padding: 1rem;
}

.status {
	padding: 0.125rem 0.5rem;
	border-radius: 0.25rem;
	background: #eceff1;
}

.status.success {
	background: #e3f6e8;
	color: #1b5e20;
}

.status.error {
	background: #fde7e7;
	color: #b71c1c;
}
</style>
