<!-- Ported from directus/app/src/views/private/private-view/components/private-view-nav-project-name.vue -->
<script setup lang="ts">
// Backoffice: `Backoffice` when project_name is empty (FR-026); CSS truncation instead of v-text-overflow; the
// collapse toggle is a labelled button (FR-027).
import { computed } from 'vue';
import BoButton from '../components/BoButton.vue';
import { useServerStore } from '../stores/server.ts';
import { useNavBarStore } from './stores/nav-bar.ts';

const serverStore = useServerStore();

const name = computed(() => serverStore.info?.project?.project_name || 'Backoffice');
const descriptor = computed(() => serverStore.info?.project?.project_descriptor);
const navBarStore = useNavBarStore();
</script>

<template>
	<div class="flex h-eh-12 shrink-0 items-center gap-eh-2 border-b border-eh-border ps-eh-4 pe-eh-1">
		<div class="min-w-0 grow leading-tight">
			<div class="truncate text-eh-sm font-semibold" :title="name">{{ name }}</div>
			<div v-if="descriptor" class="truncate text-eh-xs text-eh-text-secondary" :title="descriptor">
				{{ descriptor }}
			</div>
		</div>

		<BoButton
			variant="ghost"
			icon="left_panel_close"
			:aria-label="$t('toggle_navigation')"
			class="shrink-0"
			@click="navBarStore.collapse"
		/>
	</div>
</template>
