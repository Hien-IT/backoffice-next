<!-- Ported from directus/app/src/components/v-input.vue -->
<script setup lang="ts">
// Backoffice: only the parts the input and input-hash interfaces use (prefix/suffix, clickable,
// small, prepend-outer/append-outer left out). Markup: a FIELD-styled frame (component-specs Input + TimeField root)
// around a bare <input>, so the icons sit inside the border. The id/aria links come from FormField (FR-094).
import slugify from '@sindresorhus/slugify';
import { isNil } from 'lodash-es';
import { computed, inject, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../components/BoIcon.vue';
import BoTooltip from '../../components/BoTooltip.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';

defineOptions({ inheritAttrs: false });

interface Props {
	/** Autofocusses the input on render */
	autofocus?: boolean | undefined;
	/** Set the disabled state for the input */
	disabled?: boolean | undefined;
	/** Set the non-editable state for the input */
	nonEditable?: boolean | undefined;
	/** What text to display if the input is empty */
	placeholder?: string | number | undefined;
	/** Used to model the value written inside the input */
	modelValue?: string | number | null | undefined;
	/** When active, sets an empty entry to null */
	nullable?: boolean | undefined;
	/** Force the value to be URL safe */
	slug?: boolean | undefined;
	/** What character to use as separator in slugs */
	slugSeparator?: string | undefined;
	/** Defines the type of the input. Either `text` or `number` */
	type?: string | undefined;
	/** Hide the arrows that are used to increase or decrease a number */
	hideArrows?: boolean | undefined;
	/** The maximum amount of characters that can be entered */
	maxLength?: number | undefined;
	/** The maximum number that can be entered */
	max?: number | undefined;
	/** The minimum number that can be entered */
	min?: number | undefined;
	/** In which unit steps should be counted up or down */
	step?: number | undefined;
	/** Make the value save to be used with the DB */
	dbSafe?: boolean | undefined;
	/** Trim the start and end whitespace */
	trim?: boolean | undefined;
	/** The kind of autocompletion the browser should do on the input */
	autocomplete?: string | undefined;
	/** If the input should be an integer */
	integer?: boolean | undefined;
	/** If the input should be a float */
	float?: boolean | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	autofocus: false,
	disabled: false,
	nonEditable: false,
	placeholder: undefined,
	modelValue: undefined,
	nullable: true,
	slug: false,
	slugSeparator: '-',
	type: 'text',
	hideArrows: false,
	maxLength: undefined,
	max: undefined,
	min: undefined,
	step: 1,
	dbSafe: false,
	trim: false,
	autocomplete: 'off',
});

const emit = defineEmits(['keydown', 'update:modelValue', 'focus']);

// Backoffice: directus/packages/composables/src/use-shortcut.ts (keyMap, systemKeys), not a dependency of apps/web.
const keyMap: Record<string, string> = { Control: 'meta', Command: 'meta' };
const systemKeys = ['meta', 'shift', 'alt', 'backspace', 'delete', 'tab', 'capslock', 'enter', 'home', 'end'];

const { t } = useI18n();

const a11y = inject(FORM_FIELD_A11Y, null);

const input = ref<HTMLInputElement | null>(null);

const isStepUpAllowed = computed(() => {
	return props.disabled === false && (props.max === undefined || Number(props.modelValue) < props.max);
});

const isStepDownAllowed = computed(() => {
	return props.disabled === false && (props.min === undefined || Number(props.modelValue) > props.min);
});

const { isBadInput, setInvalidInput, inlineWarning } = useInlineWarning();

onMounted(() => {
	if (props.autofocus) input.value?.focus();
});

function onInput(event: Event) {
	const target = event.target as HTMLInputElement;

	const regexValidInteger = /^-?\d*$/;

	if (props.integer && !regexValidInteger.test(target.value)) {
		const invalidCharsRegex = /(?!^)-|[^0-9-]/g;
		target.value = target.value.replace(invalidCharsRegex, '');
		return;
	}

	const regexValidFloat = /^-?(\d*((,|\.)\d+)?)$/;

	if (props.float && !regexValidFloat.test(target.value)) {
		const invalidCharsRegex = /(?!^)-|[^0-9-.,]/g;
		const duplicatePointRegex = /(.*[.,].*)[.,]/g;
		target.value = target.value.replace(invalidCharsRegex, '').replace(duplicatePointRegex, '$1');
		return;
	}
}

