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
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const id = idProp ?? useId();
const errorId = `${id}-error`;
const input = useTemplateRef('input');

function onInput() {
	emit('update:modelValue', input.value!.value);
}

// The autofocus attribute only works on page load, not when a view mounts later.
onMounted(() => {
	if (autofocus) input.value?.focus();
});
</script>

<template>
	<div class="flex flex-col gap-eh-1">
		<label v-if="label" :for="id" class="text-eh-sm font-semibold text-eh-text-primary">{{ label }}</label>
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
			class="h-eh-10 w-full rounded-eh-md border border-eh-border bg-eh-surface-default px-eh-3 text-eh-base text-eh-text-primary placeholder:text-eh-text-secondary read-only:bg-eh-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-eh-status-danger"
			@input="onInput"
		/>
		<p v-if="error" :id="errorId" role="alert" class="flex items-center gap-eh-1 text-eh-sm text-eh-text-primary">
			<BoIcon name="error" size="sm" class="text-eh-status-danger" />
			{{ error }}
		</p>
	</div>
</template>
