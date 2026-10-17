<script setup lang="ts">
import { onMounted, useId, useTemplateRef } from 'vue';
import BoIcon from './BoIcon.vue';

// Extra attributes (name, required, data-testid...) go to the <input>, not the wrapper.
defineOptions({ inheritAttrs: false });

const {
	type = 'text',
	autofocus = false,
	disabled = false,
	readonly = false,
	invalid = false,
	error,
	id: idProp,
	dbSafe = false,
} = defineProps<{
	modelValue?: string | number | null;
	type?: string;
	label?: string;
	placeholder?: string;
	autocomplete?: string;
	autofocus?: boolean;
	disabled?: boolean;
	readonly?: boolean;
	invalid?: boolean;
	/** Error text under the field, linked with aria-describedby and read out (role=alert). */
	error?: string;
	maxlength?: number;
	inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
	id?: string;
	/** Database-safe key (collection, field): only a-z, 0-9 and _ as `dbSafe` of Directus `v-input.vue` (spec 016 FR-007). */
	dbSafe?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const id = idProp ?? useId();
const errorId = `${id}-error`;
const input = useTemplateRef('input');

// component-specs FIELD / FIELD_INVALID / FIELD_DISABLED; read-only gets the disabled background (no recipe).
const FIELD =
	'w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 disabled:placeholder:text-gray-300 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03] dark:disabled:placeholder:text-white/15 read-only:bg-gray-50 dark:read-only:bg-white/[0.03]';
const FIELD_VALID =
	'border-gray-500 focus:border-brand-500 focus:ring-brand-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400 dark:border-gray-500 dark:focus:border-brand-400';
const FIELD_INVALID =
	'border-error-600 focus:border-error-600 focus:ring-error-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400 dark:border-error-400 dark:focus:border-error-400';

// Ported from directus/app/src/components/v-input.vue (`dbSafe` of onKeyDown and emitValue) and the system keys of
// directus/packages/composables/src/use-shortcut.ts.
const DB_SAFE_KEYS = 'abcdefghijklmnopqrstuvwxyz0123456789_ '.split('');
const SYSTEM_KEYS = [
	'meta',
	'control',
	'shift',
	'alt',
	'backspace',
	'delete',
	'tab',
	'capslock',
	'enter',
	'home',
	'end',
	'escape',
];

function onKeydown(event: KeyboardEvent) {
	if (!dbSafe || !event.key) return;
	const key = event.key.toLowerCase();
	const allowed = DB_SAFE_KEYS.includes(key) || SYSTEM_KEYS.includes(key) || key.startsWith('arrow');
	const withModifier = event.metaKey || event.ctrlKey || event.altKey;
	// Shortcuts (copy, paste, select all) go through; a pasted value is cleaned in onInput.
	if (!allowed && !withModifier) event.preventDefault();
	// No leading digit.
	if (input.value!.value.length === 0 && /^[0-9]$/.test(key) && !withModifier && !event.shiftKey)
		event.preventDefault();
}

function onInput() {
	let value = input.value!.value;

	if (dbSafe) {
		value = value
			.replace(/\s/g, '_')
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-zA-Z0-9_]/g, '');
		if (value !== input.value!.value) input.value!.value = value;
	}

	emit('update:modelValue', value);
}

// The autofocus attribute only works on page load, not when a view mounts later.
onMounted(() => {
	if (autofocus) input.value?.focus();
});
</script>

<template>
	<div>
		<label v-if="label" :for="id" class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
			{{ label }}
		</label>
		<input
			v-bind="$attrs"
			:id="id"
			ref="input"
			:value="modelValue ?? ''"
			:type="type"
			:placeholder="placeholder"
			:autocomplete="autocomplete"
			:disabled="disabled"
			:readonly="readonly"
			:maxlength="maxlength"
			:inputmode="inputmode"
			:aria-invalid="invalid || !!error ? 'true' : undefined"
			:aria-describedby="error ? errorId : undefined"
			class="h-11"
			:class="[FIELD, invalid || error ? FIELD_INVALID : FIELD_VALID]"
			@keydown="onKeydown"
			@input="onInput"
		/>
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
