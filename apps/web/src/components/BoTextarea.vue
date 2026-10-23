<script setup lang="ts">
import { useId } from 'vue';
import BoIcon from './BoIcon.vue';

// Extra attributes (name, required, maxlength, data-testid...) go to the <textarea>, not the wrapper.
defineOptions({ inheritAttrs: false });

const {
	rows = 6,
	font = 'sans-serif',
	disabled = false,
	readonly = false,
	invalid = false,
	error,
	hint,
	id: idProp,
} = defineProps<{
	modelValue?: string | null;
	label?: string;
	placeholder?: string;
	rows?: number;
	/** DR input-multiline `font` option. */
	font?: 'sans-serif' | 'serif' | 'monospace';
	disabled?: boolean;
	readonly?: boolean;
	invalid?: boolean;
	hint?: string;
	/** Error text under the field, linked with aria-describedby and read out (role=alert). */
	error?: string;
	id?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const id = idProp ?? useId();
const hintId = `${id}-hint`;
const errorId = `${id}-error`;

// component-specs Textarea = FIELD without h-11 + FIELD_INVALID / FIELD_DISABLED.
const FIELD =
	'block w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 disabled:placeholder:text-gray-300 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03] dark:disabled:placeholder:text-white/15 read-only:bg-gray-50 dark:read-only:bg-white/[0.03]';
const FIELD_VALID =
	'border-gray-300 focus:border-brand-500 focus:ring-brand-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400 dark:border-gray-700 dark:focus:border-brand-400';
const FIELD_INVALID =
	'border-error-600 focus:border-error-600 focus:ring-error-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400 dark:border-error-400 dark:focus:border-error-400';
// shortcut: the theme only defines font-outfit; serif and monospace use generic system stacks until the
// design-system adds font tokens for them.
const FONTS = {
	'sans-serif': 'font-outfit',
	serif: 'font-[family-name:ui-serif,Georgia,serif]',
	monospace: 'font-[family-name:ui-monospace,SFMono-Regular,Menlo,monospace]',
};
</script>

<template>
	<div>
		<label v-if="label" :for="id" class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
			{{ label }}
		</label>
		<textarea
			v-bind="$attrs"
			:id="id"
			:value="modelValue ?? ''"
			:rows="rows"
			:placeholder="placeholder"
			:disabled="disabled"
			:readonly="readonly"
			:aria-invalid="invalid || !!error ? 'true' : undefined"
			:aria-describedby="[hint ? hintId : '', error ? errorId : ''].join(' ').trim() || undefined"
			:class="[FIELD, FONTS[font], invalid || error ? FIELD_INVALID : FIELD_VALID]"
			@input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
		/>
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
