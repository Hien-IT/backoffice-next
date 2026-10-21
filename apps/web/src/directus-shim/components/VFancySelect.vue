<!-- Ported from directus/app/src/components/v-fancy-select.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): wraps BoFancySelect (list layout); the `itemText`, `itemValue` and
// `itemDescription` keys are mapped to its `text`, `value` and `description`. `{ divider: true }` items pass as they are.
import { computed } from 'vue';
import BoFancySelect, { type FancySelectItem } from '../../components/BoFancySelect.vue';

const props = withDefaults(
	defineProps<{
		items: FancySelectItem[];
		modelValue?: string | number | null;
		disabled?: boolean;
		itemText?: string;
		itemValue?: string;
		itemDescription?: string;
	}>(),
	{
		modelValue: null,
		disabled: false,
		itemText: 'text',
		itemValue: 'value',
		itemDescription: 'description',
	},
);

defineEmits(['update:modelValue']);

const mapped = computed(() =>
	props.items.map((item) =>
		item['divider'] === true
			? item
			: {
					...item,
					text: item[props.itemText],
					value: item[props.itemValue],
					description: item[props.itemDescription],
				},
	),
);
</script>

<template>
	<BoFancySelect
		class="v-fancy-select"
		:items="mapped as FancySelectItem[]"
		:model-value="modelValue"
		:disabled="disabled"
		@update:model-value="$emit('update:modelValue', $event)"
	/>
</template>
