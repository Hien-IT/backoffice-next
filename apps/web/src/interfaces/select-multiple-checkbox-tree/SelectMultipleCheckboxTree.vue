<!-- Ported from directus/app/src/interfaces/select-multiple-checkbox-tree/select-multiple-checkbox-tree.vue -->
<script setup lang="ts">
// Backoffice: the search input (more than 10 roots, 250 ms debounce), the tree and the "show selected" toggle are all
// in BoCheckboxTree (CheckboxTree recipe), which also shows "No options available" for empty choices.
import { computed, inject, toRefs, useId } from 'vue';
import BoCheckboxTree from '../../components/BoCheckboxTree.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';

export type Choice = {
	text: string;
	value: string | number;
	children?: Choice[];
};

const props = withDefaults(
	defineProps<{
		value?: string[] | null;
		disabled?: boolean;
		nonEditable?: boolean;
		choices?: Choice[];
		valueCombining?: 'all' | 'branch' | 'leaf' | 'indeterminate' | 'exclusive';
	}>(),
	{
		value: () => [],
		disabled: false,
		nonEditable: false,
		choices: () => [],
		valueCombining: 'all',
	},
);

defineEmits(['input']);

// Backoffice: ids and state of the form field (label, note, validation message), FormField.vue.
const a11y = inject(FORM_FIELD_A11Y, null);
const fallbackId = useId();
const fieldId = computed(() => a11y?.value.inputId ?? fallbackId);
const invalid = computed(() => a11y?.value.invalid ?? false);

const { choices } = toRefs(props);
const items = computed(() => choices.value || []);
</script>

<template>
	<div role="group" :aria-labelledby="a11y?.labelId" :aria-describedby="a11y?.describedBy">
		<BoCheckboxTree
			:id="fieldId"
			:model-value="value"
			:disabled="disabled"
			:invalid="invalid"
			:choices="items"
			:value-combining="valueCombining"
			scroll
			@update:model-value="$emit('input', $event)"
		/>
	</div>
</template>
