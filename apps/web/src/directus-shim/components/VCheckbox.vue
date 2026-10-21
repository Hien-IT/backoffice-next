<!-- Ported from directus/app/src/components/v-checkbox.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): wraps BoCheckbox (extended with `icon` for custom iconOn/iconOff/
// iconIndeterminate). The Directus logic (array model with `value`, `checked`, indeterminate when the model is null,
// toggleInput) runs here; BoCheckbox only reports the click. `customValue` puts a text input (v-model `value`) in place
// of the label, the checkbox then gets that text (or "Other") as its name. The attrs go to the checkbox,
// `class`/`style` to the root. Not honoured: the greyless look of `nonEditable` (a disabled checkbox stays greyed).
import { useSync } from '@directus/composables';
import { omit } from 'lodash-es';
import { computed, onMounted, useAttrs, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import BoCheckbox from '../../components/BoCheckbox.vue';

defineOptions({ inheritAttrs: false });

interface Props {
	/** If the `modelValue` is an array of strings, activates the checkbox if the value is inside it */
	value?: string | null;
	/** Used to model the active state */
	modelValue?: boolean | string[] | null;
	/** Label for the checkbox */
	label?: string | null;
	/** Disable the checkbox */
	disabled?: boolean;
	/** Set the non-editable state for the checkbox */
	nonEditable?: boolean;
	/** Renders the checkbox neither selected nor unselected */
	indeterminate?: boolean;
	/** What icon to use for the on state */
	iconOn?: string;
	/** What icon to use for the off state */
	iconOff?: string;
	/** What icon to use for the indeterminate state */
	iconIndeterminate?: string;
	/** Show as styled block. Matches input size */
	block?: boolean;
	/** If a custom value can be entered next to it */
	customValue?: boolean;
	/** Will focus the custom value input on mounted */
	autofocusCustomInput?: boolean;
	/** Overrides the checked state computed from the model */
	checked?: boolean | null;
}

const props = withDefaults(defineProps<Props>(), {
	value: null,
	modelValue: null,
	label: null,
	disabled: false,
	nonEditable: false,
	indeterminate: false,
	iconOn: 'check_box',
	iconOff: 'check_box_outline_blank',
	iconIndeterminate: 'indeterminate_check_box',
	block: false,
	customValue: false,
	checked: null,
});

const emit = defineEmits(['update:indeterminate', 'update:modelValue', 'update:value', 'blur:custom-input']);

const { t } = useI18n();

const attrs = useAttrs();
const checkboxAttrs = computed(() => omit(attrs, ['class', 'style']));

const internalValue = useSync(props, 'value', emit);

const isChecked = computed<boolean>(() => {
	if (props.checked !== null) return props.checked;

	if (props.modelValue instanceof Array) {
		if (!props.value) return false;
		return props.modelValue.includes(props.value);
	}

	return props.modelValue === true;
});

const isIndeterminate = computed(
	() => props.indeterminate === true || (props.checked === null && props.modelValue === null),
);

const icon = computed<string>(() => {
	if (isIndeterminate.value) return props.iconIndeterminate;
	return isChecked.value ? props.iconOn : props.iconOff;
});

// The Directus defaults are the box of the Checkbox recipe; other icons are drawn as they are.
const customIcons = computed(
	() =>
		props.iconOn !== 'check_box' ||
		props.iconOff !== 'check_box_outline_blank' ||
		props.iconIndeterminate !== 'indeterminate_check_box',
);

const customInput = useTemplateRef<HTMLInputElement>('custom-input');

onMounted(() => {
	if (props.autofocusCustomInput && props.customValue) {
		customInput.value?.focus();
	}
});

function toggleInput(): void {
	if (props.disabled) return;

	if (props.indeterminate === true) {
		emit('update:indeterminate', false);
	}

	if (props.modelValue instanceof Array) {
		if (props.value) {
			const newValue = [...props.modelValue];

			if (!props.modelValue.includes(props.value)) {
				newValue.push(props.value);
			} else {
				newValue.splice(newValue.indexOf(props.value), 1);
			}

			emit('update:modelValue', newValue);
		}
	} else {
		emit('update:modelValue', !props.modelValue);
	}
}

const FIELD =
	'h-9 min-w-0 flex-1 rounded-lg border border-gray-500 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-500 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 dark:focus:border-brand-400 dark:focus-visible:outline-brand-400 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03]';
const BLOCK = 'h-11 w-full rounded-lg border border-gray-200 px-4 dark:border-gray-800';
</script>

<template>
	<span
		class="v-checkbox inline-flex items-center gap-3"
		:class="[block && BLOCK, $attrs['class']]"
		:style="$attrs['style'] as string"
		@click.stop
	>
		<span v-if="$slots['prepend']" class="flex shrink-0 items-center"><slot name="prepend" /></span>
		<BoCheckbox
			v-bind="checkboxAttrs"
			:model-value="isChecked"
			:indeterminate="isIndeterminate"
			:disabled
			:icon="customIcons ? icon : undefined"
			:label="customValue ? undefined : label"
			:aria-label="customValue ? internalValue || t('other') : $attrs['aria-label']"
			@update:model-value="toggleInput"
		>
			<template v-if="!customValue && $slots['default']" #default><slot /></template>
		</BoCheckbox>
		<input
			v-if="customValue"
			ref="custom-input"
			v-model="internalValue"
			type="text"
			:aria-label="t('other')"
			:class="FIELD"
			:disabled
			@click.stop
			@blur="emit('blur:custom-input')"
		/>
		<span v-if="$slots['append']" class="ms-auto flex shrink-0 items-center"><slot name="append" /></span>
	</span>
</template>
