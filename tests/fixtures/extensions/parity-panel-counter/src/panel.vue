<template>
	<div class="parity-panel-counter" data-testid="parity-counter">
		<v-progress-circular v-if="!data" indeterminate />
		<span v-else class="type-title">{{ count }}</span>
	</div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ data: { type: [Array, Object], default: null } });

const count = computed(() => {
	const row = Array.isArray(props.data) ? props.data[0] : props.data;
	return row?.count?.['*'] ?? row?.count ?? 0;
});
</script>
