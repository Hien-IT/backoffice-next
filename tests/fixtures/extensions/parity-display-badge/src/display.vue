<template>
	<v-chip small class="parity-display-badge" data-testid="parity-badge">
		<v-icon name="label" small left />
		{{ value ?? '--' }}
	</v-chip>
</template>

<script setup>
defineProps({ value: { type: [String, Number], default: null } });
</script>
