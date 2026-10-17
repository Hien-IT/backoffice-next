<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui';
import { useId } from 'vue';
import BoIcon from './BoIcon.vue';

const {
	disabled = false,
	invalid = false,
	error,
	hint,
	id: idProp,
} = defineProps<{
	modelValue?: boolean | null;
	label?: string;
	disabled?: boolean;
	invalid?: boolean;
	hint?: string;
	error?: string;
	id?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const id = idProp ?? useId();
const hintId = `${id}-hint`;
const errorId = `${id}-error`;

// component-specs Toggle (track + thumb); invalid adds the Checkbox invalid ring and FOCUS_ERROR.
const TRACK =
	'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-gray-500 data-[state=checked]:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-gray-500 dark:data-[state=checked]:bg-brand-500 data-[disabled]:cursor-not-allowed data-[disabled]:bg-gray-100 data-[disabled]:data-[state=checked]:bg-brand-500 data-[disabled]:data-[state=checked]:opacity-50 dark:data-[disabled]:bg-gray-800';
const FOCUS = 'focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const FOCUS_ERROR =
	'ring-2 ring-error-600 dark:ring-error-400 focus-visible:outline-error-600 dark:focus-visible:outline-error-400';
const THUMB =
	'block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-theme-sm transition-transform duration-300 ease-linear data-[state=checked]:translate-x-[22px] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[22px] motion-reduce:transition-none data-[disabled]:bg-gray-50';
</script>

<template>
	<div>
		<div class="flex items-center gap-3">
			<SwitchRoot
				:id="id"
				:model-value="modelValue ?? false"
				:disabled="disabled"
				:aria-invalid="invalid || !!error ? 'true' : undefined"
				:aria-describedby="[hint ? hintId : '', error ? errorId : ''].join(' ').trim() || undefined"
				:class="[TRACK, invalid || error ? FOCUS_ERROR : FOCUS]"
				@update:model-value="emit('update:modelValue', $event)"
			>
				<SwitchThumb :class="THUMB" />
			</SwitchRoot>
			<label
				v-if="label"
				:for="id"
				class="cursor-pointer text-sm font-normal select-none"
				:class="disabled ? 'cursor-not-allowed text-gray-400' : 'text-gray-700 dark:text-gray-300'"
			>
				{{ label }}
			</label>
		</div>
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
