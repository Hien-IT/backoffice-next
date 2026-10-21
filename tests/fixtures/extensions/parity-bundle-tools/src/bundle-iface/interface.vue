<template>
	<v-input :model-value="value" data-testid="parity-bundle-input" @update:model-value="$emit('input', $event)" />
</template>

<script setup>
defineProps({ value: { type: String, default: null } });
defineEmits(['input']);
</script>
