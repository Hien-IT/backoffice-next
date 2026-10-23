<!-- Ported from directus/app/src/components/v-list.vue -->
<script setup lang="ts">
import { useGroupableParent } from '@directus/composables';
import { provide, toRefs } from 'vue';
import { LIST } from './list.ts';

// Backoffice (spec 020, data-model §7): same groupable parent as DR (scope `v-list`); the list provides its
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

// DR v-list.vue:80-83,85: sizing hooks and padding variable (`nav` sets its own).
</script>

<template>
	<ul
		class="v-list flex min-h-(--v-list-min-height,none) max-h-(--v-list-max-height,none) min-w-(--v-list-min-width,12.375rem) max-w-(--v-list-max-width,none) flex-col gap-0.5 overflow-auto"
		:class="nav ? 'p-3' : 'p-(--v-list-padding,0.25rem_0)'"
	>
		<slot />
	</ul>
</template>
