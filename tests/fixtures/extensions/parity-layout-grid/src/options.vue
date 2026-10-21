<template>
	<div class="field">
		<div class="type-label">Limit</div>
		<v-input
			:model-value="limit"
			type="number"
			@update:model-value="$emit('update:layoutOptions', { limit: Number($event) })"
		/>
	</div>
</template>

<script setup>
defineProps({ limit: { type: Number, default: 10 } });
defineEmits(['update:layoutOptions']);
</script>
