<!-- Ported from directus/app/src/components/v-list.vue -->
<script setup lang="ts">
import { useGroupableParent } from '@directus/composables';
import { provide, toRefs } from 'vue';
import { LIST } from './list.ts';

// Backoffice (spec 020, data-model §7): same groupable parent as Directus (scope `v-list`); the list provides its
// `dense` / `nav` to the items, styled with the design-system menu item recipe.
const props = withDefaults(
	defineProps<{
		modelValue?: (string | number)[] | undefined;
		nav?: boolean | undefined;
		dense?: boolean | undefined;
		multiple?: boolean | undefined;
		mandatory?: boolean | undefined;
		scope?: string | undefined;
	}>(),
	{
		modelValue: undefined,
		nav: false,
		dense: false,
		multiple: true,
		mandatory: true,
		scope: 'v-list',
	},
);

const emit = defineEmits(['update:modelValue', 'toggle']);

const { modelValue, multiple, mandatory, dense, nav } = toRefs(props);

provide(LIST, { dense, nav });

useGroupableParent(
	{
		selection: modelValue,
		onSelectionChange: (newSelection) => emit('update:modelValue', newSelection),
		onToggle: (item) => emit('toggle', item),
	},
	{ mandatory, multiple },
	props.scope,
);
</script>

<template>
	<ul class="v-list flex flex-col gap-0.5 overflow-auto" :class="nav ? 'p-3' : 'py-1'">
		<slot />
	</ul>
</template>