function processValue(event: KeyboardEvent) {
	// `event.key` can be `undefined` with Chrome's autofill feature
	const key = keyMap[event.key] ?? event.key?.toLowerCase();
	const shortcutKey = event.ctrlKey || event.shiftKey || event.altKey || event.metaKey;

	if (!key) return;

	const value = (event.target as HTMLInputElement).value;

	const addsChar = !shortcutKey && key.length === 1;
	const isInvalidInteger = props.integer && !/[\d-]/.test(key);
	const isInvalidFloat = props.float && !/[\d-.,]/.test(key);

	if (addsChar && (isInvalidInteger || isInvalidFloat)) {
		event.preventDefault();
		return;
	}

	if (props.slug === true) {
		const slugSafeCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789-_~ '.split('');

		const isAllowed = slugSafeCharacters.includes(key) || systemKeys.includes(key) || key.startsWith('arrow');

		if (isAllowed === false) {
			event.preventDefault();
		}

		if (key === ' ' && value.endsWith(props.slugSeparator)) {
			event.preventDefault();
		}
	}

	if (props.dbSafe === true) {
		const dbSafeCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789_ '.split('');

		const isAllowed = dbSafeCharacters.includes(key) || systemKeys.includes(key) || key.startsWith('arrow');

		if (isAllowed === false) {
			event.preventDefault();
		}

		const isCombinationWithSystemKeys = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

		// Prevent leading number
		if (value.length === 0 && '0123456789'.split('').includes(key) && !isCombinationWithSystemKeys) {
			event.preventDefault();
		}
	}

	emit('keydown', event);
}

function trimIfEnabled() {
	if (props.modelValue && props.trim && ['string', 'text'].includes(props.type)) {
		const trimmedValue = String(props.modelValue).trim();

		if (props.nullable === true && trimmedValue === '') {
			emit('update:modelValue', null);
		} else {
			emit('update:modelValue', trimmedValue);
		}
	}
}

function emitValue(event: Event) {
	const target = event.target as HTMLInputElement;
	let value = target.value;

	setInvalidInput(target);

	if (props.nullable === true && value === '') {
		emit('update:modelValue', null);
		return;
	}

	if (props.type === 'number') {
		const parsedNumber = Number(value);

		if (props.integer === true && !Number.isInteger(parsedNumber) && Number.isNaN(parsedNumber) === false) {
			emit('update:modelValue', Math.floor(parsedNumber));
			return;
		}

		// Ignore if numeric value remains unchanged
		if (props.modelValue !== parsedNumber) {
			emit('update:modelValue', parsedNumber);
		}
	} else {
		// decimal input marked as text
		if (props.float === true) {
			/**
			 * Normalize decimal separator from ',' to '.'
			 * Thousands separators are not supported in the input
			 */
			value = value.replace(',', '.');
		}

		if (props.slug === true) {
			const endsWithSpace = value.endsWith(' ');
			value = slugify(value, { separator: props.slugSeparator, preserveTrailingDash: true });
			if (endsWithSpace) value += props.slugSeparator;
		}

		if (props.dbSafe === true) {
			value = value.replace(/\s/g, '_');
			// Replace é -> e etc
			value = value.normalize('NFD').replace(/[̀-ͯ]/g, '');
			// prevent pasting of non dbSafeCharacters from bypassing the keydown checks
			value = value.replace(/[^a-zA-Z0-9_]/g, '');
		}

		emit('update:modelValue', value);
	}
}

function stepUp() {
	if (!input.value) return;
	if (isStepUpAllowed.value === false) return;

	input.value.stepUp();
	setInvalidInput(input.value);

	if (input.value.value != null) {
		return emit('update:modelValue', Number(input.value.value));
	}
}

function stepDown() {
	if (!input.value) return;
	if (isStepDownAllowed.value === false) return;

	input.value.stepDown();
	setInvalidInput(input.value);

	if (input.value.value) {
		return emit('update:modelValue', Number(input.value.value));
	} else {
		return emit('update:modelValue', props.min || 0);
	}
}

