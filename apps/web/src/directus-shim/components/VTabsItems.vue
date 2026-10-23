<!-- Ported from directus/app/src/components/v-tabs-items.vue -->
<script setup lang="ts">
import VItemGroup from './VItemGroup.vue';

// Backoffice (spec 020, data-model §7): a VItemGroup with the `v-tabs-items` scope, as in DR.
withDefaults(defineProps<{ modelValue?: (number | string)[] | undefined }>(), { modelValue: undefined });

const emit = defineEmits(['update:modelValue']);
</script>

<template>
	<VItemGroup
		class="v-tabs-items"
		:model-value="modelValue"
		scope="v-tabs-items"
		@update:model-value="emit('update:modelValue', $event)"
	>
		<slot />
	</VItemGroup>
</template>
