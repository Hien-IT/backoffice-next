<script setup lang="ts">
// Backoffice (spec 020, data-model §7): wraps BoCheckboxTree (extended with `search` and `showSelectionOnly`, which
// replace its own search input and "show selected" switch). `group-toggle` gets a GroupableInstance-like
// `{ value, active }` as the VList toggle of Directus. Not honoured: `nonEditable` (a style of the Directus checkboxes)
// and the search highlight of the labels.
import { ref } from 'vue';
import BoCheckboxTree from '../../components/BoCheckboxTree.vue';

withDefaults(
	defineProps<{
		/** The choices that will be rendered as checkboxes */
		choices?: Record<string, any>[];
		/** Which choices should be shown as selected, depending on their value */
		modelValue?: (string | number)[];
		valueCombining?: 'all' | 'branch' | 'leaf' | 'indeterminate' | 'exclusive';
		/** Will highlight every text that matches the given search */
		search?: string | null;
		/** Which key in choices is used to display the text */
		itemText?: string;
		/** Which key in choices is used to model the active state */
		itemValue?: string;
		/** Which key in choices is used to render children */
		itemChildren?: string;
		/** Disables any interaction */
		disabled?: boolean;
		/** Set the non-editable state for the input */
		nonEditable?: boolean;
		/** Show only the selected choices */
		showSelectionOnly?: boolean;
		/** Opens all groups included in the array. `[]` collapses all groups. Ignored if not an array. */
		openGroups?: string[] | null;
	}>(),
	{
		choices: () => [],
		modelValue: () => [],
		valueCombining: 'all',
		search: null,
		itemText: 'text',
		itemValue: 'value',
		itemChildren: 'children',
		disabled: false,
		nonEditable: false,
		showSelectionOnly: false,
	},
);

const emit = defineEmits(['update:modelValue', 'group-toggle']);
</script>

<template>
	<BoCheckboxTree
		:choices
		:model-value
		:value-combining
		:search
		:item-text
		:item-value
		:item-children
		:disabled
		:show-selection-only
		:open-groups="Array.isArray(openGroups) ? openGroups : null"
		@update:model-value="emit('update:modelValue', $event)"
		@group-toggle="emit('group-toggle', { value: $event.value, active: ref($event.open) })"
	/>
</template>