function useInlineWarning() {
	const isBadInput = ref(false);

	const badInputWarning = computed(() => {
		if (!isBadInput.value) return undefined;
		return t(props.type === 'number' ? 'not_a_number' : 'invalid_input');
	});

	const invalidRangeWarning = computed(() => {
		if (isNil(props.modelValue)) return undefined;

		const modelValue = Number(props.modelValue);

		if (props.min !== undefined && modelValue < props.min) {
			return t('invalid_range_min', { value: props.min });
		}

		if (props.max !== undefined && modelValue > props.max) {
			return t('invalid_range_max', { value: props.max });
		}

		return undefined;
	});

	const inlineWarning = computed(() => badInputWarning.value ?? invalidRangeWarning.value);

	return { isBadInput, setInvalidInput, inlineWarning };

	function setInvalidInput(target: HTMLInputElement) {
		// When the input’s validity.badInput property is true (e.g., due to invalid user input like non-numeric characters in a number field), the input event’s target.value will be empty even if we see a value in the input field. This means we can’t sanitize the input value in the input event handler.
		isBadInput.value = target.validity.badInput;
	}
}

const invalid = computed(() => !!a11y?.value.invalid);
const greyed = computed(() => props.disabled && !props.nonEditable);

// component-specs FIELD / FIELD_INVALID / FIELD_DISABLED on the frame (focus-within instead of focus).
const FRAME =
	'flex h-11 w-full items-center gap-2 rounded-lg border px-4 text-sm shadow-theme-xs focus-within:ring-3 dark:bg-gray-900 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2';
const FRAME_VALID =
	'border-gray-500 focus-within:border-brand-500 focus-within:ring-brand-500/10 has-[input:focus-visible]:outline-brand-500 dark:border-gray-500 dark:focus-within:border-brand-400 dark:has-[input:focus-visible]:outline-brand-400';
const FRAME_INVALID =
	'border-error-600 focus-within:border-error-600 focus-within:ring-error-500/10 has-[input:focus-visible]:outline-error-600 dark:border-error-400 dark:focus-within:border-error-400 dark:has-[input:focus-visible]:outline-error-400';
const FRAME_DISABLED =
	'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-white/[0.03]';
const INPUT =
	'h-full min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-gray-500 disabled:cursor-not-allowed dark:placeholder:text-gray-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const ARROW = 'flex h-4 items-center text-gray-500 dark:text-gray-400';
</script>

<template>
	<div
		data-input-frame
		:class="[
			$attrs.class,
			FRAME,
			invalid ? FRAME_INVALID : FRAME_VALID,
			greyed ? FRAME_DISABLED : 'text-gray-800 dark:text-white/90',
		]"
	>
		<div v-if="$slots['prepend']" class="flex shrink-0 items-center text-gray-500 dark:text-gray-400">
			<slot name="prepend" :value="modelValue" :disabled="disabled" />
		</div>
		<input
			v-bind="{ ...$attrs, class: undefined }"
			:id="a11y?.inputId"
			ref="input"
			:placeholder="placeholder ? String(placeholder) : undefined"
			:autocomplete="autocomplete"
			:type="type"
			:maxlength="maxLength"
			:min="min"
			:max="max"
			:step="step"
			:disabled="disabled"
			:aria-describedby="a11y?.describedBy"
			:aria-invalid="invalid || isBadInput ? 'true' : undefined"
			:value="modelValue === undefined || modelValue === null ? '' : String(modelValue)"
			:class="[INPUT, { 'line-through not-focus:text-gray-500': isBadInput }]"
			@input="
				onInput($event);
				emitValue($event);
			"
			@keydown="processValue"
			@blur="trimIfEnabled"
			@focus="emit('focus', $event)"
		/>
		<BoTooltip v-if="!nonEditable && inlineWarning" :text="inlineWarning">
			<span data-inline-warning class="flex text-warning-600 dark:text-warning-500">
				<BoIcon name="warning" :label="inlineWarning" />
			</span>
		</BoTooltip>
		<!-- Mouse helpers as in Directus; keyboard users have the native ArrowUp/ArrowDown of the number input. -->
		<span v-if="type === 'number' && !hideArrows && !nonEditable" aria-hidden="true" class="flex flex-col">
			<button
				type="button"
				tabindex="-1"
				data-step-up
				:disabled="!isStepUpAllowed"
				:class="ARROW"
				class="hover:text-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
				@click="stepUp"
			>
				<BoIcon name="keyboard_arrow_up" size="sm" />
			</button>
			<button
				type="button"
				tabindex="-1"
				data-step-down
				:disabled="!isStepDownAllowed"
				:class="ARROW"
				class="hover:text-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
				@click="stepDown"
			>
				<BoIcon name="keyboard_arrow_down" size="sm" />
			</button>
		</span>
		<div v-if="$slots['append']" class="flex shrink-0 items-center gap-1 text-gray-500 dark:text-gray-400">
			<slot name="append" :value="modelValue" :disabled="disabled" />
		</div>
	</div>
</template>
