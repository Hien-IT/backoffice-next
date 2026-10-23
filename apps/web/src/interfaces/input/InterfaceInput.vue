<!-- Ported from directus/app/src/interfaces/input/input.vue -->
<script setup lang="ts">
// Backoffice: VInput is InputField.vue (port of v-input.vue); `font` maps to the theme font classes (BoTextarea);
// the remaining-characters counter keeps the DR thresholds (shown when focused, warning < 10 %, danger < 5 %).
import { computed } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import { APP_NUMERIC_TYPES } from '../../constants.ts';
import InputField from './InputField.vue';

// Backoffice: the other form props (collection, fieldData, width...) are not passed on to the <input>.
defineOptions({ inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		value: string | number | null;
		type?: string | undefined;
		clear?: boolean | undefined;
		disabled?: boolean | undefined;
		nonEditable?: boolean | undefined;
		placeholder?: string | undefined;
		masked?: boolean | undefined;
		iconLeft?: string | undefined;
		iconRight?: string | undefined;
		trim?: boolean | undefined;
		font?: 'sans-serif' | 'serif' | 'monospace';
		length?: number | null | undefined;
		softLength?: number | undefined;
		dbSafe?: boolean | undefined;
		autofocus?: boolean | undefined;
		slug?: boolean | undefined;
		min?: number | undefined;
		max?: number | undefined;
		step?: number;
		direction?: string | undefined;
	}>(),
	{
		font: 'sans-serif',
		step: 1,
	},
);

defineEmits(['input']);

const charsRemaining = computed(() => {
	if (typeof props.value === 'number') return null;

	if (!props.length && !props.softLength) return null;
	if (!props.value && !props.softLength) return null;
	if (!props.value && props.softLength) return props.softLength;
	if (props.softLength) return +props.softLength - props.value!.length;
	if (props.length) return +props.length - props.value!.length;
	return null;
});

const percentageRemaining = computed(() => {
	if (typeof props.value === 'number') return null;

	if (!props.length && !props.softLength) return null;
	if (!props.value) return 100;

	if (props.softLength) return 100 - (props.value.length / +props.softLength) * 100;
	if (props.length) return 100 - (props.value.length / +props.length) * 100;

	return 100;
});

const inputType = computed(() => {
	if (props.masked) return 'password';
	if (APP_NUMERIC_TYPES.includes(props.type!)) return 'number';
	return 'text';
});

const isInteger = computed(() => ['bigInteger', 'integer'].includes(props.type!));
const isFloat = computed(() => ['float', 'decimal'].includes(props.type!));

// shortcut: the theme only defines font-outfit; serif and monospace use generic system stacks (as BoTextarea) until
// the design-system adds font tokens for them.
const FONTS = {
	'sans-serif': 'font-outfit',
	serif: 'font-[family-name:ui-serif,Georgia,serif]',
	monospace: 'font-[family-name:ui-monospace,SFMono-Regular,Menlo,monospace]',
};
</script>

<template>
	<InputField
		class="group/input"
		:autofocus="autofocus"
		:model-value="value"
		:nullable="!clear"
		:placeholder="placeholder"
		:disabled="disabled"
		:non-editable="nonEditable"
		:trim="trim"
		:type="inputType"
		:class="FONTS[font]"
		:data-font="font"
		:db-safe="dbSafe"
		:slug="slug"
		:min="min"
		:max="max"
		:max-length="length ?? undefined"
		:step="step"
		:dir="direction"
		:integer="isInteger"
		:float="isFloat"
		:autocomplete="masked ? 'new-password' : 'off'"
		@update:model-value="$emit('input', $event)"
	>
		<template v-if="iconLeft" #prepend><BoIcon data-icon-left :name="iconLeft" /></template>
		<template v-if="(percentageRemaining !== null && percentageRemaining <= 20) || iconRight || softLength" #append>
			<span
				v-if="(percentageRemaining !== null && percentageRemaining <= 20) || softLength"
				data-remaining
				class="hidden w-[1.375rem] text-end font-semibold tabular-nums group-focus-within/input:block"
				:class="
					percentageRemaining! < 5
						? 'text-error-600 dark:text-error-400'
						: percentageRemaining! < 10
							? 'text-warning-700 dark:text-warning-400'
							: 'text-gray-500 dark:text-gray-400'
				"
			>
				{{ charsRemaining }}
			</span>
			<BoIcon
				v-if="iconRight"
				data-icon-right
				:class="{ 'group-focus-within/input:hidden': percentageRemaining && percentageRemaining <= 20 }"
				:name="iconRight"
			/>
		</template>
	</InputField>
</template>
