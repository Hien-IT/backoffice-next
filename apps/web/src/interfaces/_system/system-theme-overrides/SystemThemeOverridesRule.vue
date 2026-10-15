<!-- Ported from directus/app/src/interfaces/_system/system-theme-overrides/system-theme-overrides-rule.vue -->
<script setup lang="ts">
// Backoffice: recipe Q-19 rule row (label linked to the input, swatch `size-5 rounded border` with the value as inline
// background); the input is named by its full path (`navigation.background`), since rule names repeat across groups.
// cssVar is the copy in utils/css-var.ts. A dot marks a stored value.
import Color from 'color';
import { computed, useId } from 'vue';
import { cssVar } from '../../../utils/css-var.ts';
import type { SetValueFn } from './types.ts';

const props = defineProps<{
	rule: string;
	type: 'color';
	set: SetValueFn;
	path: string[];
	value: string | number | undefined;
	defaultValue: string | number;
}>();

const id = useId();

const onInput = (event: Event) => {
	props.set(props.path, (event.target as HTMLInputElement).value);
};

const swatchValue = computed(() => {
	const value = props.value ?? props.defaultValue;

	if (typeof value !== 'string') return null;

	if (value.startsWith('var(--')) {
		// A var function that resolves to a color should be rendered directly.
		const result = cssVar(value.slice(4, -1));

		if (!result.startsWith('#')) {
			return null;
		}
	}

	return value;
});

const showSwatch = computed(() => {
	if (!swatchValue.value) return false;

	try {
		if (swatchValue.value.startsWith('var(--') || swatchValue.value.startsWith('color-mix(')) {
			/*
			 * var and color-mix are not supported by the color lib.
			 * We assume var has been validated by this point and can be directly rendered.
			 * By rendering the function directly we ensure reactivity for realtime changes.
			 */
			return true;
		}

		Color(swatchValue.value);
		return true;
	} catch {
		return false;
	}
});
</script>

<template>
	<div
		class="relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1.5rem] items-center gap-2 font-mono text-theme-sm"
		:data-has-value="!!value || undefined"
	>
		<span
			v-if="value"
			class="absolute -start-2 top-1/2 size-1 -translate-y-1/2 rounded-full bg-gray-500 dark:bg-gray-400"
			aria-hidden="true"
		/>
		<label :for="id" class="truncate text-gray-800 dark:text-white/90">{{ rule }}:</label>
		<input
			:id="id"
			type="text"
			:aria-label="path.join('.')"
			:value="value"
			:placeholder="String(defaultValue)"
			class="min-w-0 border-0 border-b border-gray-300 bg-transparent px-1 py-0.5 text-gray-800 placeholder:text-gray-500 focus:border-brand-500 focus:outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-gray-400 dark:focus:border-brand-400 dark:focus-visible:outline-brand-400"
			@input="onInput"
		/>
		<span
			v-if="showSwatch"
			data-swatch
			class="size-5 rounded border border-gray-300 dark:border-gray-700"
			:style="{ backgroundColor: swatchValue! }"
			aria-hidden="true"
		/>
	</div>
</template>
