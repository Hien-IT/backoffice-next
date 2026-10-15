<!-- Ported from directus/app/src/interfaces/input-multiline/input-multiline.vue -->
<script setup lang="ts">
// Backoffice: VTextarea (nullable and trim logic of directus/app/src/components/v-textarea.vue) is inlined on a
// textarea with the component-specs Textarea classes, linked to the form label and messages (FR-094); `font` maps to
// the theme font classes (BoTextarea); the counter keeps the Directus position and
// threshold (only the warning color is styled below 10 %, as in Directus).
import { computed, inject } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';

const props = withDefaults(
	defineProps<{
		value: string | null;
		clear?: boolean | undefined;
		disabled?: boolean | undefined;
		placeholder?: string | undefined;
		trim?: boolean | undefined;
		font?: 'sans-serif' | 'serif' | 'monospace';
		softLength?: number | undefined;
		direction?: string | undefined;
	}>(),
	{
		font: 'sans-serif',
	},
);

const emit = defineEmits(['input']);

const a11y = inject(FORM_FIELD_A11Y, null);

const charsRemaining = computed(() => {
	if (typeof props.value === 'number') return null;

	if (!props.softLength) return null;
	if (!props.value && props.softLength) return props.softLength;
	const realValue = props.value!.replaceAll('\n', ' ').length;

	if (props.softLength) return +props.softLength - realValue;
	return null;
});

const percentageRemaining = computed(() => {
	if (typeof props.value === 'number') return null;

	if (!props.softLength) return null;
	if (!props.value) return 100;

	if (props.softLength) return 100 - (props.value.length / +props.softLength) * 100;
	return 100;
});

// directus/app/src/components/v-textarea.vue (nullable = !clear)
function emitValue(event: Event) {
	const value = (event.target as HTMLTextAreaElement).value;

	if (!props.clear && value === '') {
		emit('input', null);
	} else {
		emit('input', value);
	}
}

function trimIfEnabled() {
	if (props.value && props.trim) {
		emit('input', props.value.trim());
	}
}

const invalid = computed(() => !!a11y?.value.invalid);

const FIELD =
	'block min-h-[10rem] w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 disabled:cursor-not-allowed';
const FIELD_DISABLED =
	'disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 disabled:placeholder:text-gray-300 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03] dark:disabled:placeholder:text-white/15';
const FIELD_VALID =
	'border-gray-500 focus:border-brand-500 focus:ring-brand-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400 dark:border-gray-500 dark:focus:border-brand-400';
const FIELD_INVALID =
	'border-error-600 focus:border-error-600 focus:ring-error-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400 dark:border-error-400 dark:focus:border-error-400';
// shortcut: the theme only defines font-outfit; serif and monospace use generic system stacks (as BoTextarea) until
// the design-system adds font tokens for them.
const FONTS = {
	'sans-serif': 'font-outfit',
	serif: 'font-[family-name:ui-serif,Georgia,serif]',
	monospace: 'font-[family-name:ui-monospace,SFMono-Regular,Menlo,monospace]',
};
</script>

<template>
	<div class="group/textarea relative">
		<textarea
			:id="a11y?.inputId"
			:value="value ?? ''"
			:placeholder="placeholder"
			:disabled="disabled"
			:dir="direction"
			:aria-describedby="a11y?.describedBy"
			:aria-invalid="invalid ? 'true' : undefined"
			:class="[FIELD, FONTS[font], invalid ? FIELD_INVALID : FIELD_VALID, FIELD_DISABLED]"
			@input="emitValue"
			@blur="trimIfEnabled"
		/>
		<span
			v-if="(percentageRemaining && percentageRemaining <= 20) || softLength"
			data-remaining
			class="pointer-events-none absolute end-2.5 bottom-1.5 text-sm font-semibold tabular-nums"
			:class="
				percentageRemaining! < 10 ? 'text-warning-700 dark:text-warning-400' : 'text-gray-500 dark:text-gray-400'
			"
		>
			{{ charsRemaining }}
		</span>
	</div>
</template>
