<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui';
import { computed, useId } from 'vue';
import BoIcon from './BoIcon.vue';

const {
	modelValue = null,
	min = 0,
	max = 100,
	step = 1,
	alwaysShowValue = false,
	disabled = false,
	invalid = false,
	error,
	hint,
	label,
	id: idProp,
	ariaLabelledby,
	ariaDescribedby,
} = defineProps<{
	modelValue?: number | null;
	min?: number;
	max?: number;
	step?: number;
	/** Directus slider `alwaysShowValue`; otherwise the value shows on hover, focus and drag. */
	alwaysShowValue?: boolean;
	label?: string;
	disabled?: boolean;
	invalid?: boolean;
	hint?: string;
	error?: string;
	/** Set on the thumb when given (FormField input id). */
	id?: string | undefined;
	/** Form linking on the thumb (FormField ids), used when there is no own label; describedby is merged with the hint
	 * and error ids. */
	ariaLabelledby?: string | undefined;
	ariaDescribedby?: string | undefined;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const id = idProp ?? useId();
const labelId = `${id}-label`;
const hintId = `${id}-hint`;
const errorId = `${id}-error`;
const describedBy = computed(
	() => [ariaDescribedby, hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined,
);

// Directus v-slider: a null value puts the thumb on the step nearest the middle (nothing is emitted).
const position = computed(() => {
	if (modelValue !== null) return modelValue;
	const mid = min + (max - min) / 2;
	return Math.round((mid - min) / step) * step + min;
});

// Recipe: ticks only when there are at most 20 steps.
const ticks = computed(() => {
	const count = (max - min) / step;
	return count > 0 && count <= 20 ? Math.floor(count) + 1 : 0;
});

const THUMB =
	'group relative block h-5 w-5 cursor-pointer rounded-full border-2 bg-white shadow-theme-sm hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 data-[disabled]:cursor-not-allowed data-[disabled]:border-gray-300 dark:bg-gray-900 dark:data-[disabled]:border-gray-700';
const THUMB_VALID =
	'border-brand-500 focus-visible:outline-brand-500 dark:border-brand-400 dark:focus-visible:outline-brand-400';
const THUMB_INVALID =
	'border-error-600 focus-visible:outline-error-600 dark:border-error-400 dark:focus-visible:outline-error-400';
const BUBBLE =
	'pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg bg-gray-900 px-2 py-1 text-theme-xs font-medium text-white tabular-nums dark:bg-gray-800 dark:text-white/90';
</script>

<template>
	<div>
		<span v-if="label" :id="labelId" class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
			{{ label }}
		</span>
		<!-- Room for the value bubble above the thumb. -->
		<div class="pt-8">
			<SliderRoot
				:model-value="[position]"
				:min="min"
				:max="max"
				:step="step"
				:disabled="disabled"
				class="relative flex h-5 w-full touch-none items-center select-none"
				@update:model-value="$event?.[0] !== undefined && emit('update:modelValue', $event[0])"
			>
				<SliderTrack class="relative h-1.5 grow overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
					<SliderRange class="absolute h-full rounded-full bg-brand-500 dark:bg-brand-400" />
				</SliderTrack>
				<SliderThumb
					:id="idProp"
					:aria-labelledby="label ? labelId : ariaLabelledby"
					:aria-valuetext="modelValue === null ? undefined : String(modelValue)"
					:aria-describedby="describedBy"
					:aria-invalid="invalid || !!error ? 'true' : undefined"
					:class="[THUMB, invalid || error ? THUMB_INVALID : THUMB_VALID]"
				>
					<span
						v-if="modelValue !== null"
						data-value
						aria-hidden="true"
						:class="[BUBBLE, alwaysShowValue ? '' : 'hidden group-hover:block group-focus:block']"
					>
						{{ modelValue }}
					</span>
				</SliderThumb>
			</SliderRoot>
		</div>
		<div v-if="ticks" data-ticks aria-hidden="true" class="mt-1 flex justify-between px-2.5">
			<span v-for="tick in ticks" :key="tick" class="h-1.5 w-px bg-gray-500" />
		</div>
		<div aria-hidden="true" class="mt-1 flex justify-between text-theme-xs text-gray-500 dark:text-gray-400">
			<span data-min>{{ min }}</span>
			<span data-max>{{ max }}</span>
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
