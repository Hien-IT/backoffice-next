<template>
	<span class="type-note" data-testid="parity-grid-count">{{ itemCount ?? 0 }} items</span>
</template>

<script setup>
defineProps({ itemCount: { type: Number, default: null } });
</script>
