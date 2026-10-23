<!-- Ported from directus/app/src/interfaces/select-color/select-color.vue -->
<script setup lang="ts">
// Backoffice: the picker (hex/RGB/HSL inputs, sliders, native picker, the 9 default presets, low contrast warning,
// `var(--x)` values) is BoColorPicker; this maps `value`/`input`. `width` only laid out the DR inputs grid.
import { inject } from 'vue';
import BoColorPicker from '../../components/BoColorPicker.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';

interface Props {
	disabled?: boolean;
	nonEditable?: boolean;
	value?: string | null;
	placeholder?: string | undefined;
	presets?: { name: string; color: string }[] | undefined;
	width: string;
	opacity?: boolean;
}

withDefaults(defineProps<Props>(), {
	disabled: false,
	nonEditable: false,
	value: null,
	placeholder: undefined,
	presets: undefined,
	opacity: false,
});

const emit = defineEmits(['input']);

// Backoffice: ids and state of the form field (label, note, validation message), FormField.vue.
const a11y = inject(FORM_FIELD_A11Y, null);
</script>

<template>
	<BoColorPicker
		:id="a11y?.inputId"
		:aria-describedby="a11y?.describedBy"
		:invalid="!!a11y?.invalid"
		:model-value="value"
		:disabled="disabled"
		:non-editable="nonEditable"
		:placeholder="placeholder"
		:presets="presets"
		:opacity="opacity"
		@update:model-value="emit('input', $event)"
	/>
</template>
