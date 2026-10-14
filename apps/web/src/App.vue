<script setup lang="ts">
// Shell of directus/app/src/app.vue: hydrating screen, unexpected error screen, routes. Head, theme and branding
// come with the layout (tasks T039).
import { computed } from 'vue';
import BoButton from './components/BoButton.vue';
import BoNotice from './components/BoNotice.vue';
import BoProgressCircular from './components/BoProgressCircular.vue';
import { useAppStore } from './stores/app.ts';

const appStore = useAppStore();

const errorMessage = computed(() => {
	const error = appStore.error as { message?: string; errors?: { message?: string }[] } | null;
	return error?.errors?.[0]?.message ?? error?.message ?? String(error);
});

function reload() {
	globalThis.location.reload();
}
</script>

<template>
	<div v-if="appStore.hydrating" class="fixed inset-0 grid place-items-center bg-eh-surface-default">
		<BoProgressCircular indeterminate :aria-label="$t('loading')" />
	</div>

	<main v-if="appStore.error" class="mx-auto grid max-w-xl gap-eh-4 p-eh-8">
		<BoNotice type="danger">
			<strong>{{ $t('unexpected_error') }}</strong>
			{{ $t('unexpected_error_copy') }}
		</BoNotice>
		<pre class="overflow-auto rounded-eh-md bg-eh-surface-subtle p-eh-3 text-eh-sm" data-testid="app-error">{{
			errorMessage
		}}</pre>
		<div>
			<BoButton @click="reload">{{ $t('reload_page') }}</BoButton>
		</div>
	</main>

	<RouterView v-else />
</template>
