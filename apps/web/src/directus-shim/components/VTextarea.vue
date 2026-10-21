<!-- Ported from directus/app/src/components/v-textarea.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): wraps BoTextarea; `nullable` and `trim` as in Directus (emitValue,
// trimIfEnabled). The attrs go to the textarea, `class`/`style` to the root. `expandOnFocus`: input height until it is
// focused or has content, the prepend/append slots shown then. Not honoured: the greyless look of `nonEditable` (a
// disabled textarea stays greyed).
import { omit } from 'lodash-es';
import { computed, onMounted, useAttrs, useTemplateRef } from 'vue';
import BoTextarea from '../../components/BoTextarea.vue';

defineOptions({ inheritAttrs: false });

interface Props {
	/** Disables the input */
	disabled?: boolean;
	/** Set the non-editable state for the input */
	nonEditable?: boolean;
	/** Autofocusses the input on render */
	autofocus?: boolean;
	/** Render the input with 100% width */
	fullWidth?: boolean;
	/** Model the text inside the input */
	modelValue?: string;
	/** If the input is empty, return `null` instead of `''` */
	nullable?: boolean;
	/** Renders the textarea at regular input size, and expands to max-block-size on focus */
	expandOnFocus?: boolean;
	/** Text to show when no input is entered */
	placeholder?: string;
	/** Trim leading and trailing whitespace */
	trim?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	disabled: false,
	nonEditable: false,
	autofocus: false,
	fullWidth: true,
	nullable: true,
	expandOnFocus: false,
	trim: false,
});

const emit = defineEmits(['update:modelValue']);

const attrs = useAttrs();
const fieldAttrs = computed(() => omit(attrs, ['class', 'style']));

const root = useTemplateRef<HTMLElement>('root');

const hasContent = computed(() => !!props.modelValue && props.modelValue.length > 0);

// The autofocus attribute only works on page load (v-focus of Directus).
onMounted(() => {
	if (props.autofocus) root.value?.querySelector('textarea')?.focus();
});

function emitValue(value: string) {
	if (props.nullable === true && value === '') {
		emit('update:modelValue', null);
	} else {
		emit('update:modelValue', value);
	}
}

function trimIfEnabled() {
	if (props.modelValue && props.trim) {
		emit('update:modelValue', props.modelValue.trim());
	}
}

const EXPAND = 'h-11 resize-none transition-[height] focus:h-40 motion-reduce:transition-none';
const SLOT = computed(() => [
	'shrink-0 text-gray-500 dark:text-gray-400',
	props.expandOnFocus && !hasContent.value && 'opacity-0 group-focus-within:opacity-100',
]);
</script>

<template>
	<div
		ref="root"
		class="group items-start gap-2"
		:class="[fullWidth ? 'flex w-full' : 'inline-flex', $attrs['class']]"
		:style="$attrs['style'] as string"
	>
		<div v-if="$slots['prepend']" :class="SLOT"><slot name="prepend" /></div>
		<div class="min-w-0 grow">
			<BoTextarea
				v-bind="placeholder === undefined ? fieldAttrs : { ...fieldAttrs, placeholder }"
				:model-value="modelValue ?? null"
				:disabled
				:class="expandOnFocus && (hasContent ? 'h-40' : EXPAND)"
				@update:model-value="emitValue"
				@blur="trimIfEnabled"
			/>
		</div>
		<div v-if="$slots['append']" :class="SLOT"><slot name="append" /></div>
	</div>
</template>
