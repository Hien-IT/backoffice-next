<!-- Ported from directus/app/src/interfaces/select-multiple-checkbox/select-multiple-checkbox.vue -->
<script setup lang="ts">
// Backoffice: the VCheckbox list, VDetail "show more" and the custom value rows (useCustomSelectionMultiple) are
// BoCheckboxGroup (CheckboxGroup recipe). nonEditable: every choice and the custom values show as plain disabled
// checkboxes, without "show more", "add other" or remove buttons (DR hides them). `color` defaults to the theme
// brand color instead of `var(--theme--primary)`; the default iconOn/iconOff draw the recipe box, other icons are shown.
import { computed, inject, toRefs, useId } from 'vue';
import BoCheckboxGroup from '../../components/BoCheckboxGroup.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { getMinimalGridClass } from '../../utils/get-minimal-grid-class.ts';

type Option = {
	text: string;
	value: string | number | boolean;
	disabled?: boolean;
};

const props = withDefaults(
	defineProps<{
		value: string[] | null;
		disabled?: boolean;
		nonEditable?: boolean;
		choices: Option[];
		allowOther?: boolean;
		width?: string | undefined;
		iconOn?: string;
		iconOff?: string;
		color?: string | undefined;
		itemsShown?: number;
	}>(),
	{
		disabled: false,
		nonEditable: false,
		allowOther: false,
		width: undefined,
		iconOn: 'check_box',
		iconOff: 'check_box_outline_blank',
		color: undefined,
		itemsShown: 8,
	},
);

const emit = defineEmits(['input']);

// Backoffice: ids and state of the form field (label, note, validation message), FormField.vue.
const a11y = inject(FORM_FIELD_A11Y, null);
const fallbackId = useId();
const fieldId = computed(() => a11y?.value.inputId ?? fallbackId);
const invalid = computed(() => a11y?.value.invalid ?? false);

const { choices } = toRefs(props);

const items = computed(() => choices.value || []);

const gridClass = computed(() => getMinimalGridClass(items.value, props.width));

const columns = computed(() => Number(gridClass.value?.slice('grid-'.length) ?? 1) as 1 | 2 | 3 | 4);

const customIcons = computed(() => props.iconOn !== 'check_box' || props.iconOff !== 'check_box_outline_blank');

const groupItems = computed(() => {
	// Backoffice: BoCheckboxGroup takes string and number values (boolean choice values are not supported).
	const list = items.value as (Option & { value: string | number })[];
	if (!props.nonEditable || !props.allowOther) return list;
	const custom = (props.value ?? []).filter((val) => !list.some((item) => item.value === val));
	return [...list, ...custom.map((val) => ({ text: val, value: val }))];
});
</script>

<template>
	<div role="group" :aria-labelledby="a11y?.labelId" :aria-describedby="a11y?.describedBy">
		<BoCheckboxGroup
			:id="fieldId"
			:model-value="value"
			:items="groupItems"
			:columns="columns"
			:items-shown="nonEditable ? Infinity : itemsShown"
			:allow-other="allowOther && !nonEditable"
			:color="color ?? ''"
			v-bind="customIcons ? { iconOn, iconOff } : {}"
			:disabled="disabled"
			:invalid="invalid"
			@update:model-value="emit('input', $event)"
		/>
	</div>
</template>
