<script setup lang="ts">
import BoIcon from './BoIcon.vue';

const { type = 'info' } = defineProps<{ type?: 'info' | 'success' | 'warning' | 'danger' }>();

// Icons as v-notice of Directus; status color on border and icon only, the text stays text-primary (spec Q-8).
const TYPES = {
	info: { icon: 'info', color: 'border-eh-action-primary text-eh-action-primary' },
	success: { icon: 'check_circle', color: 'border-eh-status-success text-eh-status-success' },
	warning: { icon: 'warning', color: 'border-eh-status-warning text-eh-status-warning' },
	danger: { icon: 'error', color: 'border-eh-status-danger text-eh-status-danger' },
};
</script>

<template>
	<div
		:role="type === 'danger' ? 'alert' : 'status'"
		class="flex items-start gap-eh-2 rounded-eh-md border border-l-4 bg-eh-surface-subtle p-eh-3"
		:class="TYPES[type].color"
	>
		<BoIcon :name="TYPES[type].icon" />
		<div class="min-w-0 flex-1 self-center text-eh-sm text-eh-text-primary"><slot /></div>
	</div>
</template>
