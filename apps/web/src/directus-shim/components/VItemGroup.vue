<!-- Ported from directus/app/src/components/v-item-group.vue -->
<script setup lang="ts">
import { useGroupableParent } from '@directus/composables';
import { toRefs } from 'vue';

// Backoffice (spec 020, data-model §7): same groupable parent as DR (scope `item-group` by default).
const props = withDefaults(
	defineProps<{
		mandatory?: boolean | undefined;
		max?: number | undefined;
		multiple?: boolean | undefined;
		modelValue?: (number | string)[] | undefined;
		scope?: string | undefined;
	}>(),
	{
		mandatory: false,
		max: -1,
		multiple: false,
		modelValue: undefined,
		scope: 'item-group',
	},
);

const emit = defineEmits(['update:modelValue']);

const { modelValue: selection, multiple, max, mandatory } = toRefs(props);

useGroupableParent(
	{
		selection,
		onSelectionChange: (newSelectionValues) => emit('update:modelValue', newSelectionValues),
	},
	{ multiple, max, mandatory },
	props.scope,
);
</script>

<template>
	<div class="v-item-group">
		<slot />
	</div>
</template>
