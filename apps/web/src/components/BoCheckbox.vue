<!-- Ported from directus/app/src/components/v-checkbox.vue -->
<script setup lang="ts">
// Backoffice: boolean checkbox only (the Directus array mode, custom value and block style belong to the choice
// interfaces, Tier 3 CheckboxGroup); markup is the Tier 1 Checkbox recipe on Reka CheckboxRoot. As in Directus a
// `null` modelValue shows the indeterminate state.
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui';
import { computed, useId } from 'vue';
import BoIcon from './BoIcon.vue';

// Extra attributes (aria-label, aria-labelledby...) go to the checkbox button, not the wrapper.
defineOptions({ inheritAttrs: false });

const {
	modelValue = null,
	indeterminate = false,
	disabled = false,
	invalid = false,
	id: idProp,
	icon,
} = defineProps<{
	modelValue?: boolean | null | undefined;
	/** Renders the checkbox neither selected nor unselected */
	indeterminate?: boolean | undefined;
	label?: string | null | undefined;
	disabled?: boolean | undefined;
	invalid?: boolean | undefined;
	id?: string | undefined;
	/** Material Symbols name drawn instead of the box (Directus v-checkbox custom iconOn / iconOff / iconIndeterminate,
	 * CheckboxGroup recipe); the caller picks the name of the current state. */
	icon?: string | undefined;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: boolean]; 'update:indeterminate': [value: boolean] }>();

const id = idProp ?? useId();

const state = computed<boolean | 'indeterminate'>(() =>
	indeterminate || modelValue === null ? 'indeterminate' : modelValue,
);

function toggleInput(value: boolean | 'indeterminate') {
	if (disabled) return;
	if (indeterminate === true) emit('update:indeterminate', false);
	emit('update:modelValue', value === true);
}

const FOCUS = computed(() =>
	invalid
		? 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400'
		: 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400',
);
const BOX =
	'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.25px] bg-transparent data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500 data-[state=indeterminate]:border-brand-500 data-[state=indeterminate]:bg-brand-500 data-[disabled]:border-gray-200 data-[disabled]:bg-transparent dark:data-[disabled]:border-gray-800';
const BOX_VALID = 'border-gray-300 hover:border-brand-500 dark:border-gray-700 dark:hover:border-brand-400';
const BOX_INVALID = 'border-error-600 dark:border-error-400';
// CheckboxGroup recipe for custom icons: the icon only, brand when checked.
const ICON =
	'inline-flex shrink-0 items-center justify-center rounded-md text-gray-500 data-[state=checked]:text-brand-500 data-[state=indeterminate]:text-brand-500 data-[disabled]:text-gray-300 dark:text-gray-400 dark:data-[state=checked]:text-brand-400 dark:data-[state=indeterminate]:text-brand-400 dark:data-[disabled]:text-gray-700';
</script>

<template>
	<span
		class="inline-flex items-center gap-3 text-sm font-normal select-none"
		:class="disabled ? 'text-gray-300 dark:text-gray-700' : 'cursor-pointer text-gray-700 dark:text-gray-300'"
	>
		<CheckboxRoot
			v-bind="$attrs"
			:id="id"
			:model-value="state"
			:disabled="disabled"
			:aria-invalid="invalid ? 'true' : undefined"
			:class="[
				FOCUS,
				icon ? [ICON, invalid && 'text-error-600 dark:text-error-400'] : [BOX, invalid ? BOX_INVALID : BOX_VALID],
			]"
			@update:model-value="toggleInput"
		>
			<BoIcon v-if="icon" :name="icon" />
			<CheckboxIndicator
				v-else
				class="flex text-white data-[disabled]:text-gray-200 dark:data-[disabled]:text-gray-800"
			>
				<BoIcon :name="state === 'indeterminate' ? 'remove' : 'check'" size="sm" />
			</CheckboxIndicator>
		</CheckboxRoot>
		<label v-if="label || $slots['default']" :for="id" :class="{ 'cursor-pointer': !disabled }">
			<slot>{{ label }}</slot>
		</label>
	</span>
</template>
