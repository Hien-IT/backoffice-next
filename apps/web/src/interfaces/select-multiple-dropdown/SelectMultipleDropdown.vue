<!-- Ported from directus/app/src/interfaces/select-multiple-dropdown/select-multiple-dropdown.vue -->
<script setup lang="ts">
// Backoffice: VSelect multiple is BoMultiSelect (MultiSelect recipe).
import { sortBy } from 'lodash-es';
import { computed, inject } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import BoMultiSelect, { type MultiSelectDivider } from '../../components/BoMultiSelect.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';

type Option = {
	text: string;
	value: string | number | boolean;
};

const props = withDefaults(
	defineProps<{
		value?: string[] | null | undefined;
		disabled?: boolean;
		nonEditable?: boolean;
		choices?: Option[] | undefined;
		icon?: string | undefined;
		allowNone?: boolean;
		placeholder?: string | undefined;
		allowOther?: boolean;
		previewThreshold?: number;
	}>(),
	{
		value: undefined,
		disabled: false,
		nonEditable: false,
		choices: undefined,
		icon: undefined,
		allowNone: false,
		placeholder: undefined,
		allowOther: false,
		previewThreshold: 3,
	},
);

const emit = defineEmits(['input']);

// Backoffice: ids and state of the form field (label, note, validation message), FormField.vue.
const a11y = inject(FORM_FIELD_A11Y, null);

// Backoffice: BoMultiSelect takes string and number values (boolean choice values are not supported).
// Like DR v-select, a string choice is its own text and value (the flow trigger scopes are plain strings); a
// `{ divider: true }` entry is a separator row.
const items = computed(() =>
	((props.choices || []) as (Option | string | MultiSelectDivider)[]).map((choice) =>
		typeof choice === 'string' ? { text: choice, value: choice } : choice,
	) as ((Option & { value: string | number }) | MultiSelectDivider)[],
);

function updateValue(value: string[]) {
	const sortedValue = sortBy(value, (val) => {
		const sortIndex = items.value!.findIndex((item) => 'value' in item && val === item.value);
		return sortIndex !== -1 ? sortIndex : value.length;
	});

	emit('input', sortedValue);
}
</script>

<template>
	<BoMultiSelect
		:id="a11y?.inputId"
		:aria-labelledby="a11y?.labelId"
		:aria-describedby="a11y?.describedBy"
		:invalid="!!a11y?.invalid"
		:model-value="value ?? null"
		:items="items"
		:disabled="disabled"
		:non-editable="nonEditable"
		:allow-none="allowNone"
		:placeholder="placeholder ?? ''"
		:allow-other="allowOther"
		:preview-threshold="previewThreshold"
		@update:model-value="updateValue($event as string[])"
	>
		<template v-if="icon" #prepend>
			<BoIcon :name="icon" size="sm" />
		</template>
	</BoMultiSelect>
</template>
