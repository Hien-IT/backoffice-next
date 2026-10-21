<template>
	<div class="form-grid">
		<div class="field full">
			<div class="type-label">Collection</div>
			<v-input :model-value="value?.collection" data-testid="parity-counter-collection" @update:model-value="update" />
		</div>
	</div>
</template>

<script setup>
const props = defineProps({ value: { type: Object, default: null } });
const emit = defineEmits(['input']);

function update(collection) {
	emit('input', { ...(props.value ?? {}), collection });
}
</script>
