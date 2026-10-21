<!-- Ported from directus/app/src/components/v-radio.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): one radio (BoRadio is a whole group), drawn with the Radio recipe item; custom
// `iconOn`/`iconOff` draw the icon only (Radio recipe). Directus renders a button with aria-pressed; here the button has
// role=radio + aria-checked, its text is the label. `block` is the bordered row of the input height; `nonEditable`
// keeps a disabled radio from being greyed.
import { computed } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import { FOCUS } from './list.ts';

interface Props {
	/** What value to represent when selected */
	value: string | number | null;
	/** If `value` and `modelValue` match, the radio is selected */
	modelValue?: string | number | null;
	/** Label to render next to the radio */
	label?: string | null;
	/** Disable the radio button */
	disabled?: boolean;
	/** Set the non-editable state for the radio */
	nonEditable?: boolean;
	/** Change the icon to display when enabled */
	iconOn?: string;
	/** Change the icon to display when disabled */
	iconOff?: string;
	/** Render the radio in a block like style */
	block?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: null,
	label: null,
	disabled: false,
	nonEditable: false,
	iconOn: 'radio_button_checked',
	iconOff: 'radio_button_unchecked',
	block: false,
});

const emit = defineEmits(['update:modelValue']);

const isChecked = computed<boolean>(() => props.modelValue === props.value);

const customIcons = computed(
	() => props.iconOn !== 'radio_button_checked' || props.iconOff !== 'radio_button_unchecked',
);

const greyed = computed(() => props.disabled && !props.nonEditable);

function emitValue(): void {
	emit('update:modelValue', props.value);
}

const ITEM = 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.25px]';
const BLOCK = 'h-11 w-full rounded-lg border border-gray-200 px-4 dark:border-gray-800';
</script>

<template>
	<button
		type="button"
		role="radio"
		:aria-checked="isChecked ? 'true' : 'false'"
		:disabled="disabled"
		class="v-radio group inline-flex items-center gap-3 text-start text-sm font-normal select-none"
		:class="[
			FOCUS,
			block ? BLOCK : 'rounded-lg',
			greyed ? 'cursor-not-allowed text-gray-300 dark:text-gray-700' : 'text-gray-700 dark:text-gray-300',
			{ 'cursor-pointer': !disabled, 'cursor-default': nonEditable },
		]"
		@click="emitValue"
	>
		<BoIcon
			v-if="customIcons"
			:name="isChecked ? iconOn : iconOff"
			:class="greyed ? '' : isChecked ? 'text-brand-500 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400'"
		/>
		<span
			v-else
			aria-hidden="true"
			:class="[
				ITEM,
				greyed
					? 'border-gray-200 dark:border-gray-800'
					: isChecked
						? 'border-brand-500 bg-brand-500'
						: 'border-gray-500 group-hover:border-brand-500 dark:border-gray-500 dark:group-hover:border-brand-400',
			]"
		>
			<span
				v-if="isChecked"
				class="block h-2 w-2 rounded-full"
				:class="greyed ? 'bg-gray-300 dark:bg-gray-700' : 'bg-white'"
			/>
		</span>
		<span class="min-w-0 truncate">
			<slot name="label">{{ label }}</slot>
		</span>
	</button>
</template>
