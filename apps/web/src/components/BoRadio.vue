<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui';
import { useId } from 'vue';
import BoIcon from './BoIcon.vue';

export type RadioItem = { text: string; value: string | number; disabled?: boolean };

const {
	items,
	columns = 1,
	disabled = false,
	invalid = false,
	required = false,
	error,
	hint,
	label,
	id: idProp,
} = defineProps<{
	modelValue?: string | number | null;
	items: RadioItem[];
	label?: string;
	/** Columns from sm up (Directus getMinimalGridClass: grid-2/3/4). */
	columns?: 1 | 2 | 3 | 4;
	/** Custom Material Symbols names for the checked / unchecked states (Directus select-radio iconOn / iconOff). */
	iconOn?: string;
	iconOff?: string;
	/** Data color of the checked state (Directus `color` option), applied with style. */
	color?: string;
	disabled?: boolean;
	invalid?: boolean;
	required?: boolean;
	hint?: string;
	error?: string;
	id?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>();

const id = idProp ?? useId();
const labelId = `${id}-label`;
const hintId = `${id}-hint`;
const errorId = `${id}-error`;

const GRID = {
	1: 'grid-cols-1',
	2: 'grid-cols-1 sm:grid-cols-2',
	3: 'grid-cols-1 sm:grid-cols-3',
	4: 'grid-cols-1 sm:grid-cols-4',
};
// Tier 3 Radio recipe (draft 013).
const ITEM =
	'flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.25px] bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500 data-[disabled]:cursor-not-allowed data-[disabled]:border-gray-200 data-[disabled]:bg-transparent dark:data-[disabled]:border-gray-800';
const ICON_ITEM =
	'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 data-[state=checked]:text-brand-500 dark:text-gray-400 dark:data-[state=checked]:text-brand-400 data-[disabled]:cursor-not-allowed data-[disabled]:text-gray-200 dark:data-[disabled]:text-gray-800';
const VALID =
	'border-gray-300 hover:border-brand-500 focus-visible:outline-brand-500 dark:border-gray-700 dark:hover:border-brand-400 dark:focus-visible:outline-brand-400';
const INVALID =
	'border-error-600 focus-visible:outline-error-600 dark:border-error-400 dark:focus-visible:outline-error-400';

function itemStyle(checked: boolean, color: string | undefined, icon: boolean): Record<string, string> {
	if (!checked || !color) return {};
	return icon ? { color } : { borderColor: color, backgroundColor: color };
}
</script>

<template>
	<div>
		<span v-if="label" :id="labelId" class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
			{{ label }}
			<span v-if="required" class="text-error-600 dark:text-error-400" aria-hidden="true">*</span>
		</span>
		<RadioGroupRoot
			:model-value="modelValue ?? null"
			:disabled="disabled"
			:required="required"
			:aria-labelledby="label ? labelId : undefined"
			:aria-describedby="[hint ? hintId : '', error ? errorId : ''].join(' ').trim() || undefined"
			:aria-invalid="invalid || !!error ? 'true' : undefined"
			:aria-required="required ? 'true' : undefined"
			class="grid gap-x-6 gap-y-3"
			:class="GRID[columns]"
			@update:model-value="emit('update:modelValue', $event as string | number)"
		>
			<div
				v-for="(item, index) in items"
				:key="item.value"
				class="flex items-center gap-3 text-sm font-normal select-none"
				:class="disabled || item.disabled ? 'text-gray-300 dark:text-gray-700' : 'text-gray-700 dark:text-gray-300'"
			>
				<RadioGroupItem
					:id="`${id}-${index}`"
					v-slot="{ checked }"
					:value="item.value"
					:disabled="!!item.disabled"
					:class="[iconOn || iconOff ? ICON_ITEM : ITEM, invalid || error ? INVALID : VALID]"
					:style="itemStyle(modelValue === item.value, color, !!(iconOn || iconOff))"
				>
					<BoIcon
						v-if="iconOn || iconOff"
						:name="(checked ? iconOn : iconOff) ?? (checked ? 'radio_button_checked' : 'radio_button_unchecked')"
						size="md"
					/>
					<RadioGroupIndicator v-else class="block h-2 w-2 rounded-full bg-white" />
				</RadioGroupItem>
				<label :for="`${id}-${index}`" :class="disabled || item.disabled ? 'cursor-not-allowed' : 'cursor-pointer'">
					{{ item.text }}
				</label>
			</div>
		</RadioGroupRoot>
		<p v-if="hint" :id="hintId" class="mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">{{ hint }}</p>
		<p
			v-if="error"
			:id="errorId"
			role="alert"
			class="mt-1.5 flex items-center gap-1 text-theme-xs text-error-600 dark:text-error-400"
		>
			<BoIcon name="error" size="sm" />
			{{ error }}
		</p>
	</div>
</template>
