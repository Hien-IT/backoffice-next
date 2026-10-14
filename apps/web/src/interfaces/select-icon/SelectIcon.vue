<!-- Ported from directus/app/src/interfaces/select-icon/select-icon.vue -->
<script setup lang="ts">
// Backoffice: the picker (icons.json groups + Social, search, virtual scroller) is BoIconPicker; this maps `value`/`input`.
import { inject } from 'vue';
import BoIconPicker from '../../components/BoIconPicker.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';

withDefaults(
	defineProps<{
		value: string | null;
		disabled?: boolean;
		nonEditable?: boolean;
		width?: string;
	}>(),
	{
		disabled: false,
		nonEditable: false,
		width: 'half',
	},
);

const emit = defineEmits(['input']);

// Backoffice: ids and state of the form field (label, note, validation message), FormField.vue.
const a11y = inject(FORM_FIELD_A11Y, null);
</script>

<template>
	<BoIconPicker
		:id="a11y?.inputId"
		:aria-labelledby="a11y?.labelId"
		:aria-describedby="a11y?.describedBy"
		:invalid="!!a11y?.invalid"
		:model-value="value"
		:disabled="disabled"
		:non-editable="nonEditable"
		@update:model-value="emit('input', $event)"
	/>
</template>
